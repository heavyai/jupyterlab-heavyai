"""
Importing this file will register multiple new Altair renderers and
monkeypatch Altair so it is able to process Ibis expressions as data.

Renderers:

* `omnisci`: Renders the Vega Lite with MapD's server Vega rendering.
  If you enable this, you must pass the SQL query to generate the data
  as a string to `altair.Chart`
* `extract-ibis`: Aggregates the data on the server and renders
  it in the browser. You must pass in a `ibis.Expression` to `altair.Chart`
  when using this renderer.
* `extract-ibis-sql`: Displays the generated SQL that would be run to get the
  aggregated data for the previous renderer.
* `extract-json`: Displays the JSON of the Vega Lite, after the aggregates
  are extracted. 


When using `extract-ibis` or `extract-ibis-sql`, you must also enable
the `ibis` data transformer, or they will not work.
"""

import ibis

import altair
import pandas
from altair.vegalite.v2.display import default_renderer

__all__ = ["display_chart"]

import ipykernel.comm
from IPython.display import JSON, Code, DisplayObject, display


def omnisci_mimetype(spec, conn):
    """
    Returns a omnisci vega lite mimetype, assuming that the URL
    for the vega spec is actually the SQL query
    """
    data = spec["data"]
    data["sql"] = data.pop("url")
    return {
        "application/vnd.omnisci.vega+json": {
            "vegalite": spec,
            "connection": {
                "host": conn.host,
                "protocol": conn.protocol,
                "port": conn.port,
                "user": conn.user,
                "dbname": conn.db_name,
                "password": conn.password,
            },
        }
    }


# A comm id used to establish a link between python code
# and frontend vega-lite transforms.
COMM_ID = "extract-vega-lite"


def extract_spec(spec, callback):
    my_comm = ipykernel.comm.Comm(target_name=COMM_ID, data=spec)

    @my_comm.on_msg
    def _recv(msg):
        callback(msg["content"]["data"])


class VegaLite(DisplayObject):
    def _repr_mimebundle_(self, include, exclude):
        return default_renderer(self.data)


# A placeholder vega spec that will be replaced once the
# transform has been completed and returned via the comm channel.
EMPTY_SPEC = {"data": {"values": []}, "mark": "bar"}


def extract_vega_renderer(spec, spec_transform=lambda s: s):
    """
    Create a placeholder spec and return it to the frontend.
    Also communicate with the frontend vega transform functionality
    over a comm channel. Once it has returned, update the placeholder
    with the actual vega spec.
    """
    display_id = display(VegaLite(EMPTY_SPEC), display_id=True)
    extract_spec(spec, lambda s: display_id.update(VegaLite(spec_transform(s))))
    return {"text/plain": ""}


def extract_vega_renderer_json(spec, spec_transform=lambda s: s):
    """
    Create a placeholder spec and return it to the frontend.
    Also communicate with the frontend vega transform functionality
    over a comm channel. Once it has returned, update the placeholder
    with the actual vega spec.
    """
    display_id = display(JSON({"_": "Waiting for transformed spec..."}), display_id=True)
    extract_spec(spec, lambda s: display_id.update(JSON(spec_transform(s))))
    return {"text/plain": ""}


def empty(expr):
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
        if data is not None and isinstance(data, ibis.Expr):
            expr = data
            data = empty(expr)
            data.ibis = expr
        return original_chart_init(self, data=data, *args, **kwargs)

    altair.Chart.__init__ = updated_chart_init


_i = 0
_name_to_ibis = {}

def retrieve_expr(spec) -> ibis.Expr:
    # some specs have sub `spec` key
    if 'spec' in spec:
        spec = spec['spec']
    return _name_to_ibis.pop(spec["data"]["name"])

def ibis_transformation(data):
    """
    turn a pandas DF with the Ibis query that made it attached to it into
    a valid Vega Lite data dict. Since this has to be JSON serializiable
    (because of how Altair is set up), we create a unique name and
    save the ibis expression globally with that name so we can pick it up later.
    """
    assert isinstance(data, pandas.DataFrame)
    global _i
    name = f"ibis_{_i}"
    _i += 1
    _name_to_ibis[name] = data.ibis
    return {"name": name}


def translate_op(op: str) -> str:
    return {"mean": "mean", "average": "mean"}.get(op, op)


def vl_aggregate_to_grouping_expr(expr: ibis.Expr, a: dict) -> ibis.Expr:
    if "field" in a:
        expr = expr[a["field"]]
    op = translate_op(a["op"])
    expr = getattr(expr, op)()
    return expr.name(a["as"])


def update_spec(expr: ibis.Expr, spec: dict):
    """
    Takes in an ibis expression and a spec, updating the spec and returning a new ibis expr
    """
    original_expr = expr
    # logic modified from
    # https://github.com/vega/vega-lite-transforms2sql/blob/3b360144305a6cec79792036049e8a920e4d2c9e/transforms2sql.ts#L7
    for transform in spec.get("transform", []):
        groupby = transform.pop("groupby", None)
        if groupby:
            expr = expr.groupby(groupby)

        aggregate = transform.pop("aggregate", None)
        if aggregate:
            expr = expr.aggregate(
                [vl_aggregate_to_grouping_expr(original_expr, a) for a in aggregate]
            )

    return expr


def extract_vega_renderer_ibis_sql(spec):
    ibis_expression = retrieve_expr(spec)
    display_id = display(Code(""), display_id=True)

    def on_spec(extracted_spec, ibis_expression=ibis_expression, display_id=display_id):
        if 'spec' in extracted_spec:
            real_spec = extracted_spec['spec']
        else:
            real_spec = extracted_spec
        expr = update_spec(ibis_expression, real_spec)
        display_id.update(Code(expr.compile()))

    extract_spec(spec, on_spec)
    return {"text/plain": ""}


def extract_vega_renderer_ibis(spec):
    ibis_expression = retrieve_expr(spec)

    def spec_transform(extracted_spec, ibis_expression=ibis_expression):
        if 'spec' in extracted_spec:
            real_spec = extracted_spec['spec']
        else:
            real_spec = extracted_spec
        expr = update_spec(ibis_expression, real_spec)
        df = expr.execute()
        real_spec["data"] = altair.utils.data.to_json(df)
        return extracted_spec

    return extract_vega_renderer(spec, spec_transform=spec_transform)


altair.renderers.register("omnisci", omnisci_mimetype)
# not useful now, because initially dataframe is empty so rendering it as vega lite
# won't show anything useful.
# altair.renderers.register("extract", extract_vega_renderer)
altair.renderers.register("extract-json", extract_vega_renderer_json)
altair.renderers.register("extract-ibis", extract_vega_renderer_ibis)
altair.renderers.register("extract-ibis-sql", extract_vega_renderer_ibis_sql)

altair.data_transformers.register("ibis", ibis_transformation)
monkeypatch_altair()


def display_chart(chart: altair.Chart) -> None:
    """
    Given an Altair chart created around an Ibis expression, this displays the different
    stages of rendering of that chart. Helpful for debugging.
    """
    display(Code('altair.renderers.enable("json")'))
    altair.renderers.enable("json")
    display(chart)

    display(Code('altair.renderers.enable("extract-json")'))
    altair.renderers.enable("extract-json")
    chart._repr_mimebundle_(None, None)

    display(Code('altair.renderers.enable("extract-ibis-sql")'))
    altair.renderers.enable("extract-ibis-sql")
    chart._repr_mimebundle_(None, None)

    display(Code('altair.renderers.enable("extract-ibis")'))
    altair.renderers.enable("extract-ibis")
    chart._repr_mimebundle_(None, None)
