import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { INotebookModel, NotebookPanel } from '@jupyterlab/notebook';
import { IRenderMimeRegistry, IRenderMime } from '@jupyterlab/rendermime';
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

const MIMETYPE = 'application/vnd.vega.ibis.v5+json';

const TRANSFORM = 'queryibis';

function createNew(
  nb: NotebookPanel,
  context: DocumentRegistry.IContext<INotebookModel>
): IDisposable {
  context.session.kernelChanged.connect((_, { newValue, oldValue }) => {
    if (newValue) {
      ibisTransform.kernel = newValue;
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
    createRenderer: options => new VegaIbisRenderer()
  });
}

class VegaIbisRenderer extends Widget implements IRenderMime.IRenderer {
  async renderModel(model: IRenderMime.IMimeModel): Promise<void> {
    const spec = model.data[MIMETYPE] as any;
    const view = new vega.View(vega.parse(spec)).initialize(this.node);
    view.runAsync();
  }
}

(vega as any).transforms[TRANSFORM] = ibisTransform;
