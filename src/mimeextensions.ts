import { JSONObject } from '@phosphor/coreutils';

import { ISignal, Signal } from '@phosphor/signaling';

import { SingletonLayout, Widget } from '@phosphor/widgets';

import { CodeMirrorEditorFactory } from '@jupyterlab/codemirror';

import { IRenderMime } from '@jupyterlab/rendermime-interfaces';

import { IOmniSciConnectionData } from './connection';

import { OmniSciVega } from './widget';

import { OmniSciSQLEditor } from './grid';

import { compileToVega } from './vega-lite';

import '../style/index.css';

/**
 * The MIME type for backend-rendered vega.
 */
export const VEGA_MIME_TYPE = 'application/vnd.omnisci.vega+json';

/**
 * The MIME type for a SQL editor.
 */
export const SQL_EDITOR_MIME_TYPE = 'application/vnd.omnisci.sqleditor+json';

/**
 * The MIME type for png data.
 */
export const IMAGE_MIME = 'image/png';

/**
 * A class for rendering a OmniSci-generated image.
 */
export class RenderedOmniSciVega extends Widget
  implements IRenderMime.IRenderer {
  /**
   * Construct the rendered vega widget.
   */
  constructor() {
    super();
    this.layout = new SingletonLayout();
  }

  /**
   * Render OmniSci image into this widget's node.
   */
  renderModel(model: IRenderMime.IMimeModel): Promise<void> {
    const layout = this.layout as SingletonLayout;
    // If we have already rendered a widget, dispose of it.
    if (layout.widget) {
      layout.widget = null;
    }

    // If there is png image data in the mimebundle,
    // we can render that instead of making another
    // request to the backend.
    const imageData = model.data[IMAGE_MIME] as string;
    if (imageData) {
      layout.widget = new Widget({ node: Private.createImageNode(imageData) });
      return Promise.resolve(void 0);
    }

    // Get the data from the mimebundle
    const data = (model.data[
      VEGA_MIME_TYPE
    ] as unknown) as IOmniSciVegaMimeBundle;
    const { connection, vega, vegalite } = data;

    // Create a new OmniSciVega
    const vegaWidget = new OmniSciVega(
      vega || compileToVega(vegalite),
      connection,
      vegalite
    );
    layout.widget = vegaWidget;
    return vegaWidget.renderedImage
      .then(data => {
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
      })
      .catch(() => void 0); // Catch errors, the default error rendering is OK.
  }
}

/**
 * OmniSci renderer custom mimetype format.
 */
interface IOmniSciVegaMimeBundle {
  /**
   * Connection data containing all of the info
   * we need to make the connection.
   */
  connection: IOmniSciConnectionData;

  /**
   * A session ID for a pre-authenticated session.
   */
  sessionId?: string;

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
 * A class for rendering a OmniSci-generated image.
 */
export class RenderedOmniSciSQLEditor extends Widget
  implements IRenderMime.IRenderer {
  /**
   * Construct the rendered sql editor widget.
   */
  constructor() {
    super();
    this.layout = new SingletonLayout();
    this.addClass('omnisci-RenderedOmniSciSQLEditor');
    this._widget = new OmniSciSQLEditor({
      editorFactory: Private.editorFactory
    });
    (this.layout as SingletonLayout).widget = this._widget;
  }

  /**
   * Get the underlying SQL editor.
   */
  get widget(): OmniSciSQLEditor {
    return this._widget;
  }

  /**
   * Render the SQL editor into this widget's node.
   */
  renderModel(model: IRenderMime.IMimeModel): Promise<void> {
    // Get the data from the mimebundle
    const data = (model.data[
      SQL_EDITOR_MIME_TYPE
    ] as unknown) as IOmniSciSQLEditorMimeBundle;
    if (!data) {
      return Promise.resolve(void 0);
    }
    this._widget.content.setConnectionData(data.connection, data.sessionId);
    this._widget.content.query = data.query || '';
    return Promise.resolve(void 0);
  }

  private _widget: OmniSciSQLEditor;
}

/**
 * OmniSci renderer custom mimetype format.
 */
interface IOmniSciSQLEditorMimeBundle {
  /**
   * Connection data containing all of the info
   * we need to make the connection.
   */
  connection: IOmniSciConnectionData;

  /**
   * A session ID for a pre-authenticated session.
   */
  sessionId?: string;

  /**
   * The initial SQL query.
   */
  query?: string;
}
/**
 * A mime renderer factory for omnisci-vega data.
 */
export const vegaRendererFactory: IRenderMime.IRendererFactory = {
  safe: false,
  mimeTypes: [VEGA_MIME_TYPE],
  defaultRank: 10,
  createRenderer: options => new RenderedOmniSciVega()
};

/**
 * An interface for a SQL editor renderer factory that also exposes
 * a signal that fires when a renderer is created. We can subscribe
 * to this signal in the regular extensions in order to do some extra
 * work like setting up theming and completers. This is a slight abuse
 * of the mimerenderer system.
 */
export interface ISQLEditorRendererFactory
  extends IRenderMime.IRendererFactory {
  rendererCreated: ISignal<void, RenderedOmniSciSQLEditor>;
}
/**
 * A mime renderer factory for omnisci-sql-editor data.
 */
export const sqlEditorRendererFactory: ISQLEditorRendererFactory = {
  safe: false,
  mimeTypes: [SQL_EDITOR_MIME_TYPE],
  defaultRank: 10,
  createRenderer: options => {
    const rendered = new RenderedOmniSciSQLEditor();
    rendered.id = `sql-editor-mime-renderer-${++Private.id}`;
    (sqlEditorRendererFactory.rendererCreated as Signal<
      any,
      RenderedOmniSciSQLEditor
    >).emit(rendered);
    return rendered;
  },
  rendererCreated: new Signal<any, RenderedOmniSciSQLEditor>({})
};

const extensions: IRenderMime.IExtension | IRenderMime.IExtension[] = [
  {
    id: 'jupyterlab-omnisci:vega-factory',
    rendererFactory: vegaRendererFactory,
    dataType: 'string'
  },
  {
    id: 'jupyterlab-omnisci:sqleditor-factory',
    rendererFactory: sqlEditorRendererFactory,
    dataType: 'string'
  }
];

export default extensions;

/**
 * A namespace for private data.
 */
namespace Private {
  /**
   * An incrementing DOM id for sql editor mime renderers.
   * The completer needs a DOM ID for attaching, so we must add one here.
   */
  export let id = 0;

  /**
   * A default codemirror editor factory for the SQL editor.
   * Since we cannot request the IEditorServices token with a mimeextension,
   * this is a workaround.
   */
  const editorServices = new CodeMirrorEditorFactory();
  export const editorFactory = editorServices.newInlineEditor;

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
