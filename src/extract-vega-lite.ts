import { JupyterLab, JupyterLabPlugin } from '@jupyterlab/application';

import { NotebookPanel } from '@jupyterlab/notebook';

import { DocumentRegistry } from '@jupyterlab/docregistry';

import { INotebookModel } from '@jupyterlab/notebook';

import { IDisposable, DisposableDelegate } from '@phosphor/disposable';

import { extractTransforms, config } from 'vega-lite';
import { Kernel, KernelMessage } from '@jupyterlab/services';

const PLUGIN_ID = 'jupyterlab-omnisci:extract-vega-lite-plugin-2';

const plugin: JupyterLabPlugin<void> = {
  activate,
  id: PLUGIN_ID,
  autoStart: true
};
export default plugin;

const COMM_TARGET = 'some-unique-iddd';

function commTarget(comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) {
  console.log('comm target');
  const spec: any = msg.content.data;
  const config_ = config.initConfig({});
  const extractedSpec = extractTransforms(spec, config_);
  comm.send(extractedSpec as any);
}
function createNew(
  nb: NotebookPanel,
  context: DocumentRegistry.IContext<INotebookModel>
): IDisposable {
  console.log('creating new');
  context.session.kernelChanged.connect((_, { newValue, oldValue }) => {
    console.log('kernel changing');
    if (!newValue) {
      return;
    }
    console.log(`registering target for ${COMM_TARGET}`);
    newValue.registerCommTarget(COMM_TARGET, commTarget);
  });
  return new DisposableDelegate(() => {
    console.log('disposing');
  });
}
function activate(app: JupyterLab) {
  console.log('activating');
  app.docRegistry.addWidgetExtension('Notebook', { createNew });
}
