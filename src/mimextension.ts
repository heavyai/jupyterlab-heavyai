import { JSONObject } from '@phosphor/coreutils';

import { Widget } from '@phosphor/widgets';

import { IRenderMime } from '@jupyterlab/rendermime-interfaces';

import { IOmniSciConnectionData } from './connection';

import { OmniSciVega } from './widget';

import { compileToVega } from './vega-lite';

import '../style/index.css';

/**
 * The MIME type for backend-rendered OmniSci.
 */
export const MIME_TYPE = 'application/vnd.omnisci.vega+json';

/**
 * The MIME type for png data.
 */
export const IMAGE_MIME = 'image/png';

/**
 * A class for rendering a OmniSci-generated image.
 */
export class RenderedOmniSci extends Widget implements IRenderMime.IRenderer {
  /**
   * Render OmniSci image into this widget's node.
   */
  renderModel(model: IRenderMime.IMimeModel): Promise<void> {
    // If we have already rendered a widget, dispose of it.
    if (this._widget) {
      this._widget.parent = null;
      this._widget.dispose();
      this._widget = null;
    }

    // If there is png image data in the mimebundle,
    // we can render that instead of making another
    // request to the backend.
    const imageData = model.data[IMAGE_MIME] as string;
    if (imageData) {
      this.node.appendChild(Private.createImageNode(imageData));
      return Promise.resolve(void 0);
    }

    // Get the data from the mimebundle
    const data = model.data[MIME_TYPE] as IOmniSciMimeBundle;
    const { connection, vega, vegalite } = data;

    // Create a new OmniSciVega
    this._widget = new OmniSciVega(
      vega || compileToVega(vegalite),
      connection,
      vegalite
    );
    this.node.appendChild(this._widget.node);
    return this._widget.renderedImage.then(data => {
      // Set the mime data for the png.
      // This allows us to re-use the image if
      // we are loading from disk.
      model.setData({
        data: {
          'image/png': data,
          ...model.data
        },
        metadata: model.metadata
      });
      return void 0;
    });
  }

  private _widget: OmniSciVega | null = null;
}

/**
 * OmniSci renderer custom mimetype format.
 */
interface IOmniSciMimeBundle extends JSONObject {
  /**
   * Connection data containing all of the info
   * we need to make the connection.
   */
  connection: IOmniSciConnectionData;

  /**
   * The vega JSON object to render, including the SQL query.
   */
  vega?: JSONObject;
  /**
   * The vega lite JSON object to render, including the SQL query.
   */
  vegalite?: JSONObject;
}

/**
 * A mime renderer factory for omnisci-vega data.
 */
export const rendererFactory: IRenderMime.IRendererFactory = {
  safe: false,
  mimeTypes: [MIME_TYPE],
  defaultRank: 10,
  createRenderer: options => new RenderedOmniSci()
};

const extensions: IRenderMime.IExtension | IRenderMime.IExtension[] = [
  {
    id: 'jupyterlab-omnisci:factory',
    rendererFactory,
    dataType: 'string'
  }
];

export default extensions;

/**
 * A namespace for private data.
 */
namespace Private {
  /**
   * Create an image node from a base64-encoded image.
   */
  export function createImageNode(blob: string): HTMLElement {
    const img = document.createElement('img');
    let blobUrl = `data:${IMAGE_MIME};base64,${blob}`;
    img.src = blobUrl;
    return img;
  }
}
