""" Functions for backend rendering with OmniSci """

import ast
import base64
import uuid
import yaml

import vdom
import ibis
import pymapd

try:
    import altair as alt
except ImportError:
    alt = None
else:
    import pandas as pd

from ipykernel.comm import Comm
from IPython.core.magic import register_cell_magic
from IPython.display import display
import IPython.display


class OmniSciVegaRenderer:
    """
    Class that produces a vega mimebundle that the notebook
    omnisci renderer can understand.
    """

    def __init__(self, connection, data=None, vl_data=None):
        """
        Initialize the backend renderer. Either `data` or `vl_data`
        is required.

        Parameters
        =========

        connection: dict or ibis connection
            A dictionary containing the connection data for the omnisci
            server. Must include 'user', 'password', 'host', 'port',
            'dbname', and 'protocol'.
            Alternatively, an ibis connection to the omnisci databse.

        data: dict
            Vega data to render.
        
        vl_data: dict
            Vega lite data to render.
        """
        if (not (data or vl_data)) or (data and vl_data):
            raise RuntimeError("Either vega or vega lite data must be specified")
        self.connection = _make_connection(connection)
        self.data = data
        self.vl_data = vl_data

    def _repr_mimebundle_(self, include=None, exclude=None):
        """
        Return a mimebundle with 'application/vnd.omnisci.vega+json'
        data, which is a custom mimetype for rendering omnisci vega
        in Jupyter notebooks.
        """
        bundle = {"connection": self.connection}
        if self.data:
            bundle["vega"] = self.data
        else:
            bundle["vegalite"] = self.vl_data
        return {"application/vnd.omnisci.vega+json": bundle}


class OmniSciSQLEditorRenderer:
    """
    Class that produces a sql editor mimebundle that the notebook
    omnisci renderer can understand.
    """

    def __init__(self, connection, query=""):
        """
        Initialize the SQL editor.

        Parameters
        =========

        connection: dict or ibis connection
            A dictionary containing the connection data for the omnisci
            server. Must include 'user', 'password', 'host', 'port',
            'dbname', and 'protocol'.
            Alternatively, an ibis connection to the omnisci databse.

        query: string or ibis expression.
            An initial query for the SQL editor.
        """
        self.connection = _make_connection(connection)
        if isinstance(query, str):
            self.query = query
        elif hasattr(query, "compile") and hasattr(query.compile, "__call__"):
            self.query = query.compile()

    def _repr_mimebundle_(self, include=None, exclude=None):
        """
        Return a mimebundle with 'application/vnd.omnisci.vega+json'
        data, which is a custom mimetype for rendering omnisci vega
        in Jupyter notebooks.
        """
        data = {"connection": self.connection, "query": self.query}
        return {"application/vnd.omnisci.sqleditor+json": data}


@register_cell_magic
def omnisci_vega(line, cell):
    """
    Cell magic for rendering vega produced by the omnisci backend.

    Usage: Initiate it with the line `%% omnisci $connection_data`,
    where `connection_data` is the dictionary containing the connection
    data for the OmniSci server. The rest of the cell should be yaml-specified
    vega data.
    """
    connection_data = ast.literal_eval(line)
    vega = yaml.load(cell)
    display(OmniSciVegaRenderer(connection_data, vega))


@register_cell_magic
def omnisci_vegalite(line, cell):
    """
    Cell magic for rendering vega lite produced by the omnisci backend.

    Usage: Initiate it with the line `%% omnisci $connection_data`,
    where `connection_data` is the dictionary containing the connection
    data for the OmniSci server. The rest of the cell should be yaml-specified
    vega lite data.
    """
    connection_data = ast.literal_eval(line)
    vl = yaml.load(cell)
    display(OmniSciVegaRenderer(connection_data, vl_data=vl))


@register_cell_magic
def omnisci_sqleditor(line, cell):
    """
    Cell magic for rendering a SQL editor. 

    Usage: Initiate it with the line `%% omnisci $connection_data`,
    where `connection_data` is the dictionary containing the connection
    data for the OmniSci server. The rest of the cell should be 
    a SQL query for the initial value of the editor.
    """
    connection_data = ast.literal_eval(line)
    display(OmniSciSQLEditorRenderer(connection_data, cell))


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
    my_comm = Comm(target_name=COMM_ID, data=spec)

    @my_comm.on_msg
    def _recv(msg):
        callback(msg["content"]["data"])


