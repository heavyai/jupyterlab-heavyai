"""

"""

import copy
import typing
import warnings

import ibis
import altair
import pandas
from ipykernel.comm import Comm
from IPython import get_ipython

__all__: typing.List[str] = []


_expr_map = {}

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
            name = f"ibis-{hash(data)}"
            _expr_map[name] = data
            data = altair.NamedData(name=name)

        return original_chart_init(self, data=data, *args, **kwargs)

    def ipython_display(self):
        expr = _expr_map[self.data.name]
        spec = _get_vegalite(self, expr.schema())
        d = display({MIMETYPE: EMPTY_VEGA}, raw=True, display_id=True)
        _add_target(expr)

        compile_comm = Comm(target_name="jupyterlab-omnisci:vega-compiler", data=spec)

        @compile_comm.on_msg
        def _recv(msg):
            vega_spec = msg["content"]["data"]
            if not vega_spec.get("$schema"):
                return
            transformed = _transform(vega_spec)
            d.update({MIMETYPE: transformed}, raw=True)

    altair.Chart.__init__ = updated_chart_init
    altair.Chart._ipython_display_ = ipython_display


def _get_vegalite(
    chart: altair.Chart, schema: ibis.Schema
) -> typing.Dict[str, typing.Any]:
    """
    Given an altair chart, and an ibis expression,
    get a vega-lite spec from them. This is more complex
    than calling chart.to_dict() because we use the expression schema
    to infer altair encoding types.
    """
    enc = chart.encoding
    for attr in dir(enc):
        field = getattr(enc, attr)
        if field == altair.Undefined:
            continue
        if field.field != altair.Undefined:
            name = field.field
        else:
            name = field.shorthand.split(":")[0]
        field.type = _infer_vegalite_type(schema[name])

    return chart.to_dict()


def _infer_vegalite_type(ibis_type: ibis.expr.datatypes.DataType) -> str:
    """
    Given an Ibis DataType from a schema object, infer a vega-lite type from it.
    Similar to _infer_vegalite_type from altair.core.
    """
    dtype = str(ibis_type)
    if dtype in [
        "integer",
        "signedinteger, unsignedinteger",
        "floating",
        "int8",
        "int16",
        "int32",
        "int64",
        "uint8",
        "uint16",
        "uint32",
        "uint64",
        "float16",
        "float32",
        "float64",
        "decimal",
    ]:
        return "quantitative"
    if dtype in ["category", "boolean", "string", "bytes"]:
        return "nominal"
    if dtype in ["timestamp", "date"]:
        return "temporal"
    # Default to nominal
    return "nominal"


def _transform(spec: typing.Dict[str, typing.Any]):
    new = copy.deepcopy(spec)
    for data in new["data"]:
        name = data.get("name")
        if name and _expr_map.get(name) is not None:
            data["transform"] = [{"type": "queryibis", "query": {}}]
    return new


def _add_target(expr: ibis.Expr):
    def target_func(comm, msg):
        @comm.on_msg
        def _recv(msg):
            data = expr.execute()
            display(altair.to_values(data))
            comm.send(altair.to_values(data)["values"])

    get_ipython().kernel.comm_manager.register_target("queryibis", target_func)


monkeypatch_altair()
