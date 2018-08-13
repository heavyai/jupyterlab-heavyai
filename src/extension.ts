import {
  ILayoutRestorer,
  JupyterLab,
  JupyterLabPlugin
} from '@jupyterlab/application';

import { InstanceTracker } from '@jupyterlab/apputils';

import { IEditorServices } from '@jupyterlab/codeeditor';

import { ICompletionManager } from '@jupyterlab/completer';

import { ISettingRegistry } from '@jupyterlab/coreutils';

import { DocumentRegistry } from '@jupyterlab/docregistry';

import { ILauncher } from '@jupyterlab/launcher';

import { IMainMenu } from '@jupyterlab/mainmenu';

import { IMapDConnectionData, MapDCompletionConnector } from './connection';

import { MapDExplorer } from './grid';

import { MapDViewer, MapDViewerFactory } from './viewer';

/**
 * The name of the factory that creates pdf widgets.
 */
const FACTORY = 'MapDVega';

/**
 * Command IDs for the extension.
 */
namespace CommandIDs {
  export const newGrid = 'mapd:new-grid';

  export const invokeCompleter = 'mapd:invoke-completer';

  export const selectCompleter = 'mapd:select-completer';
}

/**
 * The MIME type for Vega.
 *
 * #### Notes
 * The version of this follows the major version of Vega.
 */
export const VEGA_MIME_TYPE = 'application/vnd.vega.v3+json';

export const EXTENSIONS = [
  '.vega',
  '.mapd.vega',
  '.mapd.vg.json',
  '.mapd.vega.json',
  '.vg.json',
  '.vega.json'
];

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
  iconClass: 'jp-MaterialIcon jp-VegaIcon'
};

/**
 * The pdf file handler extension.
 */
const mapdPlugin: JupyterLabPlugin<void> = {
  activate: activateMapDViewer,
  id: PLUGIN_ID,
  requires: [
    ICompletionManager,
    IEditorServices,
    ILauncher,
    ILayoutRestorer,
    IMainMenu,
    ISettingRegistry
  ],
  autoStart: true
};

function activateMapDViewer(
  app: JupyterLab,
  completionManager: ICompletionManager,
  editorServices: IEditorServices,
  launcher: ILauncher,
  restorer: ILayoutRestorer,
  mainMenu: IMainMenu,
  settingRegistry: ISettingRegistry
): void {
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

  const gridTracker = new InstanceTracker<MapDExplorer>({
    namespace: gridNamespace
  });

  // Handle state restoration.
  restorer.restore(gridTracker, {
    command: CommandIDs.newGrid,
    args: widget => ({ initialQuery: widget.content.query }),
    name: widget => widget.id
  });

  // Create a completion handler for each grid that is created.
  gridTracker.widgetAdded.connect((sender, explorer) => {
    const editor = explorer.input.editor;
    const connector = new MapDCompletionConnector(explorer.content.connection);
    const parent = explorer;
    const handle = completionManager.register({ connector, editor, parent });

    explorer.content.onModelChanged.connect(() => {
      handle.connector = new MapDCompletionConnector(
        explorer.content.connection
      );
    });
  });

  // Add grid completer command.
  app.commands.addCommand(CommandIDs.invokeCompleter, {
    execute: () => {
      const explorer = gridTracker.currentWidget;
      if (explorer) {
        return app.commands.execute('completer:invoke', { id: explorer.id });
      }
    }
  });

  // Add grid completer select command.
  app.commands.addCommand(CommandIDs.selectCompleter, {
    execute: () => {
      const explorer = gridTracker.currentWidget;
      if (explorer) {
        return app.commands.execute('completer:select', { id: explorer.id });
      }
    }
  });

  // Set enter key for grid completer select command.
  app.commands.addKeyBinding({
    command: CommandIDs.selectCompleter,
    keys: ['Enter'],
    selector: `.mapd-MapD-toolbar .jp-Editor.jp-mod-completer-active`
  });
  app.commands.addKeyBinding({
    command: CommandIDs.invokeCompleter,
    keys: ['Tab'],
    selector: `.mapd-MapD-toolbar .jp-Editor.jp-mod-completer-enabled`
  });

  app.commands.addCommand(CommandIDs.newGrid, {
    label: 'MapD Explorer',
    iconClass: 'mapd-MapD-logo',
    execute: args => {
      const query = (args['initialQuery'] as string) || '';
      const grid = new MapDExplorer({
        editorFactory: editorServices.factoryService.newInlineEditor,
        connection: factory.defaultConnection
      });
      grid.content.query = query;
      grid.id = `mapd-grid-widget-${++Private.id}`;
      grid.title.label = `MapD Explorer ${Private.id}`;
      grid.title.closable = true;
      grid.title.iconClass = 'mapd-MapD-logo';
      gridTracker.add(grid);
      app.shell.addToMainArea(grid);
      app.shell.activateById(grid.id);
      grid.content.onModelChanged.connect(() => {
        gridTracker.save(grid);
      });
      return grid;
    }
  });
  mainMenu.fileMenu.newMenu.addGroup([{ command: 'mapd:new-grid' }], 50);

  launcher.add({
    category: 'Other',
    rank: 0,
    command: CommandIDs.newGrid
  });

  // Update the default connection data for viewers that don't already
  // have it defined.
  const onSettingsUpdated = (settings: ISettingRegistry.ISettings) => {
    const defaultConnection = settings.get('defaultConnection').composite as
      | IMapDConnectionData
      | null
      | undefined;
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
      if (!grid.content.connection) {
        grid.content.connection = defaultConnection;
      }
    });
  };

  // Fetch the initial state of the settings.
  Promise.all([settingRegistry.load(PLUGIN_ID), app.restored])
    .then(([settings]) => {
      settings.changed.connect(onSettingsUpdated);
      onSettingsUpdated(settings);
    })
    .catch((reason: Error) => {
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
  export let id = 0;
}
