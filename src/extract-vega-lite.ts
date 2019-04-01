import { JupyterLab, JupyterLabPlugin } from '@jupyterlab/application';

import { NotebookPanel } from '@jupyterlab/notebook';

import { DocumentRegistry } from '@jupyterlab/docregistry';

import { INotebookModel } from '@jupyterlab/notebook';

import { IDisposable, DisposableDelegate } from '@phosphor/disposable';

import { extractTransforms } from 'vega-lite';
import { Kernel, KernelMessage } from '@jupyterlab/services';

const PLUGIN_ID = 'jupyterlab-omnisci:extract-vega-lite-plugin';

const plugin: JupyterLabPlugin<void> = {
  activate,
  id: PLUGIN_ID,
  autoStart: true
};
export default plugin;

const COMM_TARGET = 'extract-vega-lite';

function commTarget(comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) {
  const spec: any = msg.content.data;
  const extractedSpec = extractTransforms(spec, {});
  comm.send(extractedSpec as any);
}
function createNew(
  nb: NotebookPanel,
  context: DocumentRegistry.IContext<INotebookModel>
): IDisposable {
  context.session.kernelChanged.connect((_, { newValue, oldValue }) => {
    if (oldValue) {
      oldValue.removeCommTarget(COMM_TARGET, commTarget);
    }

    if (newValue) {
      newValue.registerCommTarget(COMM_TARGET, commTarget);
    }
  });
  return new DisposableDelegate(() => {
    if (context.session.kernel) {
      context.session.kernel.removeCommTarget(COMM_TARGET, commTarget);
    }
  });
}
function activate(app: JupyterLab) {
  app.docRegistry.addWidgetExtension('Notebook', { createNew });
}
