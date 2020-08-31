import { PromiseDelegate } from '@lumino/coreutils';

import { Widget } from '@lumino/widgets';

import { PathExt } from '@jupyterlab/coreutils';

import { Spinner, ToolbarButton } from '@jupyterlab/apputils';

import {
  ABCWidgetFactory,
  DocumentRegistry,
  DocumentWidget
} from '@jupyterlab/docregistry';

import {
  IOmniSciConnectionData,
  IOmniSciConnectionManager
} from './connection';

import { OmniSciVega } from './widget';

export class OmniSciVegaViewer extends DocumentWidget<Widget> {
  constructor(options: OmniSciVegaViewer.IOptions) {
    super({
      context: options.context,
      reveal: options.context.ready.then(() => this._render()),
      content: new Widget()
    });
    this._connectionData = options.manager.defaultConnection;

    this.toolbar.addClass('omnisci-OmniSci-toolbar');
    this.addClass('omnisci-OmniSciVegaViewer');

    this.toolbar.addItem(
      'Render',
      new ToolbarButton({
        iconClass: 'jp-RunIcon jp-Icon jp-Icon-16',
        onClick: () => {
          void this._render();
        },
        tooltip: 'Render'
      })
    );
    this.toolbar.addItem(
      'Connect',
      new ToolbarButton({
        iconClass: 'omnisci-OmniSci-logo jp-Icon jp-Icon-16',
        onClick: () => {
          const name = PathExt.basename(this.context.path);
          void options.manager
            .chooseConnection(
              `Set Connection for ${name}`,
              this._connectionData
            )
            .then(connectionData => {
              this._connectionData = connectionData;
            });
        },
        tooltip: 'Enter OmniSci Connection Data'
      })
    );
  }

  /**
   * The current connection data for the viewer.
   */
  get connectionData(): IOmniSciConnectionData | undefined {
    return this._connectionData;
  }
  set connectionData(value: IOmniSciConnectionData | undefined) {
    this._connectionData = value;
    void this._render();
  }

  /**
   * A promise that resolves when the viewer is ready.
   */
  get ready(): Promise<void> {
    return this._ready.promise;
  }

  /**
   * Render OmniSci into this widget's node.
   */
  private _render(): Promise<void> {
    if (this._widget) {
      this.content.node.removeChild(this._widget.node);
      this._widget.dispose();
      this._widget = null;
    }

    const text = this.context.model.toString();
    // If there is no data or no connection, do nothing
    if (!text || !this._connectionData) {
      return Promise.resolve(void 0);
    }
    const data = JSON.parse(text.replace(/\n/g, ''));
    this._widget = new OmniSciVega({
      vega: data,
      connection: this._connectionData
    });
    this.content.node.appendChild(this._widget.node);
    const spinner = new Spinner();
    this.content.node.appendChild(spinner.node);
    return this._widget.renderedImage
      .then(() => {
        this.content.node.removeChild(spinner.node);
        spinner.dispose();
        return void 0;
      })
      .catch(() => {
        this.content.node.removeChild(spinner.node);
        spinner.dispose();
        return void 0;
      });
  }

  private _ready = new PromiseDelegate<void>();
  private _widget: OmniSciVega | null = null;
  private _connectionData: IOmniSciConnectionData | undefined;
}

/**
 * A namespace for OmniSciVegaViewer statics.
 */
export namespace OmniSciVegaViewer {
  /**
   * Options to create a new document viewer.
   */
  export interface IOptions {
    /**
     * A context for the document.
     */
    context: DocumentRegistry.IContext<DocumentRegistry.IModel>;

    /**
     * An options manager for the document.
     */
    manager: IOmniSciConnectionManager;
  }
}

/**
 * A widget factory for images.
 */
export class OmniSciVegaViewerFactory extends ABCWidgetFactory<
  OmniSciVegaViewer,
  DocumentRegistry.IModel
> {
  constructor(options: OmniSciVegaViewerFactory.IOptions) {
    super(options);
    this._manager = options.manager;
  }

  /**
   * Create a new widget given a context.
   */
  protected createNewWidget(
    context: DocumentRegistry.IContext<DocumentRegistry.IModel>
  ): OmniSciVegaViewer {
    return new OmniSciVegaViewer({ context, manager: this._manager });
  }

  private _manager: IOmniSciConnectionManager;
}

export namespace OmniSciVegaViewerFactory {
  export interface IOptions extends DocumentRegistry.IWidgetFactoryOptions {
    /**
     * A connection manager.
     */
    manager: IOmniSciConnectionManager;
  }
}
