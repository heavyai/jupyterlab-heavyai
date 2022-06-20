"""
Importing this module registers Jupyter cell magics for rendering
Vega Lite and Vega in the MapD server and for rendering a SQL editor given
a query.
"""

import ast
import urllib.parse

import heavyai
import ibis_heavyai
import yaml  # type: ignore

__all__ = ["HeavyAIVegaRenderer", "HeavyAISQLEditorRenderer"]

from IPython.core.magic import register_cell_magic
from IPython.display import display

# Allow this module to be imported outside of an IPython context
# by making `register_cell_magic a no-op in that case.
try:
    get_ipython()  # type: ignore # noqa
except Exception:
    register_cell_magic = lambda x: x  # noqa


class HeavyAIVegaRenderer:
    """
    Class that produces a vega mimebundle that the notebook
    heavyai renderer can understand.
    """

    def __init__(self, connection, data=None, vl_data=None):
        """
        Initialize the backend renderer. Either `data` or `vl_data`
        is required.

        Parameters
        =========

        connection: dict or ibis connection
            A dictionary containing the connection data for the heavyai
            server. Must include 'user', 'password', 'host', 'port',
            'dbname', and 'protocol'.
            Alternatively, an ibis connection to the heavyai databse.

        data: dict
            Vega data to render.

        vl_data: dict
            Vega lite data to render.
        """
        if (not (data or vl_data)) or (data and vl_data):
            raise RuntimeError(
                "Either vega or vega lite data must be specified"
            )
        connection, session = _make_connection(connection)
        self.connection = connection
        self.session = session
        self.data = data
        self.vl_data = vl_data

    def _repr_mimebundle_(self, include=None, exclude=None):
        """
        Return a mimebundle with 'application/vnd.heavyai.vega+json'
        data, which is a custom mimetype for rendering heavyai vega
        in Jupyter notebooks.
        """
        bundle = {"connection": self.connection, "sessionId": self.session}
        if self.data:
            bundle["vega"] = self.data
        else:
            bundle["vegaLite"] = self.vl_data
        return {"application/vnd.heavyai.vega+json": bundle}


class HeavyAISQLEditorRenderer:
    """
    Class that produces a sql editor mimebundle that the notebook
    heavyai renderer can understand.
    """

    def __init__(self, connection, query=""):
        """
        Initialize the SQL editor.

        Parameters
        =========

        connection: dict or ibis connection
            A dictionary containing the connection data for the heavyai
            server. Must include 'user', 'password', 'host', 'port',
            'dbname', and 'protocol'.
            Alternatively, an ibis connection to the heavyai databse.

        query: string or ibis expression.
            An initial query for the SQL editor.
        """
        connection, session = _make_connection(connection)
        self.connection = connection
        self.session = session

        if isinstance(query, str):
            self.query = query
        elif hasattr(query, "compile") and hasattr(query.compile, "__call__"):
            self.query = query.compile()

    def _repr_mimebundle_(self, include=None, exclude=None):
        """
        Return a mimebundle with 'application/vnd.heavyai.vega+json'
        data, which is a custom mimetype for rendering heavyai vega
        in Jupyter notebooks.
        """
        data = {
            "connection": self.connection,
            "sessionId": self.session,
            "query": self.query,
        }
        return {"application/vnd.heavyai.sqleditor+json": data}


@register_cell_magic
def heavyai_vega(line, cell):
    """
    Cell magic for rendering vega produced by the heavyai backend.

    Usage: Initiate it with the line `%% heavyai $connection_data`,
    where `connection_data` is the dictionary containing the connection
    data for the HeavyAI server. The rest of the cell should be yaml-specified
    vega data.
    """
    connection_data = ast.literal_eval(line)
    vega = yaml.safe_load(cell)
    display(HeavyAIVegaRenderer(connection_data, vega))


@register_cell_magic
def heavyai_vegalite(line, cell):
    """
    Cell magic for rendering vega lite produced by the heavyai backend.

    Usage: Initiate it with the line `%% heavyai $connection_data`,
    where `connection_data` is the dictionary containing the connection
    data for the HeavyAI server. The rest of the cell should be yaml-specified
    vega lite data.
    """
    connection_data = ast.literal_eval(line)
    vl = yaml.safe_load(cell)
    display(HeavyAIVegaRenderer(connection_data, vl_data=vl))


@register_cell_magic
def heavyai_sqleditor(line, cell):
    """
    Cell magic for rendering a SQL editor.

    Usage: Initiate it with the line `%% heavyai $connection_data`,
    where `connection_data` is the dictionary containing the connection
    data for the HeavyAI server. The rest of the cell should be
    a SQL query for the initial value of the editor.
    """
    connection_data = ast.literal_eval(line)
    display(HeavyAISQLEditorRenderer(connection_data, cell))


def _make_connection(connection):
    """
    Given a connection client, return JSON-serializable dictionary
    with connection data for the client, as well as a session id if available.
    If it is already a dictionary, return that.
    Works for Ibis clients, heavyai connections, and dictionaries.

    Parameters
    ----------
    connection: ibis.heavyai.HeavyAIDBClient or heavyai.Connection or dict
        A connection object.

    Returns
    -------
    connection, session: (dict, str)
        A tuple containing the serializable connection data and session id,
        if available. If the session id is not available (for instance, if
        a dict is provided), then returns None for the second item.
    """
    if isinstance(connection, ibis_heavyai.Backend):
        con = dict(
            host=connection.host,
            port=connection.port,
            database=connection.db_name,
            password=connection.password,
            protocol=connection.protocol,
            username=connection.user,
        )
        session = connection.con._session
    elif isinstance(connection, heavyai.Connection):
        parsed = urllib.parse.urlparse(connection._host)
        con = dict(
            host=parsed.hostname,
            port=connection._port,
            database=connection._dbname,
            password=connection._password,
            protocol=connection._protocol,
            username=connection._user,
        )
        session = connection._session
    else:
        con = connection
        session = None
    # If we have a live session id, we can safely delete authentication
    # material before sending it over the wire.
    if session:
        con.pop("password", "")
        con.pop("username", "")
        con.pop("database", "")
    return con, session