class VegaLite(IPython.display.DisplayObject):
    def _repr_mimebundle_(self, include, exclude):
        if alt:
            from altair.vegalite.v2.display import default_renderer

            return default_renderer(self.data)
        else:
            return {"text/plain": ""}


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
    display_id = display(IPython.display.JSON({}), display_id=True)
    extract_spec(
        spec, lambda s: display_id.update(IPython.display.JSON(spec_transform(s)))
    )
    return {"text/plain": ""}


# Currently we save the ibix expression of the current query globally.
# Ideally, we should be able to pass this through, but it is currently
# hard because the data has to be a str or number of values, not an ibis expression.
_curent_ibis_expression = None


def monkeypatch_altair():
    """
    Needed until https://github.com/altair-viz/altair/issues/843 is fixed to let Altair
    handle ibis inputs
    """
    original_chart_init = alt.Chart.__init__

    def updated_chart_init(self, data=None, *args, **kwargs):
        global _curent_ibis_expression
        if data is not None and isinstance(data, ibis.Expr):
            _curent_ibis_expression = data
            data = data.execute()
        final = original_chart_init(self, data=data, *args, **kwargs)
        return final

    alt.Chart.__init__ = updated_chart_init


def translate_op(op: str) -> str:
    return {"mean": "mean", "average": "mean"}.get(op, op)


def vl_aggregate_to_grouping_expr(expr: ibis.Expr, a: dict) -> ibis.Expr:
    if "field" in a:
        expr = expr["field"]
    op = translate_op(a["op"])
    expr = getattr(expr, op)()
    return expr.name(a["as"])


def update_spec(expr: ibis.Expr, spec: dict):
    """
    Takes in an ibis expression and a spec and should return an updated ibis expression
    and updated spec

    TODO: Fill this in by extracting transforms
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
            expr = expr.aggregate([vl_aggregate_to_grouping_expr(original_expr, a) for a in aggregate])

    return expr, spec


def extract_vega_renderer_ibis(spec):
    def spec_transform(extracted_spec):
        global _curent_ibis_expression
        expr, extracted_spec = update_spec(_curent_ibis_expression, extracted_spec)
        df = expr.execute()
        extracted_spec["data"] = alt.utils.data.to_json(df)
        extracted_spec["_query"] = expr.compile()
        return extracted_spec

    return extract_vega_renderer(spec, spec_transform=spec_transform)


if alt:
    alt.renderers.register("omnisci", omnisci_mimetype)
    alt.renderers.register("extract", extract_vega_renderer)
    alt.renderers.register("extract-json", extract_vega_renderer_json)
    alt.renderers.register("extract-ibis", extract_vega_renderer_ibis)
    monkeypatch_altair()


def display_chart(chart):
    display("json")
    alt.renderers.enable("json")
    display(chart)

    display("default")
    alt.renderers.enable("default")
    display(chart)

    display("extract-json")
    alt.renderers.enable("extract-json")
    chart._repr_mimebundle_(None, None)

    display("extract")
    alt.renderers.enable("extract")
    chart._repr_mimebundle_(None, None)

    display("extract-ibis")
    alt.renderers.enable("extract-ibis")
    chart._repr_mimebundle_(None, None)


def _make_connection(connection):
    """
    Given a connection client, return a dictionary with connection
    data for the client. If it is already a dictionary, return that.

    Works for Ibis clients, pymapd connections, and dictionaries.
    """
    if isinstance(connection, ibis.mapd.MapDClient):
        return dict(
            host=connection.host,
            port=connection.port,
            dbname=connection.db_name,
            password=connection.password,
            protocol=connection.protocol,
            user=connection.user,
        )
    elif isinstance(connection, pymapd.Connection):
        return dict(
            host=connection._host,
            port=connection._port,
            dbname=connection._dbname,
            password=connection._password,
            protocol=connection._protocol,
            user=connection._user,
        )
    else:
        return connection
