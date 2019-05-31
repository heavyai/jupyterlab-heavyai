from notebook.utils import url_path_join

from jupyterlab_server import LabConfig

from .handlers import OmniSciSessionHandler
from .config import OmniSciConfig

def _jupyter_server_extension_paths():
    return [{"module": "jupyterlab_omnisci"}]


def load_jupyter_server_extension(nb_server_app):
    """
    Called when the extension is loaded.

    Args:
        nb_server_app (NotebookWebApplication): handle to the Notebook webserver instance.
    """
    lab_config = LabConfig(config=nb_server_app.config)
    omnisci_config = OmniSciConfig(config=nb_server_app.config)
    web_app = nb_server_app.web_app
    base_url = web_app.settings["base_url"]
    lab_path = url_path_join(base_url, lab_config.page_url)

    omnisci_session_endpoint = url_path_join(lab_path, "omnisci/session")
    handlers = [
        (
            omnisci_session_endpoint,
            OmniSciSessionHandler
        ),
    ]
    web_app.add_handlers(".*$", handlers)
