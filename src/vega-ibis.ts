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

import vegaEmbed from 'vega-embed';
import * as vegaLite from 'vega-lite';
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

const MIMETYPE = 'application/vnd.vegalite.v3+json; ibis=true';

const NAME_PREFIX = 'ibis-';

const TRANSFORM = 'ibis';

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
    const vlSpec: vegaLite.TopLevelSpec = model.data[MIMETYPE] as any;

    const { spec } = vegaLite.compile(vlSpec);

    transformVegaSpec(spec);

    await vegaEmbed(this.node, spec, {
      actions: true,
      defaultStyle: true,
      mode: 'vega'
    });
  }
}

/**
 * Moves all transforms into a custom transform inside a ibis transform
 */
function transformVegaSpec(vgSpec: vega.Spec): void {
  for (const data of vgSpec.data!) {
    if (!data.name.startsWith(NAME_PREFIX)) {
      continue;
    }
    const hash = data.name.substring(NAME_PREFIX.length);
    const transform = data.transform;
    data.transform = [
      // disable type checking because vega was not compiled with this transform
      { type: TRANSFORM, hash, transform } as any
    ];
  }
}

(vega as any).transforms[TRANSFORM] = ibisTransform;
