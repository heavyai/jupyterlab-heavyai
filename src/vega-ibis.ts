import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { INotebookTracker } from '@jupyterlab/notebook';
import { IRenderMime } from '@jupyterlab/rendermime';
import { Widget } from '@phosphor/widgets';

import * as vega from 'vega';

import ibisTransform from './ibis-transform';
import { compileSpec } from './vega-compiler';
const PLUGIN_ID = 'jupyterlab-omnisci:vega-ibis';

const plugin: JupyterFrontEndPlugin<void> = {
  activate,
  id: PLUGIN_ID,
  requires: [INotebookTracker],
  autoStart: true
};
export default plugin;

const MIMETYPE = 'application/vnd.vega.ibis.v5+json';

const TRANSFORM = 'queryibis';

function activate(_: JupyterFrontEnd, notebooks: INotebookTracker) {
  notebooks.widgetAdded.connect((_, { context, content }) => {
    content.rendermime.addFactory(
      {
        safe: true,
        defaultRank: 50,
        mimeTypes: [MIMETYPE],
        createRenderer: () => new VegaIbisRenderer(context)
      },
      0
    );
  });
}

class VegaIbisRenderer extends Widget implements IRenderMime.IRenderer {
  constructor(
    private _context: DocumentRegistry.IContext<DocumentRegistry.IModel>
  ) {
    super();
  }
  async renderModel(model: IRenderMime.IMimeModel): Promise<void> {
    const vlSpec = model.data[MIMETYPE] as any;
    const kernel = this._context.session.kernel;

    if (kernel === null) {
      return;
    }
    ibisTransform.kernel = kernel;
    const vSpec = await compileSpec(kernel, vlSpec);
    const view = new vega.View(vega.parse(vSpec)).initialize(this.node);
    view.runAsync();
  }
}

(vega as any).transforms[TRANSFORM] = ibisTransform;
