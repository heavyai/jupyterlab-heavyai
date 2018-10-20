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

import { IMapDConnectionData, showConnectionDialog } from './connection';

import { MapDVega } from './widget';

export class MapDViewer extends DocumentWidget<Widget> {
  constructor(
    context: DocumentRegistry.Context,
    connection?: IMapDConnectionData
  ) {
    super({
      context,
      reveal: context.ready.then(() => this._render()),
      content: new Widget()
    });

    this.toolbar.addClass('mapd-MapD-toolbar');
    this.addClass('mapd-MapDViewer-content');

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
        iconClassName: 'mapd-MapD-logo jp-Icon jp-Icon-16',
        onClick: () => {
          const name = PathExt.basename(this.context.path);
          showConnectionDialog(
            `Set Connection for ${name}`,
            this._connection
          ).then(connection => {
            this._connection = connection;
          });
        },
        tooltip: 'Enter MapD Connection Data'
      })
    );
  }

  /**
   * The current connection data for the viewer.
   */
  get connection(): IMapDConnectionData {
    return this._connection;
  }
  set connection(value: IMapDConnectionData) {
    this._connection = value;
  }

  /**
   * A promise that resolves when the viewer is ready.
   */
  get ready(): Promise<void> {
    return this._ready.promise;
  }

  /**
   * Render MapD into this widget's node.
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
    this._widget = new MapDVega(data, this._connection);
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
  private _widget: MapDVega | null = null;
  private _connection: IMapDConnectionData | undefined;
}

/**
 * A widget factory for images.
 */
export class MapDViewerFactory extends ABCWidgetFactory<
  IDocumentWidget<Widget>,
  DocumentRegistry.IModel
> {
  /**
   * Create a new widget given a context.
   */
  protected createNewWidget(
    context: DocumentRegistry.IContext<DocumentRegistry.IModel>
  ): MapDViewer {
    return new MapDViewer(context, this.defaultConnection);
  }

  /**
   * The current default connection data for viewers.
   */
  get defaultConnection(): IMapDConnectionData {
    return this._defaultConnection;
  }
  set defaultConnection(value: IMapDConnectionData) {
    this._defaultConnection = value;
  }

  private _defaultConnection: IMapDConnectionData | undefined;
}
