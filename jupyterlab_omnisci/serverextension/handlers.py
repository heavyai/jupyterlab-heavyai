from tornado import web

from jupyterlab_server.server import APIHandler
from .config import OmniSciConfig


class OmniSciSessionHandler(APIHandler):
    """
    A tornado request handler to get OmniSci session data from the server.

    The implementation of the session manager is configurable,
    with the default provided by an `OmniSciSessionManager` instance.
    """

    @web.authenticated
    def get(self):
        """
        Handle a GET request"
        """
        # Create a config object
        c = OmniSciConfig(config=self.config)
        try:
            # Get session data from the session manager.
            data = c.omnisci_session_manager.get_session()
            self.set_status(200)
            self.finish(data)
        except Exception as e:
            self.set_status(500)
            self.finish(e)
