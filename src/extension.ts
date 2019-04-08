import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  ICommandPalette,
  InstanceTracker,
  IThemeManager
} from '@jupyterlab/apputils';

import { IEditorServices } from '@jupyterlab/codeeditor';

import { ICompletionManager } from '@jupyterlab/completer';

import { ISettingRegistry, IStateDB } from '@jupyterlab/coreutils';

import { DocumentRegistry } from '@jupyterlab/docregistry';

import { ILauncher } from '@jupyterlab/launcher';

import { IMainMenu } from '@jupyterlab/mainmenu';

import {
  INotebookModel,
  INotebookTracker,
  NotebookModel
} from '@jupyterlab/notebook';

import { JSONExt, JSONObject, PromiseDelegate } from '@phosphor/coreutils';

import { DataGrid, TextRenderer } from '@phosphor/datagrid';

import { Widget } from '@phosphor/widgets';

import {
  IOmniSciConnectionData,
  OmniSciCompletionConnector,
  showConnectionDialog
} from './connection';

import { OmniSciSQLEditor } from './grid';

import { OmniSciVegaViewer, OmniSciVegaViewerFactory } from './viewer';

import {
  RenderedOmniSciSQLEditor,
  sqlEditorRendererFactory
} from './mimeextensions';

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

  export const injectIbisConnection = 'omnisci:inject-ibis-connection';
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

const CONNECTION_PLUGIN_ID = 'jupyterlab-omnisci:connection';

const VEGA_PLUGIN_ID = 'jupyterlab-omnisci:vega';

const SQL_EDITOR_PLUGIN_ID = 'jupyterlab-omnisci:sql-editor';

const INITIAL_NOTEBOOK_PLUGIN_ID = 'jupyterlab-omnisci:initial_notebook';

/**
 * The Omnisci connection handler extension.
 */
const omnisciConnectionPlugin: JupyterFrontEndPlugin<void> = {
  activate: activateOmniSciConnection,
  id: CONNECTION_PLUGIN_ID,
  requires: [ICommandPalette, IMainMenu, ISettingRegistry],
  autoStart: true
};

function activateOmniSciConnection(
  app: JupyterFrontEnd,
  palette: ICommandPalette,
  mainMenu: IMainMenu,
  settingRegistry: ISettingRegistry
): void {
  let defaultConnectionData: IOmniSciConnectionData;
  let servers: IOmniSciConnectionData[] = [];

  // Add an application-wide connection-setting command.
  app.commands.addCommand(CommandIDs.setConnection, {
    execute: () => {
      showConnectionDialog(
        'Set Default Omnisci Connection',
        defaultConnectionData
      ).then(connection => {
        connection.master = false; // Temporarily set to false.
        // First loop through the existing servers and unset the master attribute.
        servers.forEach(s => {
          s.master = false;
        });
        // Next loop through the existing servers and see if one already
        // matches the new one.
        const match = servers.find(s => {
          return JSONExt.deepEqual(s as JSONObject, connection as JSONObject);
        });
        // If we found one, set it to the master server.
        if (match) {
          match.master = true;
        } else {
          connection.master = true;
          servers = [connection, ...servers];
        }
        settingRegistry.set(
          CONNECTION_PLUGIN_ID,
          'servers',
          (servers as unknown) as JSONObject
        );
      });
    },
    label: 'Set Default Omnisci Connection...'
  });

  // Update the default connection data for viewers that don't already
  // have it defined.
  const onSettingsUpdated = (settings: ISettingRegistry.ISettings) => {
    const newServers = (settings.get('servers').composite as unknown) as
      | IOmniSciConnectionData[]
      | undefined;
    // If there is no server data, return.
    if (!newServers || newServers.length === 0) {
      return;
    }
    servers = newServers;
    // Search for a server marked as "master". If that is not found, just
    // use the first one in the list.
    defaultConnectionData = servers.find(s => s.master === true) || servers[0];
  };

  // Fetch the initial state of the settings.
  Promise.all([settingRegistry.load(CONNECTION_PLUGIN_ID), app.restored])
    .then(([settings]) => {
      settings.changed.connect(onSettingsUpdated);
      onSettingsUpdated(settings);
    })
    .catch((reason: Error) => {
      console.error(reason.message);
    });
  mainMenu.settingsMenu.addGroup([{ command: CommandIDs.setConnection }], 50);
  palette.addItem({ command: CommandIDs.setConnection, category: 'OmniSci' });
}
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
 * The Omnisci vega file handler extension.
 */
