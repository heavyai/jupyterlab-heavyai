import os

from tornado import web

from jupyterlab_server import LabConfig, LabHandler
from notebook.base.handlers import APIHandler

class OmniSciWorkspaceHandler(LabHandler):
    def initialize(self, lab_config):
        lab_config = LabConfig(config=lab_config)
        lab_config.templates_dir = '/home/ian/anaconda3/envs/omnisci/share/jupyter/lab/static'
        self.log.warn(lab_config.templates_dir)
        super().initialize(lab_config)

    """A handler that just delegates to the LabHandler"""
    pass

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
