import { Widget } from '@phosphor/widgets';

import { IRenderMime } from '@jupyterlab/rendermime-interfaces';
import { extractTransforms, config } from 'vega-lite';

/**
 * The MIME type for backend-rendered OmniSci.
 */
export const MIME_TYPE = 'application/vnd.omnisci.extract-vega-lite+json';

export class ExtractVegaLite extends Widget implements IRenderMime.IRenderer {
  /**
   * Render OmniSci image into this widget's node.
   */
  renderModel(model: IRenderMime.IMimeModel): Promise<void> {
    const spec = model.data[MIME_TYPE] as any;
    const config_ = config.initConfig({});
    const extractedSpec = extractTransforms(spec, config_);
    this.node.innerHTML = `<pre>${JSON.stringify(
      extractedSpec,
      null,
      ' '
    )}</pre>`;
    return Promise.resolve();
  }
}

export const rendererFactory: IRenderMime.IRendererFactory = {
  safe: false,
  mimeTypes: [MIME_TYPE],
  defaultRank: 10,
  createRenderer: options => new ExtractVegaLite()
};

const extension: IRenderMime.IExtension = {
  id: 'jupyterlab-omnisci:extract-vega-lite',
  rendererFactory,
  dataType: 'string'
};

export default extension;
