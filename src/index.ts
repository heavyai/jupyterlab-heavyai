import {
  JSONObject
} from '@phosphor/coreutils';

import {
  Widget
} from '@phosphor/widgets';

import {
  IRenderMime
} from '@jupyterlab/rendermime-interfaces';

import 'mapd-connector/dist/browser-connector.js';

import '../style/index.css';

declare const MapdCon: any

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
  /**
   * Construct a new MapD widget.
   */
  constructor() {
    super();
    this._img = document.createElement('img');
    this._error = document.createElement('pre');
    this._error.className = 'jp-MapD-Vega-Error';
    this.node.appendChild(this._img);
    this.node.appendChild(this._error);
  }

  /**
   * Render MapD image into this widget's node.
   */
  renderModel(model: IRenderMime.IMimeModel): Promise<void> {
    // If there is an image already in the mime bundle,
    // we don't automatically rerun the query.
    // Instead, just display that.
    let imageData = model.data[IMAGE_MIME] as string;
    if (imageData) {
      this._setImageData(imageData);
      return Promise.resolve(void 0);
    }

    // Get the data from the mimebundle
    const data = model.data[MIME_TYPE] as IMapDMimeBundle;
    const { connection, vega } = data;

    return new Promise<void>(resolve => {
      // Launch the mapd connection.
      new MapdCon()
        .protocol(connection.protocol)
        .host(connection.host)
        .port(connection.port)
        .dbName(connection.dbname)
        .user(connection.user)
        .password(connection.password)
        .connect((error: any, con: any) => {
          con.renderVega(Private.id++, JSON.stringify(vega), {}, (error: any, result: any) => {
            if (error) {
              // If there was an error, clear any image data,
              // and set the text content of the error node.
              console.error(error.message);
              this._setImageData('');
              this._error.textContent = error.message;

            } else {
              // Set the mime data for the png.
              // This allows us to re-use the image if
              // we are loading from disk.
              model.setData({
                data: {
                  'image/png': result.image,
                  ...model.data
                },
                metadata: model.metadata
              });
              // Set the image data.
              this._setImageData(result.image);
              // Clear any error message.
              this._error.textContent = '';
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
  private _error: HTMLElement;
}

/**
 * Connection data for the mapd browser client.
 */
interface IMapDConnectionData extends JSONObject {
  /**
   * The host of the connection, e.g. `metis.mapd.com`.
   */
  host: string;

  /**
   * The protocol to use, e.g. `https`.
   */
  protocol: string;

  /**
   * The port to use, e.g. `443`.
   */
  port: string;

  /**
   * The user name.
   */
  user: string;

  /**
   * The database name.
   */
  dbname: string;

  /**
   * The password for the connection.
   */
  password: string;
}

/**
 * MapD renderer custom mimetype format.
 */
interface IMapDMimeBundle extends JSONObject {
  /**
   * Connection data containing all of the info
   * we need to make the connection.
   */
  connection: IMapDConnectionData;

  /**
   * The vega JSON object to render, including the SQL query.
   */
  vega: JSONObject;
}

/**
 * A mime renderer factory for mapd-vega data.
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


/**
 * A namespace for private data.
 */
namespace Private {
  export
  let id = 0;
}
