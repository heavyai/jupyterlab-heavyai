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
        data = {
            'session': 'abc123',
            'connection': {
                'host': 'most',
                'port': 3,
                'protocol': 'ghost'
            }
        }
        self.set_status(200)
        self.finish(data)
