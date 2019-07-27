"""
Importing this module registers Jupyter cell magics for rendering
Vega Lite and Vega in the MapD server and for rendering a SQL editor given a query.
"""

import ast
import yaml
import urllib.parse

import ibis
import pymapd

__all__ = ["OmniSciVegaRenderer", "OmniSciSQLEditorRenderer"]

from IPython.core.magic import register_cell_magic
from IPython.display import display

# Allow this module to be imported outside of an IPython context
# by making `register_cell_magic a no-op in that case.
try:
    get_ipython()  # noqa
except Exception:
    register_cell_magic = lambda x: x


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
        connection, session = _make_connection(connection)
        self.connection = connection
        self.session = session
        self.data = data
        self.vl_data = vl_data

    def _repr_mimebundle_(self, include=None, exclude=None):
        """
        Return a mimebundle with 'application/vnd.omnisci.vega+json'
        data, which is a custom mimetype for rendering omnisci vega
        in Jupyter notebooks.
        """
        bundle = {"connection": self.connection, "sessionId": self.session}
        if self.data:
            bundle["vega"] = self.data
        else:
            bundle["vegaLite"] = self.vl_data
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
        connection, session = _make_connection(connection)
        self.connection = connection
        self.session = session

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
        data = {
            "connection": self.connection,
            "sessionId": self.session,
            "query": self.query,
        }
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
    vega = yaml.safe_load(cell)
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
    vl = yaml.safe_load(cell)
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


def _make_connection(connection):
    """
    Given a connection client, return JSON-serializable dictionary
    with connection data for the client, as well as a session id if available.
    If it is already a dictionary, return that.
    Works for Ibis clients, pymapd connections, and dictionaries.

    Parameters
    ----------
    connection: ibis.mapd.MapDClient or pymapd.Connection or dict
        A connection object.

    Returns
    -------
    connection, session: (dict, str)
        A tuple containing the serializable connection data and session id,
        if available. If the session id is not available (for instance, if
        a dict is provided), then returns None for the second item.
    """
    if isinstance(connection, ibis.mapd.MapDClient):
        con = dict(
            host=connection.host,
            port=connection.port,
            database=connection.db_name,
            password=connection.password,
            protocol=connection.protocol,
            username=connection.user,
        )
        session = connection.con._session
    elif isinstance(connection, pymapd.Connection):
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
