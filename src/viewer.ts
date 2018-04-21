import {
  PromiseDelegate
} from '@phosphor/coreutils';

import {
  PanelLayout, Widget
} from '@phosphor/widgets';

import {
  Spinner, Toolbar, ToolbarButton
} from '@jupyterlab/apputils';

import {
  PathExt
} from '@jupyterlab/coreutils';

import {
  ABCWidgetFactory, DocumentRegistry
} from '@jupyterlab/docregistry';

import {
  IMapDConnectionData, showConnectionDialog
} from './connection';

import {
  MapDWidget
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
      this._render();
      context.model.contentChanged.connect(this.update, this);
      this._ready.resolve(void 0);
    });

    this.layout = new PanelLayout();
    this._toolbar = new Toolbar();
    this._content = new Widget();
    this._content.addClass('mapd-MapDViewer-content');

    (this.layout as PanelLayout).addWidget(this._toolbar);
    (this.layout as PanelLayout).addWidget(this._content);

    this._toolbar.addItem('Connect', new ToolbarButton({
      className: 'mapd-MapD-logo',
      onClick: () => {
        showConnectionDialog(this._connection).then(connection => {
          this._connection = connection;
        });
      },
      tooltip: 'Enter MapD Connection Data'
    }));
    this._toolbar.addItem('Render', new ToolbarButton({
      className: 'jp-RunIcon',
      onClick: () => {
        this._render();
      },
      tooltip: 'Render'
    }));
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
      this._content.node.removeChild(this._widget.node);
      this._widget.dispose();
      this._widget = null;
    }

    const text = this.context.model.toString();
    // If there is no data or no connection, do nothing
    if (!text || !this._connection) {
      return Promise.resolve (void 0);
    }
    const data = JSON.parse(text.replace(/\n/g, ''));
    this._widget = new MapDWidget(data, this._connection);
    this._content.node.appendChild(this._widget.node);
    const spinner = new Spinner();
    this._content.node.appendChild(spinner.node);
    return this._widget.renderedImage.then(() => {
      this._content.node.removeChild(spinner.node);
      spinner.dispose();
      return void 0;
    }).catch(() => {
      this._content.node.removeChild(spinner.node);
      spinner.dispose();
      return void 0;
    });
  }

  private _ready = new PromiseDelegate<void>();
  private _widget: MapDWidget | null = null;
  private _content: Widget;
  private _toolbar: Toolbar<any>;
  private _connection: IMapDConnectionData | undefined;
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
