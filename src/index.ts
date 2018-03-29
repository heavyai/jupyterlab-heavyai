import {
  JSONObject
} from '@phosphor/coreutils';

import {
  Widget
} from '@phosphor/widgets';

import {
  IRenderMime
} from '@jupyterlab/rendermime-interfaces';

import './browser-connector.js';

declare let MapdCon: any;

import '../style/index.css';

/**
 * The MIME type for backend-rendered MapD.
 */
export
const MIME_TYPE = 'application/vnd.mapd.vega+json';

/**
 * The MIME type for png data.
 */
export
const IMAGE_MIME = 'image/png';

/**
 * A class for rendering a MapD-generated image.
 */
export
class RenderedMapD extends Widget implements IRenderMime.IRenderer {
  constructor() {
    super();
    this._img = document.createElement('img');
    this.node.appendChild(this._img);
  }

  /**
   * Render MapD image into this widget's node.
   */
  renderModel(model: IRenderMime.IMimeModel): Promise<void> {
    let imageData = model.data[IMAGE_MIME] as string;
    let vegaData = model.data[MIME_TYPE] as JSONObject;
    console.log(vegaData);
    if (imageData) {
      this._setImageData(imageData);
      return Promise.resolve(void 0);
    }

    return new Promise<void>(resolve => {
      new MapdCon()
        .protocol('https')
        .host('metis.mapd.com')
        .port('443')
        .dbName('mapd')
        .user('mapd')
        .password('HyperInteractive')
        .connect((error: any, con: any) => {
          con.renderVega(1, JSON.stringify(vegaData), {}, (error: any, result: any) => {
            if (error) {
              console.error(error.message);
            } else {
              model.setData({
                data: {
                  'image/png': result.image,
                  ...model.data
                },
                metadata: model.metadata
              });
              this._setImageData(result.image);
              resolve(void 0);
            }
          });
        });
    });
  }

  /**
   * Set the image data to a base64 encoded string.
   */
  private _setImageData(blob: string): void {
    let blobUrl = `data:${IMAGE_MIME};base64,${blob}`;
    this._img.src = blobUrl;
  }

  private _img: HTMLImageElement;
}


/**
 * A mime renderer factory for PDF data.
 */
export
const rendererFactory: IRenderMime.IRendererFactory = {
  safe: false,
  mimeTypes: [MIME_TYPE],
  defaultRank: 10,
  createRenderer: options => new RenderedMapD()
};


const extensions: IRenderMime.IExtension | IRenderMime.IExtension[] = [
  {
    id: 'jupyterlab-mapd:factory',
    rendererFactory,
    dataType: 'string',
  }
];

export default extensions;
