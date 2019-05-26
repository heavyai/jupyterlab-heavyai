"""
Functionality for server-side ibis transforms of vega charts.
"""

import copy
import json
import re
import typing

import altair
import altair.vegalite.v3.display
import ibis
import pandas
from IPython import get_ipython

from ibis_vega_transform import apply

__all__: typing.List[str] = []


_expr_map: typing.Dict[str, ibis.Expr] = {}

# New Vega Lite renderer mimetype which can process ibis expressions in names
MIMETYPE = "application/vnd.vega.ibis.v5+json"

EMPTY_VEGA = {
    "$schema": "https://vega.github.io/schema/vega/v5.json",
    "description": "An empty vega v5 spec",
    "width": 500,
    "height": 200,
    "padding": 5,
    "autosize": "pad",
    "signals": [],
    "data": [],
    "scales": [],
    "projections": [],
    "axes": [],
    "legends": [],
    "marks": [],
}


def empty(expr: ibis.Expr) -> pandas.DataFrame:
    """
    Creates an empty DF for a ibis expression, based on the schema

    https://github.com/ibis-project/ibis/issues/1676#issuecomment-441472528
    """
    return expr.schema().apply_to(pandas.DataFrame(columns=expr.columns))


def monkeypatch_altair():
    """
    Needed until https://github.com/altair-viz/altair/issues/843 is fixed to let Altair
    handle ibis inputs
    """
    original_chart_init = altair.Chart.__init__

    def updated_chart_init(self, data=None, *args, **kwargs):
        """
        If user passes in a Ibis expression, create an empty dataframe with
        those types and set the `ibis` attribute to the original ibis expression.
        """
        if data is not None and isinstance(data, ibis.Expr):
            expr = data
            data = empty(expr)
            data.ibis = expr

        return original_chart_init(self, data=data, *args, **kwargs)

    altair.Chart.__init__ = updated_chart_init


monkeypatch_altair()


DATA_NAME_PREFIX = "ibis:"


# Whether to fallback to getting the dataset as a pandas dataframe
# and rendering it manually, that way.
FALLBACK = False


def altair_data_transformer(data):
    """
    turn a pandas DF with the Ibis query that made it attached to it into
    a valid Vega Lite data dict. Since this has to be JSON serializiable
    (because of how Altair is set up), we create a unique name and
    save the ibis expression globally with that name so we can pick it up later.
    """
    assert isinstance(data, pandas.DataFrame)
    expr = data.ibis
    if FALLBACK:
        return altair.default_data_transformer(expr.limit(1000).execute())
    h = str(hash(expr))
    name = f"{DATA_NAME_PREFIX}{h}"
    _expr_map[h] = expr
    return {"name": name}


def _retrieve_expr_key(name: str) -> typing.Optional[str]:
    if not name.startswith(DATA_NAME_PREFIX):
        return None
    return name[len(DATA_NAME_PREFIX) :]


def altair_renderer(spec):
    if FALLBACK:
        return altair.vegalite.v3.display.default_renderer(spec)
    return {MIMETYPE: spec}


altair.data_transformers.register("ibis", altair_data_transformer)
altair.renderers.register("ibis", altair_renderer)


# For debugging
_executed_expressions = []
_incoming_specs = []
_outgoing_specs = []


def compiler_target_function(comm, msg):
    spec = msg["content"]["data"]
    _incoming_specs.append(spec)
    updated_spec = _transform(spec)
    _outgoing_specs.append(updated_spec)
    comm.send(updated_spec)


get_ipython().kernel.comm_manager.register_target(
    "jupyterlab-omnisci:vega-compiler", compiler_target_function
)


def query_target_func(comm, msg):
    # These are the paramaters passed to the vega transform
    parameters: dict = msg["content"]["data"]

    name: str = parameters.pop("name")
    transforms: typing.Optional[str] = parameters.pop("transforms", None)

    expr = _expr_map[name]
    if transforms:

        # Replace all string instances of data references with value in schema
        for k, v in parameters.items():
            # All data items are added to parameters as `:<data name>`.
            # They also should  be in the `data` paramater, but you have to call
            # this with a tuple which I am not sure where to get from
            # https://github.com/vega/vega/blob/65fe7cb2485be90e16298d9dff87bf56045afb8d/packages/vega-transforms/src/Filter.js#L48
            if not k.startswith(":"):
                continue
            k = k[1:]
            res = json.dumps(v)
            for t in transforms:
                if t["type"] == "filter" or t["type"] == "formula":
                    t["expr"] = _patch_vegaexpr(t["expr"], k, res)
        try:
            expr = apply(expr, transforms)
        except Exception as e:
            raise ValueError(
                f"Failed to convert {transforms} with error message message '{e}'"
            )

    _executed_expressions.append(expr)

    data = expr.execute()
    comm.send(altair.to_values(data)["values"])

def _patch_vegaexpr(expr: str, name: str, value: str) -> str:
    expr = expr.replace(f"data(\"{name}\")", value)
    expr = expr.replace(f"vlSelectionTest(\"{name}\"", f"vlSelectionTest({value}")
    return expr



get_ipython().kernel.comm_manager.register_target("queryibis", query_target_func)


def _extract_used_data(transforms) -> typing.Set[str]:
    """
    Given a list of transforms, returns a set of the data fields they depend on.
    """
    return {m.group(1) for m in re.finditer(r'data\("(.+?)"\)', str(transforms))}


assert _extract_used_data(
    [
        {
            "type": "filter",
            "expr": '!(length(data("Filter_store"))) || (vlSelectionTest("Filter_store", datum))',
        }
    ]
) == {"Filter_store"}


def _transform(spec: typing.Dict[str, typing.Any]):
    new = copy.deepcopy(spec)
    for data in new["data"]:
        # Handle initial named data

        name = data.get("name", "")
        key = _retrieve_expr_key(name)
        if key:
            data["transform"] = [{"type": "queryibis", "name": key}]
            continue

        source = data.get("source", "")
        key = _retrieve_expr_key(source)
        if key:
            transforms = data.get("transform", None)
            if transforms is None:
                continue
            del data["source"]
            data["transform"] = [
                {
                    "type": "queryibis",
                    "name": key,
                    "data": "{"
                    + ", ".join(
                        f"{field}: data('{field}')"
                        for field in _extract_used_data(transforms)
                    )
                    + "}",
                    "transforms": transforms,
                }
            ]

    return _cleanup_spec(new)


def _cleanup_spec(spec):
    """
    Goes through the spec and removes data sources that are not referenced anywhere else in the spec.

    Does this by turning the spec into a string and seeing if the name of the data is in the string
    """

    nonreferenced_data = []
    for data in spec["data"]:
        name = data["name"]
        # create a vesion of the spec where this data is removed
        without_this_data = copy.deepcopy(spec)
        without_this_data["data"].remove(data)
        has_reference = name in str(without_this_data)
        if not has_reference:
            nonreferenced_data.append(data)

    new = copy.deepcopy(spec)
    new["data"] = [data for data in new["data"] if data not in nonreferenced_data]
    return new


def translate_op(op: str) -> str:
    return {"mean": "mean", "average": "mean"}.get(op, op)
