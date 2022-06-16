import { JSONObject, PromiseDelegate } from '@lumino/coreutils';

import { Widget } from '@lumino/widgets';

import {
  IOmniSciConnectionData,
  makeConnection,
  OmniSciConnection
} from './connection';

/**
 * The MIME type for png data.
 */
const IMAGE_MIME = 'image/png';

/**
 * A class for rendering a OmniSci-generated image.
 */
export class OmniSciVega extends Widget {
  /**
   * Construct a new OmniSci widget.
   */
  constructor(options: OmniSciVega.IOptions) {
    super();
    this.addClass('omnisci-OmniSciVega');
    this._img = document.createElement('img');
    this._error = document.createElement('pre');
    this._error.className = 'omnisci-ErrorMessage';
    this.node.appendChild(this._img);
    this.node.appendChild(this._error);

    this._connectionPromise = makeConnection(
      options.connection,
      options.sessionId
    );
    this._vega = options.vega;

    // _vegaLite is just for debugging, in case we get an error, we can show it.
    this._vegaLite = options.vegaLite;
    void this._renderData();
  }

  get renderedImage(): Promise<string> {
    return this._rendered.promise;
  }

  private _renderData(): Promise<void> {
    const vega = this._vega;
    return new Promise<void>((resolve, reject) => {
      return this._connectionPromise
        .catch(error => {
          if (error) {
            // If there was an error, clear any image data,
            // and set the text content of the error node.
            this._setImageData('');
            this._error.textContent = error.error_msg || error;
            this._rendered.reject(error);
            return;
          }
        })
        .then(con => {
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
                this._rendered.reject(error);
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
  private _vegaLite: JSONObject | undefined;
  private _connectionPromise: Promise<OmniSciConnection>;
  private _img: HTMLImageElement;
  private _error: HTMLElement;
}

/**
 * A namespace for OmniSciVega statics.
 */
export namespace OmniSciVega {
  /**
   * Options used to create a new OmniSciVega widget.
   */
  export interface IOptions {
    /**
     * The vega spec to render.
     */
    vega: JSONObject;

    /**
     * Connection information.
     */
    connection: IOmniSciConnectionData;

    /**
     * An optional vega-lite spec which was used to generate the vega spec.
     * Only used for debugging purposes, can be shown upon errors.
     */
    vegaLite?: JSONObject;

    /**
     * An optional session ID for a pre-authenticated session.
     */
    sessionId?: string;
  }
}

/**
 * A namespace for private data.
 */
namespace Private {
  export let id = 0;
}
