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
  IHeavyAIConnectionData,
  IHeavyAIConnectionManager
} from './connection';

import { HeavyAIVega } from './widget';

export class HeavyAIVegaViewer extends DocumentWidget<Widget> {
  constructor(options: HeavyAIVegaViewer.IOptions) {
    super({
      context: options.context,
      reveal: options.context.ready.then(() => this._render()),
      content: new Widget()
    });
    this._connectionData = options.manager.defaultConnection;

    this.toolbar.addClass('heavyai-HeavyAI-toolbar');
    this.addClass('heavyai-HeavyAIVegaViewer');

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
        iconClass: 'heavyai-HeavyAI-logo jp-Icon jp-Icon-16',
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
        tooltip: 'Enter HeavyAI Connection Data'
      })
    );
  }

  /**
   * The current connection data for the viewer.
   */
  get connectionData(): IHeavyAIConnectionData | undefined {
    return this._connectionData;
  }
  set connectionData(value: IHeavyAIConnectionData | undefined) {
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
   * Render HeavyAI into this widget's node.
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
    this._widget = new HeavyAIVega({
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
  private _widget: HeavyAIVega | null = null;
  private _connectionData: IHeavyAIConnectionData | undefined;
}

/**
 * A namespace for HeavyAIVegaViewer statics.
 */
export namespace HeavyAIVegaViewer {
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
    manager: IHeavyAIConnectionManager;
  }
}

/**
 * A widget factory for images.
 */
export class HeavyAIVegaViewerFactory extends ABCWidgetFactory<
  HeavyAIVegaViewer,
  DocumentRegistry.IModel
> {
  constructor(options: HeavyAIVegaViewerFactory.IOptions) {
    super(options);
    this._manager = options.manager;
  }

  /**
   * Create a new widget given a context.
   */
  protected createNewWidget(
    context: DocumentRegistry.IContext<DocumentRegistry.IModel>
  ): HeavyAIVegaViewer {
    return new HeavyAIVegaViewer({ context, manager: this._manager });
  }

  private _manager: IHeavyAIConnectionManager;
}

export namespace HeavyAIVegaViewerFactory {
  export interface IOptions extends DocumentRegistry.IWidgetFactoryOptions {
    /**
     * A connection manager.
     */
    manager: IHeavyAIConnectionManager;
  }
}