const omnisciVegaPlugin: JupyterFrontEndPlugin<void> = {
  activate: activateOmniSciVegaViewer,
  id: VEGA_PLUGIN_ID,
  requires: [ILayoutRestorer, ISettingRegistry],
  autoStart: true
};

function activateOmniSciVegaViewer(
  app: JupyterFrontEnd,
  restorer: ILayoutRestorer,
  settingRegistry: ISettingRegistry
): void {
  const viewerNamespace = 'omnisci-viewer-widget';

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

  // Update the default connection data for viewers that don't already
  // have it defined.
  const onSettingsUpdated = (settings: ISettingRegistry.ISettings) => {
    const servers = (settings.get('servers').composite as unknown) as
      | IOmniSciConnectionData[]
      | undefined;
    // If there is no server data, return.
    if (!servers || servers.length === 0) {
      return;
    }
    // Search for a server marked as "master". If that is not found, just
    // use the first one in the list.
    const defaultConnectionData =
      servers.find(s => s.master === true) || servers[0];
    factory.defaultConnectionData = defaultConnectionData;
    viewerTracker.forEach(viewer => {
      if (!viewer.connectionData) {
        viewer.connectionData = defaultConnectionData;
      }
    });
  };

  // Fetch the initial state of the settings.
  Promise.all([settingRegistry.load(CONNECTION_PLUGIN_ID), app.restored])
    .then(([settings]) => {
      settings.changed.connect(onSettingsUpdated);
      onSettingsUpdated(settings);
    })
    .catch((reason: Error) => {
      console.error(reason.message);
    });
}

/**
 * The Omnisci SQL editor extension.
 */
