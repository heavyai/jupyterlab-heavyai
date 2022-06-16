from tornado import web

from jupyterlab_server.server import APIHandler
from .config import HeavyAIConfig


class HeavyAISessionHandler(APIHandler):
    """
    A tornado request handler to get HeavyAI session data from the server.

    The implementation of the session manager is configurable,
    with the default provided by an `HeavyAISessionManager` instance.
    """

    @web.authenticated
    def get(self):
        """
        Handle a GET request"
        """
        # Create a config object
        c = HeavyAIConfig(config=self.config)
        try:
            # Get session data from the session manager.
            data = c.heavyai_session_manager.get_session()
            self.set_status(200)
            self.finish(data)
        except Exception as e:
            self.set_status(500)
            self.finish(e)
