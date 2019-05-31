from jupyterlab_server import LabConfig, LabHandler

class OmniSciHandler(LabHandler):
    def initialize(self, lab_config):
        lab_config = LabConfig(config=lab_config)
        lab_config.templates_dir = '/home/ian/anaconda3/envs/omnisci/share/jupyter/lab/static'
        self.log.warn(lab_config.templates_dir)
        super().initialize(lab_config)

    """A handler that just delegates to the LabHandler"""
    pass
