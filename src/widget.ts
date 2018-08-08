import { JSONObject, PromiseDelegate } from '@phosphor/coreutils';

import { Widget } from '@phosphor/widgets';

import { IMapDConnectionData } from './connection';

declare const MapdCon: any;

/**
 * The MIME type for png data.
 */
const IMAGE_MIME = 'image/png';

/**
 * A class for rendering a MapD-generated image.
 */
export class MapDVega extends Widget {
  /**
   * Construct a new MapD widget.
   */
  constructor(
    vega: JSONObject,
    connection: IMapDConnectionData,
    vegaLite?: JSONObject
  ) {
    super();
    this.addClass('mapd-MapDVega');
    this._img = document.createElement('img');
    this._error = document.createElement('pre');
    this._error.className = 'mapd-ErrorMessage';
    this.node.appendChild(this._img);
    this.node.appendChild(this._error);

    this._connection = connection;
    this._vega = vega;

    // _vegaLite is just for debugging, in case we get an error, we can show it.
    this._vegaLite = vegaLite;
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
      .dbName(connection.dbName)
      .user(connection.user)
      .password(connection.password)
      .connect((error: any, con: any) => {
        if (error) {
          // If there was an error, clear any image data,
          // and set the text content of the error node.
          this._setImageData('');
          this._error.textContent = error;
          this._rendered.reject(error);
          return;
        }
        con.renderVega(
          Private.id++,
          JSON.stringify(vega),
          {},
          (error: any, result: any) => {
            if (error) {
              // If there was an error, clear any image data,
              // and set the text content of the error node.
              this._setImageData('');
              this._error.textContent = error.message;
              if (this._vegaLite) {
                this._error.textContent += `\n\nVega Lite:\n${JSON.stringify(
                  this._vegaLite,
                  null,
                  2
                )}`;
              }
              this._error.textContent += `\n\nVega:\n${JSON.stringify(
                vega,
                null,
                2
              )}`;
              this._rendered.reject(error.message);
            } else {
              // Set the image data.
              this._setImageData(result.image);
              // Clear any error message.
              this._error.textContent = '';
              this._rendered.resolve(result.image);
            }
          }
        );
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
  private _vegaLite: JSONObject;
  private _connection: IMapDConnectionData;
  private _img: HTMLImageElement;
  private _error: HTMLElement;
}

/**
 * A namespace for private data.
 */
namespace Private {
  export let id = 0;
}
