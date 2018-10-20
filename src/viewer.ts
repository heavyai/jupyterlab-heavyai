import { PromiseDelegate } from '@phosphor/coreutils';

import { Widget } from '@phosphor/widgets';

import { PathExt } from '@jupyterlab/coreutils';

import { Spinner, ToolbarButton } from '@jupyterlab/apputils';

import {
  ABCWidgetFactory,
  DocumentRegistry,
  DocumentWidget,
  IDocumentWidget
} from '@jupyterlab/docregistry';

import { IOmniSciConnectionData, showConnectionDialog } from './connection';

import { OmniSciVega } from './widget';

export class OmniSciViewer extends DocumentWidget<Widget> {
  constructor(
    context: DocumentRegistry.Context,
    connection?: IOmniSciConnectionData
  ) {
    super({
      context,
      reveal: context.ready.then(() => this._render()),
      content: new Widget()
    });

    this.toolbar.addClass('omnisci-OmniSci-toolbar');
    this.addClass('omnisci-OmniSciViewer-content');

    this.toolbar.addItem(
      'Render',
      new ToolbarButton({
        iconClassName: 'jp-RunIcon jp-Icon jp-Icon-16',
        onClick: () => {
          this._render();
        },
        tooltip: 'Render'
      })
    );
    this.toolbar.addItem(
      'Connect',
      new ToolbarButton({
        iconClassName: 'omnisci-OmniSci-logo jp-Icon jp-Icon-16',
        onClick: () => {
          const name = PathExt.basename(this.context.path);
          showConnectionDialog(
            `Set Connection for ${name}`,
            this._connection
          ).then(connection => {
            this._connection = connection;
          });
        },
        tooltip: 'Enter OmniSci Connection Data'
      })
    );
  }

  /**
   * The current connection data for the viewer.
   */
  get connection(): IOmniSciConnectionData {
    return this._connection;
  }
  set connection(value: IOmniSciConnectionData) {
    this._connection = value;
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
    if (!text || !this._connection) {
      return Promise.resolve(void 0);
    }
    const data = JSON.parse(text.replace(/\n/g, ''));
    this._widget = new OmniSciVega(data, this._connection);
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
  private _connection: IOmniSciConnectionData | undefined;
}

/**
 * A widget factory for images.
 */
export class OmniSciViewerFactory extends ABCWidgetFactory<
  IDocumentWidget<Widget>,
  DocumentRegistry.IModel
> {
  /**
   * Create a new widget given a context.
   */
  protected createNewWidget(
    context: DocumentRegistry.IContext<DocumentRegistry.IModel>
  ): OmniSciViewer {
    return new OmniSciViewer(context, this.defaultConnection);
  }

  /**
   * The current default connection data for viewers.
   */
  get defaultConnection(): IOmniSciConnectionData {
    return this._defaultConnection;
  }
  set defaultConnection(value: IOmniSciConnectionData) {
    this._defaultConnection = value;
  }

  private _defaultConnection: IOmniSciConnectionData | undefined;
}