const omnisciGridPlugin: JupyterFrontEndPlugin<void> = {
  activate: activateOmniSciGridViewer,
  id: SQL_EDITOR_PLUGIN_ID,
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

function activateOmniSciGridViewer(
  app: JupyterFrontEnd,
  completionManager: ICompletionManager,
  editorServices: IEditorServices,
  launcher: ILauncher,
  restorer: ILayoutRestorer,
  mainMenu: IMainMenu,
  settingRegistry: ISettingRegistry,
  state: IStateDB,
  themeManager: IThemeManager
): void {
  const gridNamespace = 'omnisci-grid-widget';
  const mimeGridNamespace = 'omnisci-mime-grid-widget';

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
    mimeGridTracker.forEach(mimeGrid => {
      mimeGrid.widget.content.style = style;
      mimeGrid.widget.content.renderer = renderer;
    });
  };
  themeManager.themeChanged.connect(updateThemes);

  // This is a workaround for some of the limitations of mimerenderer extensions.
  // We want to hook up the theming information and tab-completions to the SQL
  // editor mime renderer, but that requires some full-extension machinery.
  // So we extend the renderer factory with a "created" signal, and when that
  // fires, do some extra work in the real extension.
  const mimeGridTracker = new InstanceTracker<RenderedOmniSciSQLEditor>({
    namespace: mimeGridNamespace
  });
  // Add the new renderer to an instance tracker when it is created.
  // This will track whether that instance has focus or not.
  sqlEditorRendererFactory.rendererCreated.connect((sender, mime) => {
    mimeGridTracker.add(mime);
  });
  // When a new grid widget is added, hook up the machinery for
  // completions and theming.
  mimeGridTracker.widgetAdded.connect((sender, mime) => {
    const editor = mime.widget.input.editor;
    const connector = new OmniSciCompletionConnector(
      mime.widget.content.connectionData
    );
    const parent = mime;
    const handle = completionManager.register({ connector, editor, parent });

    mime.widget.content.onModelChanged.connect(() => {
      handle.connector = new OmniSciCompletionConnector(
        mime.widget.content.connectionData
      );
    });
    mime.widget.content.style = style;
    mime.widget.content.renderer = renderer;
  });

  // Add grid completer command.
  app.commands.addCommand(CommandIDs.invokeCompleter, {
    execute: () => {
      let anchor: Widget | undefined;
      const current = app.shell.currentWidget;
      if (current && current === gridTracker.currentWidget) {
        anchor = gridTracker.currentWidget;
      } else if (current && current.contains(mimeGridTracker.currentWidget)) {
        anchor = mimeGridTracker.currentWidget;
      }
      if (anchor) {
        return app.commands.execute('completer:invoke', { id: anchor.id });
      }
    }
  });

  // Add grid completer select command.
  app.commands.addCommand(CommandIDs.selectCompleter, {
    execute: () => {
      let anchor: Widget | undefined;
      const current = app.shell.currentWidget;
      if (current && current === gridTracker.currentWidget) {
        anchor = gridTracker.currentWidget;
      } else if (current && current.contains(mimeGridTracker.currentWidget)) {
        anchor = mimeGridTracker.currentWidget;
      }
      if (anchor) {
        return app.commands.execute('completer:select', { id: anchor.id });
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

  let defaultConnectionData: IOmniSciConnectionData | undefined;

  app.commands.addCommand(CommandIDs.newGrid, {
    label: 'OmniSci SQL Editor',
    iconClass: 'omnisci-OmniSci-logo',
    execute: args => {
      const query = (args['initialQuery'] as string) || '';
      const grid = new OmniSciSQLEditor({
        editorFactory: editorServices.factoryService.newInlineEditor,
        connectionData: defaultConnectionData
      });
      grid.content.query = query;
      grid.id = `omnisci-grid-widget-${++Private.id}`;
      grid.title.label = `OmniSci SQL Editor ${Private.id}`;
      grid.title.closable = true;
      grid.title.iconClass = 'omnisci-OmniSci-logo';
      gridTracker.add(grid);
      app.shell.add(grid, 'main');
      app.shell.activateById(grid.id);
      grid.content.onModelChanged.connect(() => {
        gridTracker.save(grid);
      });
      return grid;
    }
  });
  mainMenu.fileMenu.newMenu.addGroup([{ command: CommandIDs.newGrid }], 50);

  launcher.add({
    category: 'Other',
    rank: 0,
    command: CommandIDs.newGrid
  });

  // Update the default connection data for viewers that don't already
  // have it defined.
  const onSettingsUpdated = (settings: ISettingRegistry.ISettings) => {
    const servers = (settings.get('servers').composite as unknown) as
      | IOmniSciConnectionData[]
      | undefined;
    // If there is no server data, return.
    if (!servers || servers.length === 0) {
      return;
    }
    // Search for a server marked as "master". If that is not found, just
    // use the first one in the list.
    defaultConnectionData = servers.find(s => s.master === true) || servers[0];

    gridTracker.forEach(grid => {
      if (!grid.content.connectionData) {
        grid.content.connectionData = defaultConnectionData;
      }
    });
  };

  const settingsLoaded = new PromiseDelegate<void>();
  // Fetch the initial state of the settings.
  Promise.all([settingRegistry.load(CONNECTION_PLUGIN_ID), app.restored])
    .then(([settings]) => {
      settings.changed.connect(onSettingsUpdated);
      onSettingsUpdated(settings);
      settingsLoaded.resolve(void 0);
    })
    .catch((reason: Error) => {
      console.error(reason.message);
    });
}

/**
 * The Omnisci inital notebook extension.
 */
const omnisciInitialNotebookPlugin: JupyterFrontEndPlugin<void> = {
  activate: activateOmniSciInitialNotebook,
  id: INITIAL_NOTEBOOK_PLUGIN_ID,
  requires: [ICommandPalette, INotebookTracker, ISettingRegistry, IStateDB],
  autoStart: true
};

function activateOmniSciInitialNotebook(
  app: JupyterFrontEnd,
  palette: ICommandPalette,
  tracker: INotebookTracker,
  settingRegistry: ISettingRegistry,
  state: IStateDB
): void {
  const settingsLoaded = new PromiseDelegate<void>();
  let defaultConnectionData: IOmniSciConnectionData | undefined;

  // Add a command to inject the ibis connection data into the active notebook.
  app.commands.addCommand(CommandIDs.injectIbisConnection, {
    label: 'Inject Ibis OmniSci Connection',
    execute: () => {
      let current = tracker.currentWidget;
      if (!current || !defaultConnectionData) {
        return;
      }
      Private.injectIbisConnection(
        current.content.model,
        defaultConnectionData
      );
    },
    isEnabled: () => !!tracker.currentWidget
  });

  palette.addItem({
    command: CommandIDs.injectIbisConnection,
    category: 'OmniSci'
  });

  // Fetch the initial state of the settings.
  Promise.all([settingRegistry.load(CONNECTION_PLUGIN_ID), app.restored])
    .then(([settings]) => {
      const servers = (settings.get('servers').composite as unknown) as
        | IOmniSciConnectionData[]
        | undefined;
      // If there is no server data, return.
      if (!servers || servers.length === 0) {
        return;
      }
      // Search for a server marked as "master". If that is not found, just
      // use the first one in the list.
      defaultConnectionData =
        servers.find(s => s.master === true) || servers[0];
      settingsLoaded.resolve(void 0);
    })
    .catch((reason: Error) => {
      console.error(reason.message);
    });

  // Fetch the state, which is used to determine whether to create
  // an initial populated notebook.
  Promise.all([state.fetch(INITIAL_NOTEBOOK_PLUGIN_ID), settingsLoaded]).then(
    async ([result]) => {
      // Determine whether to launch an initial notebook, then immediately
      // set that value to false. This state setting is intended to be set
      // by outside actors, rather than as true state restoration.
      let initial = false;
      if (result) {
        initial = !!(result as { initialNotebook: boolean }).initialNotebook;
      }
      state.save(INITIAL_NOTEBOOK_PLUGIN_ID, { initialNotebook: false });

      if (initial) {
        // Create the notebook.
        const notebook = await app.commands.execute('notebook:create-new', {
          kernelName: 'python3'
        });
        // Move the notebook so it is in a split pane with the primary tab.
        // It has already been added, so this just has the effect of moving it.
        app.shell.add(notebook, 'main', { mode: 'split-left' });

        await notebook.context.ready;

        // Define a function for injecting code into the notebook
        // on content changed. This is a somewhat ugly hack, as
        // the notebook model is not entirely ready when the context
        // is ready. Instead, it waits for a new stack frame to add
        // the initial cell. So as a workaround, we wait until there
        // is exactly one cell, then inject our code, then disconnect.
        const inject = (sender: NotebookModel) => {
          if (sender.cells.length === 1) {
            if (!defaultConnectionData) {
              return;
            }
            Private.injectIbisConnection(sender, defaultConnectionData);
            notebook.content.model.contentChanged.disconnect(inject);
          }
        };
        notebook.content.model.contentChanged.connect(inject);
      }
    }
  );
}

/**
 * Export the plugin as default.
 */
const plugins: JupyterFrontEndPlugin<any>[] = [
  omnisciConnectionPlugin,
  omnisciVegaPlugin,
  omnisciGridPlugin,
  omnisciInitialNotebookPlugin
];
export default plugins;

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
  const IBIS_TEMPLATE = `
import ibis

con = ibis.mapd.connect(
    host='{{host}}', user='{{user}}', password='{{password}}',
    port={{port}}, database='{{database}}', protocol='{{protocol}}'
)

con.list_tables()`.trim();

  export function injectIbisConnection(
    model: INotebookModel,
    connection: IOmniSciConnectionData
  ) {
    let value = IBIS_TEMPLATE;
    value = value.replace('{{host}}', connection.host);
    value = value.replace('{{protocol}}', connection.protocol);
    value = value.replace('{{password}}', connection.password);
    value = value.replace('{{database}}', connection.database);
    value = value.replace('{{user}}', connection.username);
    value = value.replace('{{port}}', `${connection.port}`);
    model.cells.get(0).value.text = value;
  }
}
