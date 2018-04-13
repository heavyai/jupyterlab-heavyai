import {
  PromiseDelegate
} from '@phosphor/coreutils';

import {
  Widget
} from '@phosphor/widgets';

import {
  Message
} from '@phosphor/messaging';

import {
  PathExt
} from '@jupyterlab/coreutils';

import {
  ABCWidgetFactory, DocumentRegistry
} from '@jupyterlab/docregistry';

import {
  IMapDConnectionData, MapDWidget
} from './widget';

export
class MapDViewer extends Widget implements DocumentRegistry.IReadyWidget {
  constructor(context: DocumentRegistry.Context) {
    super();
    this.context = context;
    this._onTitleChanged();
    context.pathChanged.connect(this._onTitleChanged, this);

    context.ready.then(() => {
      if (this.isDisposed) {
        return;
      }
      this._render().then(() => {
        this._ready.resolve(void 0);
      });
      context.model.contentChanged.connect(this.update, this);
      context.fileChanged.connect(this.update, this);
    });
  }

  /**
   * The widget's context.
   */
  readonly context: DocumentRegistry.Context;

  /**
   * A promise that resolves when the viewer is ready.
   */
  get ready(): Promise<void> {
    return this._ready.promise;
  }

  /**
   * Handle a change to the title.
   */
  private _onTitleChanged(): void {
    this.title.label = PathExt.basename(this.context.localPath);
  }

  /**
   * Render MapD into this widget's node.
   */
  private _render(): Promise<void> {
    if (this._widget) {
      this._widget.dispose();
      this._widget = null;
    }

    const text = this.context.model.toString();
    // If there is no data, do nothing.
    if (!text) {
      return Promise.resolve (void 0);
    }
    const data = JSON.parse(text.replace(/\n/g, ''));
    let connection: IMapDConnectionData = {
      user: 'mapd',
      password: 'HyperInteractive',
      host: 'vega-demo.mapd.com',
      port: '9092',
      dbname: 'mapd',
      protocol: 'http'
    }
    this._widget = new MapDWidget(data, connection);
    this.node.appendChild(this._widget.node);
    return this._widget.renderedImage.then(() => void 0);
  }

  /**
   * Handle `update-request` messages for the widget.
   */
  protected onUpdateRequest(msg: Message): void {
    if (this.isDisposed || !this.context.isReady) {
      return;
    }
    this._render();
  }

  private _ready = new PromiseDelegate<void>();
  private _widget: MapDWidget | null = null;
}

/**
 * A widget factory for images.
 */
export
class MapDViewerFactory extends ABCWidgetFactory<MapDViewer, DocumentRegistry.IModel> {
  /**
   * Create a new widget given a context.
   */
  protected createNewWidget(context: DocumentRegistry.IContext<DocumentRegistry.IModel>): MapDViewer {
    return new MapDViewer(context);
  }
}
