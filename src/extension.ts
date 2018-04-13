import {
  ILayoutRestorer, JupyterLab, JupyterLabPlugin
} from '@jupyterlab/application';

import {
  InstanceTracker,
} from '@jupyterlab/apputils';

import {
  DocumentRegistry
} from '@jupyterlab/docregistry';

import {
  MapDViewer, MapDViewerFactory
} from './viewer';

/**
 * The name of the factory that creates pdf widgets.
 */
const FACTORY = 'MapDVega';

/**
 * The MIME type for Vega.
 *
 * #### Notes
 * The version of this follows the major version of Vega.
 */
export
const VEGA_MIME_TYPE = 'application/vnd.vega.v3+json';

export
const EXTENSIONS = ['.vega', '.mapd.vega', '.mapd.vg.json',
  '.mapd.vega.json', '.vg.json', '.vega.json'];

/**
 * The MapD-Vega file type.
 */
const mapdFileType: Partial<DocumentRegistry.IFileType> = {
  name: 'mapd-vega',
  displayName: 'MapD Vega',
  fileFormat: 'text',
  extensions: EXTENSIONS,
  mimeTypes: [VEGA_MIME_TYPE],
  iconClass: 'jpMaterialIcon jp-VegaIcon'
};


/**
 * The pdf file handler extension.
 */
const mapdPlugin: JupyterLabPlugin<void> = {
  activate: activateMapDViewer,
  id: '@jupyterlab/mapd-extension:plugin',
  requires: [ ILayoutRestorer ],
  autoStart: true
};

function activateMapDViewer(app: JupyterLab, restorer: ILayoutRestorer): void {
  const namespace = 'mapd-widget';
  const factory = new MapDViewerFactory({
    name: FACTORY,
    modelName: 'text',
    fileTypes: ['json', 'mapd-vega', 'vega3', 'vega3'],
    defaultFor: ['mapd-vega'],
    readOnly: true
  });
  const tracker = new InstanceTracker<MapDViewer>({ namespace });

  // Handle state restoration.
  restorer.restore(tracker, {
    command: 'docmanager:open',
    args: widget => ({ path: widget.context.path, factory: FACTORY }),
    name: widget => widget.context.path
  });

  app.docRegistry.addFileType(mapdFileType);
  app.docRegistry.addWidgetFactory(factory);

  factory.widgetCreated.connect((sender, widget) => {
    // Notify the instance tracker if restore data needs to update.
    widget.context.pathChanged.connect(() => { tracker.save(widget); });
    tracker.add(widget);

    const types = app.docRegistry.getFileTypesForPath(widget.context.path);

    if (types.length > 0) {
      widget.title.iconClass = types[0].iconClass;
      widget.title.iconLabel = types[0].iconLabel;
    }
  });
}

/**
 * Export the plugin as default.
 */
const plugin: JupyterLabPlugin<any> = mapdPlugin;
export default plugin;
