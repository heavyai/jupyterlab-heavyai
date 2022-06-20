from jupyterlab_server import LabConfig
from notebook.utils import url_path_join

from .handlers import HeavyAISessionHandler


def _jupyter_server_extension_paths():
    return [{"module": "jupyterlab_heavyai.serverextension"}]


def load_jupyter_server_extension(nb_server_app):
    """
    Called when the extension is loaded.

    Args:
        nb_server_app (NotebookWebApplication):
            handle to the Notebook webserver instance.
    """
    lab_config = LabConfig(config=nb_server_app.config)  # noqa
    web_app = nb_server_app.web_app
    base_url = web_app.settings["base_url"]
    lab_path = url_path_join(base_url)

    heavyai_session_endpoint = url_path_join(lab_path, "heavyai/session")
    print(heavyai_session_endpoint)
    handlers = [(heavyai_session_endpoint, HeavyAISessionHandler)]
    web_app.add_handlers(".*$", handlers)
