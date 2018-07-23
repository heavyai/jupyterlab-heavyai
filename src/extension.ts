import {
  ILayoutRestorer, JupyterLab, JupyterLabPlugin
} from '@jupyterlab/application';

import {
  InstanceTracker,
} from '@jupyterlab/apputils';

import {
  ISettingRegistry
} from '@jupyterlab/coreutils';

import {
  DocumentRegistry
} from '@jupyterlab/docregistry';

import {
  ILauncher
} from '@jupyterlab/launcher';

import {
  IMainMenu
} from '@jupyterlab/mainmenu';

import {
  IMapDConnectionData
} from './connection';

import {
  MapDGrid
} from './grid';

import {
  MapDViewer, MapDViewerFactory
} from './viewer';

/**
 * The name of the factory that creates pdf widgets.
 */
const FACTORY = 'MapDVega';

/**
 * Command IDs for the extension.
 */
namespace CommandIDs {
  export
  const newGrid = 'mapd:new-grid';
}

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

const PLUGIN_ID = 'jupyterlab-mapd:plugin';

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
  id: PLUGIN_ID,
  requires: [ ILauncher, ILayoutRestorer, IMainMenu, ISettingRegistry ],
  autoStart: true
};

function activateMapDViewer(app: JupyterLab, launcher: ILauncher, restorer: ILayoutRestorer, mainMenu: IMainMenu, settingRegistry: ISettingRegistry): void {
  const viewerNamespace = 'mapd-viewer-widget';
  const gridNamespace = 'mapd-grid-widget';

  const factory = new MapDViewerFactory({
    name: FACTORY,
    modelName: 'text',
    fileTypes: ['json', 'mapd-vega', 'vega3', 'vega3'],
    defaultFor: ['mapd-vega'],
    readOnly: true
  });
  const viewerTracker = new InstanceTracker<MapDViewer>({
    namespace: viewerNamespace
  });

  // Handle state restoration.
  restorer.restore(viewerTracker, {
    command: 'docmanager:open',
    args: widget => ({ path: widget.context.path, factory: FACTORY }),
    name: widget => widget.context.path
  });

  app.docRegistry.addFileType(mapdFileType);
  app.docRegistry.addWidgetFactory(factory);

  factory.widgetCreated.connect((sender, widget) => {
    viewerTracker.add(widget as MapDViewer);

    const types = app.docRegistry.getFileTypesForPath(widget.context.path);

    if (types.length > 0) {
      widget.title.iconClass = types[0].iconClass;
      widget.title.iconLabel = types[0].iconLabel;
    }
  });

  const gridTracker = new InstanceTracker<MapDGrid>({
    namespace: gridNamespace
  });

  // Handle state restoration.
  restorer.restore(gridTracker, {
    command: CommandIDs.newGrid,
    args: () => null,
    name: widget => widget.id
  });

  app.commands.addCommand(CommandIDs.newGrid, {
    label: 'MapD Explorer',
    iconClass: 'mapd-MapD-logo',
    execute: () => {
      const grid = new MapDGrid(factory.defaultConnection);
      grid.id = `mapd-grid-widget-${Private.id++}`;
      grid.title.label = `MapD Explorer ${Private.id}`;
      grid.title.closable = true;
      grid.title.iconClass = 'mapd-MapD-logo';
      gridTracker.add(grid);
      app.shell.addToMainArea(grid);
      app.shell.activateById(grid.id);
      return grid;
    }
  });
  mainMenu.fileMenu.newMenu.addGroup([{ command: 'mapd:new-grid'}], 50);

  launcher.add({
    category: 'Other',
    rank: 0,
    command: CommandIDs.newGrid
  });

  // Update the default connection data for viewers that don't already
  // have it defined.
  const onSettingsUpdated = (settings: ISettingRegistry.ISettings) => {
    const defaultConnection = settings.get('defaultConnection').composite as IMapDConnectionData | null | undefined;
    if (!defaultConnection) {
      return;
    }
    factory.defaultConnection = defaultConnection;
    viewerTracker.forEach(viewer => {
      if (!viewer.connection) {
        viewer.connection = defaultConnection;
      }
    });
    gridTracker.forEach(grid => {
      if (!grid.connection) {
        grid.connection = defaultConnection;
      }
    });
  };

  // Fetch the initial state of the settings.
  Promise.all([settingRegistry.load(PLUGIN_ID), app.restored])
  .then(([settings]) => {
    settings.changed.connect(onSettingsUpdated);
    onSettingsUpdated(settings);
  }).catch((reason: Error) => {
    console.error(reason.message);
  });
}

/**
 * Export the plugin as default.
 */
const plugin: JupyterLabPlugin<any> = mapdPlugin;
export default plugin;


/**
 * A namespace for private statics.
 */
namespace Private {
  export
  let id = 0;
}
