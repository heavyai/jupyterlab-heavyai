import {
  ILayoutRestorer,
  JupyterLab,
  JupyterLabPlugin
} from '@jupyterlab/application';

import { InstanceTracker, IThemeManager } from '@jupyterlab/apputils';

import { IEditorServices } from '@jupyterlab/codeeditor';

import { ICompletionManager } from '@jupyterlab/completer';

import { ISettingRegistry } from '@jupyterlab/coreutils';

import { DocumentRegistry } from '@jupyterlab/docregistry';

import { ILauncher } from '@jupyterlab/launcher';

import { IMainMenu } from '@jupyterlab/mainmenu';

import { DataGrid, TextRenderer } from '@phosphor/datagrid';

import {
  IMapDConnectionData,
  MapDCompletionConnector,
  showConnectionDialog
} from './connection';

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

  export const setConnection = 'mapd:set-connection';
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

const PLUGIN_ID = 'jupyterlab-omnisci:plugin';

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
 * The Omnisci file handler extension.
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
    ISettingRegistry,
    IThemeManager
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
  settingRegistry: ISettingRegistry,
  themeManager: IThemeManager
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
    // Set the theme for the new widget.
    explorer.content.style = style;
    explorer.content.renderer = renderer;
  });

  // The current styles for the data grids.
  let style: DataGrid.IStyle = Private.LIGHT_STYLE;
  let renderer: TextRenderer = Private.LIGHT_RENDERER;

  // Keep the themes up-to-date.
  const updateThemes = () => {
    const isLight = themeManager.isLight(themeManager.theme);
    style = isLight ? Private.LIGHT_STYLE : Private.DARK_STYLE;
    renderer = isLight ? Private.LIGHT_RENDERER : Private.DARK_RENDERER;
    gridTracker.forEach(grid => {
      grid.content.style = style;
      grid.content.renderer = renderer;
    });
  };
  themeManager.themeChanged.connect(updateThemes);

  // Add an application-wide connection-setting command.
  app.commands.addCommand(CommandIDs.setConnection, {
    execute: () => {
      showConnectionDialog(
        'Set Default Omnisci Connection',
        factory.defaultConnection
      ).then(connection => {
        settingRegistry.set(PLUGIN_ID, 'defaultConnection', connection);
      });
    },
    label: 'Set Default Omnisci Connection...'
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
  mainMenu.fileMenu.newMenu.addGroup([{ command: CommandIDs.newGrid }], 50);
  mainMenu.settingsMenu.addGroup([{ command: CommandIDs.setConnection }], 50);

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
 * A namespace for private data.
 */
namespace Private {
  /**
   * A counter for widget ids.
   */
  export let id = 0;

  /**
   * The light theme for the data grid.
   */
  export const LIGHT_STYLE: DataGrid.IStyle = {
    ...DataGrid.defaultStyle,
    voidColor: '#F3F3F3',
    backgroundColor: 'white',
    headerBackgroundColor: '#EEEEEE',
    gridLineColor: 'rgba(20, 20, 20, 0.15)',
    headerGridLineColor: 'rgba(20, 20, 20, 0.25)',
    rowBackgroundColor: i => (i % 2 === 0 ? '#F5F5F5' : 'white')
  };
  /**
   * The dark theme for the data grid.
   */
  export const DARK_STYLE: DataGrid.IStyle = {
    voidColor: 'black',
    backgroundColor: '#111111',
    headerBackgroundColor: '#424242',
    gridLineColor: 'rgba(235, 235, 235, 0.15)',
    headerGridLineColor: 'rgba(235, 235, 235, 0.25)',
    rowBackgroundColor: i => (i % 2 === 0 ? '#212121' : '#111111')
  };
  /**
   * The light renderer for the data grid.
   */
  export const LIGHT_RENDERER = new TextRenderer({
    textColor: '#111111',
    horizontalAlignment: 'right'
  });
  /**
   * The dark renderer for the data grid.
   */
  export const DARK_RENDERER = new TextRenderer({
    textColor: '#F5F5F5',
    horizontalAlignment: 'right'
  });
}
