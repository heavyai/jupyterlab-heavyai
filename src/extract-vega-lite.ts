import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { NotebookPanel } from '@jupyterlab/notebook';

import { DocumentRegistry } from '@jupyterlab/docregistry';

import { INotebookModel } from '@jupyterlab/notebook';

import { IDisposable, DisposableDelegate } from '@lumino/disposable';

import { extractTransforms } from 'vega-lite';
import { Kernel, KernelMessage } from '@jupyterlab/services';

const PLUGIN_ID = 'jupyterlab-omnisci:extract-vega-lite-plugin';

const plugin: JupyterFrontEndPlugin<void> = {
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
  context.sessionContext.kernelChanged.connect((_, { newValue, oldValue }) => {
    if (oldValue) {
      oldValue.removeCommTarget(COMM_TARGET, commTarget);
    }

    if (newValue) {
      newValue.registerCommTarget(COMM_TARGET, commTarget);
    }
  });
  return new DisposableDelegate(() => {
    // Don't know how to get current kernel anymore
    // if (context.sessionContext.kernel) {
    //   context.sessionContext.kernel.removeCommTarget(COMM_TARGET, commTarget);
    // }
  });
}
function activate(app: JupyterFrontEnd) {
  app.docRegistry.addWidgetExtension('Notebook', { createNew });
}
