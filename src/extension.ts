import {
  ILayoutRestorer,
  JupyterLab,
  JupyterLabPlugin
} from '@jupyterlab/application';

import { InstanceTracker, IThemeManager } from '@jupyterlab/apputils';

import { IEditorServices } from '@jupyterlab/codeeditor';

import { ICompletionManager } from '@jupyterlab/completer';

import { ISettingRegistry, IStateDB } from '@jupyterlab/coreutils';

import { DocumentRegistry } from '@jupyterlab/docregistry';

import { ILauncher } from '@jupyterlab/launcher';

import { IMainMenu } from '@jupyterlab/mainmenu';

import { NotebookModel } from '@jupyterlab/notebook';

import { PromiseDelegate } from '@phosphor/coreutils';

import { DataGrid, TextRenderer } from '@phosphor/datagrid';

import {
  IOmniSciConnectionData,
  OmniSciCompletionConnector,
  showConnectionDialog
} from './connection';

import { OmniSciSQLEditor } from './grid';

import { OmniSciVegaViewer, OmniSciVegaViewerFactory } from './viewer';

/**
 * The name of the factory that creates pdf widgets.
 */
const FACTORY = 'OmniSciVega';

/**
 * Command IDs for the extension.
 */
namespace CommandIDs {
  export const newGrid = 'omnisci:new-grid';

  export const invokeCompleter = 'omnisci:invoke-completer';

  export const selectCompleter = 'omnisci:select-completer';

  export const setConnection = 'omnisci:set-connection';
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
  '.omnisci.vega',
  '.omnisci.vg.json',
  '.omnisci.vega.json',
  '.vg.json',
  '.vega.json'
];

const PLUGIN_ID = 'jupyterlab-omnisci:plugin';

/**
 * The OmniSci-Vega file type.
 */
const omnisciFileType: Partial<DocumentRegistry.IFileType> = {
  name: 'omnisci-vega',
  displayName: 'OmniSci Vega',
  fileFormat: 'text',
  extensions: EXTENSIONS,
  mimeTypes: [VEGA_MIME_TYPE],
  iconClass: 'jp-MaterialIcon jp-VegaIcon'
};

/**
 * The Omnisci file handler extension.
 */
const omnisciPlugin: JupyterLabPlugin<void> = {
  activate: activateOmniSciVegaViewer,
  id: PLUGIN_ID,
  requires: [
    ICompletionManager,
    IEditorServices,
    ILauncher,
    ILayoutRestorer,
    IMainMenu,
    ISettingRegistry,
    IStateDB,
    IThemeManager
  ],
  autoStart: true
};

