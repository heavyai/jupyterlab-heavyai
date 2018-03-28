// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

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
    let data = model.data[MIME_TYPE] as JSONObject;
    const exampleVega = {
      "width": 384,
      "height": 564,
      "data": [
        {
          "name": "tweets",
          "sql": "SELECT goog_x as x, goog_y as y, tweets_nov_feb.rowid FROM tweets_nov_feb"
        }
      ],
      "scales": [
        {
          "name": "x",
          "type": "linear",
          "domain": [
            -3650484.1235206556,
            7413325.514451755
          ],
          "range": "width"
        },
        {
          "name": "y",
          "type": "linear",
          "domain": [
            -5778161.9183506705,
            10471808.487466192
          ],
          "range": "height"
        }
      ],
      "marks": [
        {
          "type": "points",
          "from": {
            "data": "tweets"
          },
          "properties": {
            "x": {
              "scale": "x",
              "field": "x"
            },
            "y": {
              "scale": "y",
              "field": "y"
            },
            "fillColor": "blue",
            "size": {
              "value": 1
            }
          }
        }
      ]
    };

    new MapdCon()
      .protocol('https')
      .host('metis.mapd.com')
      .port('443')
      .dbName('mapd')
      .user('mapd')
      .password('HyperInteractive')
      .connect((error: any, con: any) => {
        con.renderVega(1, JSON.stringify(exampleVega), {}, (error: any, result: any) => {
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
            let blobUrl = `data:image/png;base64,${result.image}`;
            console.log(blobUrl);
            this._img.src = blobUrl;
          }
        });
      });
    console.log(data);
    return Promise.resolve(void 0);
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
