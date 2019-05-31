import os

from tornado import web

from jupyterlab_server.server import APIHandler

class OmniSciSessionHandler(APIHandler):
    @web.authenticated
    def get(self):
        port = os.environ['OMNISCI_PORT']
        host = os.environ['OMNISCI_HOST']
        protocol = os.environ['OMNISCI_PROTOCOL']
        with open('omnisci_session.txt') as f:
            session = f.read().strip()
        data = {
            'session': session,
            'connection': {
                'host': host,
                'port': port,
                'protocol': protocol,
            }
        }
        self.set_status(200)
        self.finish(data)
