import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { INotebookModel, NotebookPanel } from '@jupyterlab/notebook';
import { IRenderMimeRegistry, IRenderMime } from '@jupyterlab/rendermime';
import { Kernel, KernelMessage } from '@jupyterlab/services';
import { DisposableDelegate, IDisposable } from '@phosphor/disposable';
import { Widget } from '@phosphor/widgets';

import * as vega from 'vega';
import ibisTransform from './ibis-transform';
const PLUGIN_ID = 'jupyterlab-omnisci:vega-ibis';

const plugin: JupyterFrontEndPlugin<void> = {
  activate,
  id: PLUGIN_ID,
  requires: [IRenderMimeRegistry],
  autoStart: true
};
export default plugin;

const COMM_ID = 'vega-ibis';

const MIMETYPE = 'application/vnd.vega.v5+json; ibis=true';

const TRANSFORM = 'queryibis';

function commTarget(comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) {
  // ibisTransform.conn(comm);
}

function createNew(
  nb: NotebookPanel,
  context: DocumentRegistry.IContext<INotebookModel>
): IDisposable {
  context.session.kernelChanged.connect((_, { newValue, oldValue }) => {
    if (newValue) {
      newValue.registerCommTarget(COMM_ID, commTarget);
    }
  });
  return new DisposableDelegate(() => {
    /* no-op */
  });
}

function activate(app: JupyterFrontEnd, rendermime: IRenderMimeRegistry) {
  app.docRegistry.addWidgetExtension('Notebook', { createNew });

  rendermime.addFactory({
    safe: true,
    defaultRank: 50,
    mimeTypes: [MIMETYPE],
    createRenderer: options => new Renderer()
  });
}

class Renderer extends Widget implements IRenderMime.IRenderer {
  async renderModel(model: IRenderMime.IMimeModel): Promise<void> {
    const spec = model.data[MIMETYPE] as any;
    const view = new vega.View(vega.parse(spec)).initialize(this.node);
    view.runAsync();
  }
}

(vega as any).transforms[TRANSFORM] = ibisTransform;
