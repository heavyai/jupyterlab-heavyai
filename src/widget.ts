import {
  JSONObject, PromiseDelegate
} from '@phosphor/coreutils';

import {
  Widget
} from '@phosphor/widgets';

import 'mapd-connector/dist/browser-connector.js';

declare const MapdCon: any

/**
 * The MIME type for png data.
 */
const IMAGE_MIME = 'image/png';

/**
 * A class for rendering a MapD-generated image.
 */
export
class MapDWidget extends Widget {
  /**
   * Construct a new MapD widget.
   */
  constructor(vega: JSONObject, connection: IMapDConnectionData) {
    super();
    this._img = document.createElement('img');
    this._error = document.createElement('pre');
    this._error.className = 'jp-MapD-Vega-Error';
    this.node.appendChild(this._img);
    this.node.appendChild(this._error);

    this._connection = connection;
    this._vega = vega;
    this._renderData();
  }

  get renderedImage(): Promise<string> {
    return this._rendered.promise;
  }

  private _renderData(): void {
    const connection = this._connection;
    const vega = this._vega;

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
            this._rendered.reject(error.message);
          } else {
            // Set the image data.
            this._setImageData(result.image);
            // Clear any error message.
            this._error.textContent = '';
            this._rendered.resolve(result.image);
          }
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

  private _rendered = new PromiseDelegate<string>();
  private _vega: JSONObject;
  private _connection: IMapDConnectionData;
  private _img: HTMLImageElement;
  private _error: HTMLElement;
}


/**
 * Connection data for the mapd browser client.
 */
export
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
 * A namespace for private data.
 */
namespace Private {
  export
  let id = 0;
}