function activateOmniSciVegaViewer(
  app: JupyterLab,
  completionManager: ICompletionManager,
  editorServices: IEditorServices,
  launcher: ILauncher,
  restorer: ILayoutRestorer,
  mainMenu: IMainMenu,
  settingRegistry: ISettingRegistry,
  state: IStateDB,
  themeManager: IThemeManager
): void {
  const viewerNamespace = 'omnisci-viewer-widget';
  const gridNamespace = 'omnisci-grid-widget';

  const factory = new OmniSciVegaViewerFactory({
    name: FACTORY,
    modelName: 'text',
    fileTypes: ['json', 'omnisci-vega', 'vega3', 'vega4'],
    defaultFor: ['omnisci-vega'],
    readOnly: true
  });
  const viewerTracker = new InstanceTracker<OmniSciVegaViewer>({
    namespace: viewerNamespace
  });

  // Handle state restoration.
  restorer.restore(viewerTracker, {
    command: 'docmanager:open',
    args: widget => ({ path: widget.context.path, factory: FACTORY }),
    name: widget => widget.context.path
  });

  app.docRegistry.addFileType(omnisciFileType);
  app.docRegistry.addWidgetFactory(factory);

  factory.widgetCreated.connect((sender, widget) => {
    viewerTracker.add(widget);

    const types = app.docRegistry.getFileTypesForPath(widget.context.path);

    if (types.length > 0) {
      widget.title.iconClass = types[0].iconClass;
      widget.title.iconLabel = types[0].iconLabel;
    }
  });

  const gridTracker = new InstanceTracker<OmniSciSQLEditor>({
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
    const connector = new OmniSciCompletionConnector(
      explorer.content.connectionData
    );
    const parent = explorer;
    const handle = completionManager.register({ connector, editor, parent });

    explorer.content.onModelChanged.connect(() => {
      handle.connector = new OmniSciCompletionConnector(
        explorer.content.connectionData
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
        factory.defaultConnectionData
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
    selector: `.omnisci-OmniSci-toolbar .jp-Editor.jp-mod-completer-active`
  });
  app.commands.addKeyBinding({
    command: CommandIDs.invokeCompleter,
    keys: ['Tab'],
    selector: `.omnisci-OmniSci-toolbar .jp-Editor.jp-mod-completer-enabled`
  });

  app.commands.addCommand(CommandIDs.newGrid, {
    label: 'OmniSci SQL Editor',
    iconClass: 'omnisci-OmniSci-logo',
    execute: args => {
      const query = (args['initialQuery'] as string) || '';
      const grid = new OmniSciSQLEditor({
        editorFactory: editorServices.factoryService.newInlineEditor,
        connectionData: factory.defaultConnectionData
      });
      grid.content.query = query;
      grid.id = `omnisci-grid-widget-${++Private.id}`;
      grid.title.label = `OmniSci SQL Editor ${Private.id}`;
      grid.title.closable = true;
      grid.title.iconClass = 'omnisci-OmniSci-logo';
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
    const defaultConnectionData = settings.get('defaultConnection')
      .composite as IOmniSciConnectionData | null | undefined;
    if (!defaultConnectionData) {
      return;
    }
    factory.defaultConnectionData = defaultConnectionData;
    viewerTracker.forEach(viewer => {
      if (!viewer.connectionData) {
        viewer.connectionData = defaultConnectionData;
      }
    });
    gridTracker.forEach(grid => {
      if (!grid.content.connectionData) {
        grid.content.connectionData = defaultConnectionData;
      }
    });
  };

  const settingsLoaded = new PromiseDelegate<void>();
  // Fetch the initial state of the settings.
  Promise.all([settingRegistry.load(PLUGIN_ID), app.restored])
    .then(([settings]) => {
      settings.changed.connect(onSettingsUpdated);
      onSettingsUpdated(settings);
      settingsLoaded.resolve(void 0);
    })
    .catch((reason: Error) => {
      console.error(reason.message);
    });

  // Fetch the state, which is used to determine whether to create
  // an initial populated notebook.
  Promise.all([state.fetch(PLUGIN_ID), settingsLoaded]).then(
    async ([result]) => {
      // Determine whether to launch an initial notebook, then immediately
      // set that value to false. This state setting is intended to be set
      // by outside actors, rather than as true state restoration.
      let initial = false;
      if (result) {
        initial = !!(result as { initialNotebook: boolean }).initialNotebook;
      }
      state.save(PLUGIN_ID, { initialNotebook: false });

      if (initial) {
        // Create the notebook.
        const notebook = await app.commands.execute('notebook:create-new', {
          kernelName: 'python3'
        });
        // Move the notebook so it is in a split pane with the primary tab.
        // It has already been added, so this just has the effect of moving it.
        app.shell.addToMainArea(notebook, { mode: 'split-left' });

        await notebook.context.ready;

        // Define a function for injecting code into the notebook
        // on content changed. This is a somewhat ugly hack, as
        // the notebook model is not entirely ready when the context
        // is ready. Instead, it waits for a new stack frame to add
        // the initial cell. So as a workaround, we wait until there
        // is exactly one cell, then inject our code, then disconnect.
        const injectCode = (sender: NotebookModel) => {
          if (notebook.content.model.cells.length === 1) {
            let value = Private.IBIS_TEMPLATE;
            const connection = factory.defaultConnectionData;
            if (!connection) {
              return;
            }
            value = value.replace('{{host}}', connection.host);
            value = value.replace('{{protocol}}', connection.protocol);
            value = value.replace('{{password}}', connection.password);
            value = value.replace('{{database}}', connection.dbName);
            value = value.replace('{{user}}', connection.user);
            value = value.replace('{{port}}', connection.port);
            notebook.content.model.cells.get(0).value.text = value;
            notebook.content.model.contentChanged.disconnect(injectCode);
          }
        };
        notebook.content.model.contentChanged.connect(injectCode);
      }
    }
  );
}

/**
 * Export the plugin as default.
 */
const plugin: JupyterLabPlugin<any> = omnisciPlugin;
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

  /**
   * A template for an Ibis mapd client.
   */
  export const IBIS_TEMPLATE = `
import ibis

con = ibis.mapd.connect(
    host='{{host}}', user='{{user}}', password='{{password}}',
    port={{port}}, database='{{database}}', protocol='{{protocol}}'
)

con.list_tables()`.trim();
}
