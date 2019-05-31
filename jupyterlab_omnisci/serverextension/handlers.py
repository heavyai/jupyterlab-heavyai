import os

from tornado import web

from jupyterlab_server.server import APIHandler

class OmniSciSessionHandler(APIHandler):
    @web.authenticated
    def get(self):
        session_file = 'omnisci_session.txt'
        port = os.environ.get('OMNISCI_PORT', '')
        host = os.environ.get('OMNISCI_HOST', '')
        protocol = os.environ.get('OMNISCI_PROTOCOL', '')
        session = ''
        with open(session_file) as f:
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
