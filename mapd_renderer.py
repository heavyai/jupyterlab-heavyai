""" Functions for backend rendering with MapD """

import ast
import yaml

from IPython.core.magic import register_cell_magic
from IPython.display import display

class MapDBackendRenderer:
    """
    Class that produces a mimebundle that the notebook
    mapd renderer can understand.
    """
    def __init__(self, connection, data):
        """
        Initialize the backend renderer.

        Paramters
        =========

        connection: dict
            A dictionary containing the connection data for the mapd
            server. Must include 'user', 'password', 'host', 'port',
            'dbname', and 'protocol'

        data: dict
            Vega data to render.
        """
        self.connection = connection
        self.data = data

    def _repr_mimebundle_(self, include=None, exclude=None):
        """
        Return a mimebundle with 'application/vnd.mapd.vega+json'
        data, which is a custom mimetype for rendering mapd vega
        in Jupyter notebooks.
        """
        bundle = {
            'connection': self.connection,
            'vega': self.data
        }
        return {
            'application/vnd.mapd.vega+json': bundle
        }

@register_cell_magic
def mapd(line, cell):
    """
    Cell magic for rendering vega produced by the mapd backend.

    Usage: Initiate it with the line `%% mapd $connection_data`,
    where `connection_data` is the dictionary containing the connection
    data for the MapD server. The rest of the cell should be yaml-specified
    vega data.
    """
    connection_data = ast.literal_eval(line)
    vega = yaml.load(cell)
    display(MapDBackendRenderer(connection_data, vega))
