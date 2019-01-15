import { PromiseDelegate } from '@phosphor/coreutils';

import { Widget } from '@phosphor/widgets';

import { PathExt } from '@jupyterlab/coreutils';

import { Spinner, ToolbarButton } from '@jupyterlab/apputils';

import {
  ABCWidgetFactory,
  DocumentRegistry,
  DocumentWidget
} from '@jupyterlab/docregistry';

import { IOmniSciConnectionData, showConnectionDialog } from './connection';

import { OmniSciVega } from './widget';

export class OmniSciVegaViewer extends DocumentWidget<Widget> {
  constructor(
    context: DocumentRegistry.Context,
    connectionData?: IOmniSciConnectionData
  ) {
    super({
      context,
      reveal: context.ready.then(() => this._render()),
      content: new Widget()
    });
    this._connectionData = connectionData;

    this.toolbar.addClass('omnisci-OmniSci-toolbar');
    this.addClass('omnisci-OmniSciVegaViewer');

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
            this._connectionData
          ).then(connectionData => {
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
  get connectionData(): IOmniSciConnectionData {
    return this._connectionData;
  }
  set connectionData(value: IOmniSciConnectionData) {
    this._connectionData = value;
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
    this._widget = new OmniSciVega(data, this._connectionData);
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
 * A widget factory for images.
 */
export class OmniSciVegaViewerFactory extends ABCWidgetFactory<
  OmniSciVegaViewer,
  DocumentRegistry.IModel
> {
  /**
   * Create a new widget given a context.
   */
  protected createNewWidget(
    context: DocumentRegistry.IContext<DocumentRegistry.IModel>
  ): OmniSciVegaViewer {
    return new OmniSciVegaViewer(context, this.defaultConnectionData);
  }

  /**
   * The current default connection data for viewers.
   */
  get defaultConnectionData(): IOmniSciConnectionData {
    return this._defaultConnectionData;
  }
  set defaultConnectionData(value: IOmniSciConnectionData) {
    this._defaultConnectionData = value;
  }

  private _defaultConnectionData: IOmniSciConnectionData | undefined;
}
