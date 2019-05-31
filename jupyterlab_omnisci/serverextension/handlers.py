import os

from tornado import web

from jupyterlab_server.server import APIHandler
from .config import OmniSciConfig

class OmniSciSessionHandler(APIHandler):
    @web.authenticated
    def get(self):
        # Create a config object
        c = OmniSciConfig(config=self.config)
        try:
            data = c.omnisci_session_manager.get_session()
            self.set_status(200)
            self.finish(data)
        except Exception as e:
            self.set_status(500)
            self.finish(e)
