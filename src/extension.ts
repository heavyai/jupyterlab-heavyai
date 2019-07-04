import {
  ILayoutRestorer,
  IRouter,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  ICommandPalette,
  WidgetTracker,
  IThemeManager
} from '@jupyterlab/apputils';

import { IEditorServices } from '@jupyterlab/codeeditor';

import { ICompletionManager } from '@jupyterlab/completer';

import { ISettingRegistry, IStateDB, URLExt } from '@jupyterlab/coreutils';

import { DocumentRegistry } from '@jupyterlab/docregistry';

import { ILauncher } from '@jupyterlab/launcher';

import { IMainMenu } from '@jupyterlab/mainmenu';

import {
  INotebookTracker,
  Notebook,
  NotebookActions
} from '@jupyterlab/notebook';

import { ServerConnection } from '@jupyterlab/services';

import { ReadonlyJSONObject } from '@phosphor/coreutils';

import { DataGrid, TextRenderer } from '@phosphor/datagrid';

import { Widget } from '@phosphor/widgets';

import {
  IOmniSciConnectionData,
  IOmniSciConnectionManager,
  OmniSciCompletionConnector,
  OmniSciConnectionManager
} from './connection';

import { OmniSciSQLEditor } from './grid';

import { OmniSciVegaViewer, OmniSciVegaViewerFactory } from './viewer';

import {
  RenderedOmniSciSQLEditor,
  sqlEditorRendererFactory
} from './mimeextensions';

import vegaIbisPlugin from './vega-ibis';

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

  export const setEnvironment = 'omnisci:set-environment';

  export const injectIbisConnection = 'omnisci:inject-ibis-connection';

  export const createNotebook = 'omnisci:create-notebook';

  export const createWorkspace = 'omnisci:create-workspace';
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

const NOTEBOOK_PLUGIN_ID = 'jupyterlab-omnisci:notebook';

/**
 * The Omnisci connection handler extension.
 */
const omnisciConnectionPlugin: JupyterFrontEndPlugin<
  IOmniSciConnectionManager
> = {
  activate: activateOmniSciConnection,
  id: CONNECTION_PLUGIN_ID,
  requires: [ICommandPalette, IMainMenu, ISettingRegistry],
  provides: IOmniSciConnectionManager,
  autoStart: true
};

async function activateOmniSciConnection(
  app: JupyterFrontEnd,
  palette: ICommandPalette,
  mainMenu: IMainMenu,
  settingRegistry: ISettingRegistry
): Promise<IOmniSciConnectionManager> {
  // Fetch the initial state of the settings.
  const settings = await settingRegistry.load(CONNECTION_PLUGIN_ID);
  const manager = new OmniSciConnectionManager({ settings });

  // Add an application-wide connection-setting command.
  app.commands.addCommand(CommandIDs.setConnection, {
    execute: async () => {
      const connection = await manager.chooseConnection(
        'Set Default Omnisci Connection',
        manager.defaultConnection
      );
      manager.defaultConnection = connection;
      return connection;
    },
    label: 'Set Default Omnisci Connection...'
  });

  // Add an application-wide connection-setting command.
  app.commands.addCommand(CommandIDs.setEnvironment, {
    execute: async () => {
      const environment = await manager.setEnvironment();
      manager.environment = environment;
      return environment;
    },
    label: 'Set OmniSci Connection Environment...'
  });

  mainMenu.settingsMenu.addGroup(
    [
      { command: CommandIDs.setConnection },
      { command: CommandIDs.setEnvironment }
    ],
    50
  );
  palette.addItem({ command: CommandIDs.setConnection, category: 'OmniSci' });
  palette.addItem({ command: CommandIDs.setEnvironment, category: 'OmniSci' });

  return manager;
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
  requires: [ILayoutRestorer, IOmniSciConnectionManager],
  autoStart: true
};

function activateOmniSciVegaViewer(
  app: JupyterFrontEnd,
  restorer: ILayoutRestorer,
  manager: IOmniSciConnectionManager
): void {
  const viewerNamespace = 'omnisci-viewer-widget';

  const factory = new OmniSciVegaViewerFactory({
    name: FACTORY,
    modelName: 'text',
    fileTypes: ['json', 'omnisci-vega', 'vega3', 'vega4'],
    defaultFor: ['omnisci-vega'],
    readOnly: true,
    manager
  });
  const viewerTracker = new WidgetTracker<OmniSciVegaViewer>({
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
      widget.title.iconClass = types[0].iconClass || '';
      widget.title.iconLabel = types[0].iconLabel || '';
    }
  });

  // Update the default connection data for viewers that don't already
  // have it defined.
  manager.changed.connect(() => {
    const defaultConnectionData = manager.defaultConnection;
    viewerTracker.forEach(viewer => {
      if (!viewer.connectionData) {
        viewer.connectionData = defaultConnectionData;
      }
    });
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
    IOmniSciConnectionManager,
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
  manager: IOmniSciConnectionManager,
  state: IStateDB,
  themeManager: IThemeManager
): void {
  const gridNamespace = 'omnisci-grid-widget';
  const mimeGridNamespace = 'omnisci-mime-grid-widget';

  const gridTracker = new WidgetTracker<OmniSciSQLEditor>({
    namespace: gridNamespace
  });

  // Handle state restoration.
  restorer.restore(gridTracker, {
    command: CommandIDs.newGrid,
    args: widget => {
      const con = widget.content.connectionData!;
      const connection = {
        host: con.host!,
        protocol: con.protocol!,
        port: con.port!
      };
      const sessionId = widget.content.sessionId;
      return {
        initialQuery: widget.content.query,
        connectionData: connection,
        sessionId: sessionId || null
      };
    },
    name: widget => widget.id
  });

  // Create a completion handler for each grid that is created.
  gridTracker.widgetAdded.connect((sender, explorer) => {
    const editor = explorer.input.editor;
    const sessionId = explorer.content.sessionId;
    const connector = new OmniSciCompletionConnector({
      connection: explorer.content.connectionData,
      sessionId
    });
    const parent = explorer;
    const handle = completionManager.register({ connector, editor, parent });

    explorer.content.onModelChanged.connect(() => {
      const sessionId = explorer.content.sessionId;
      handle.connector = new OmniSciCompletionConnector({
        connection: explorer.content.connectionData,
        sessionId
      });
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
    const isLight = themeManager.theme
      ? themeManager.isLight(themeManager.theme)
      : true;
    style = isLight ? Private.LIGHT_STYLE : Private.DARK_STYLE;
    renderer = isLight ? Private.LIGHT_RENDERER : Private.DARK_RENDERER;
    gridTracker.forEach(grid => {
      grid.content.style = style;
      grid.content.renderer = renderer;
    });
    mimeGridTracker.forEach((mimeGrid: any) => {
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
  const mimeGridTracker = new WidgetTracker<RenderedOmniSciSQLEditor>({
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
    const grid = mime.widget;
    const sessionId = grid.content.sessionId;
    const editor = grid.input.editor;
    const connector = new OmniSciCompletionConnector({
      connection: grid.content.connectionData,
      sessionId
    });
    const parent = mime;
    const handle = completionManager.register({ connector, editor, parent });

    grid.content.onModelChanged.connect(() => {
      const sessionId = grid.content.sessionId;
      handle.connector = new OmniSciCompletionConnector({
        connection: grid.content.connectionData,
        sessionId
      });
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
      } else if (
        current &&
        mimeGridTracker.currentWidget &&
        current.contains(mimeGridTracker.currentWidget)
      ) {
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
      } else if (
        current &&
        mimeGridTracker.currentWidget &&
        current.contains(mimeGridTracker.currentWidget)
      ) {
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

  app.commands.addCommand(CommandIDs.newGrid, {
    label: 'OmniSci SQL Editor',
    iconClass: 'omnisci-OmniSci-logo',
    execute: args => {
      const query = (args['initialQuery'] as string) || '';
      const connectionData =
        (args['connectionData'] as IOmniSciConnectionData) || undefined;
      const sessionId = (args['sessionId'] as string) || undefined;
      const grid = new OmniSciSQLEditor({
        editorFactory: editorServices.factoryService.newInlineEditor,
        manager,
        connectionData,
        sessionId,
        initialQuery: query
      });
      Private.id++;
      grid.id = `omnisci-grid-widget-${Private.id}`;
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

  // Update the default connection data for grids that don't already
  // have it defined.
  manager.changed.connect(() => {
    const defaultConnectionData = manager.defaultConnection;
    gridTracker.forEach(grid => {
      if (!grid.content.connectionData) {
        grid.content.setConnectionData(defaultConnectionData);
      }
    });
  });
}

/**
 * The Omnisci inital notebook extension.
 */
const omnisciNotebookPlugin: JupyterFrontEndPlugin<void> = {
  activate: activateOmniSciNotebook,
  id: NOTEBOOK_PLUGIN_ID,
  requires: [
    JupyterFrontEnd.IPaths,
    ICommandPalette,
    IMainMenu,
    INotebookTracker,
    IOmniSciConnectionManager,
    IRouter
  ],
  autoStart: true
};

function activateOmniSciNotebook(
  app: JupyterFrontEnd,
  paths: JupyterFrontEnd.IPaths,
  palette: ICommandPalette,
  menu: IMainMenu,
  tracker: INotebookTracker,
  manager: IOmniSciConnectionManager,
  router: IRouter
): void {
  // Add a command to inject the ibis connection data into the active notebook.
  app.commands.addCommand(CommandIDs.injectIbisConnection, {
    label: 'Insert Ibis OmniSci Connection…',
    execute: async () => {
      const current = tracker.currentWidget;
      if (!current) {
        return;
      }
      const connection = await manager.chooseConnection(
        'Choose Ibis Connection',
        manager.defaultConnection
      );
      Private.injectIbisConnection({
        notebook: current.content,
        connection,
        environment: manager.environment
      });
    },
    isEnabled: () => !!tracker.currentWidget
  });

  // Add a command to create a new notebook with an ibis connection.
  app.commands.addCommand(CommandIDs.createNotebook, {
    label: 'Notebook with OmniSci Connection',
    iconClass: 'omnisci-OmniSci-logo',
    execute: async args => {
      const connectionData: IOmniSciConnectionData =
        (args['connectionData'] as IOmniSciConnectionData) || {};
      const environment: IOmniSciConnectionData =
        (args['environment'] as IOmniSciConnectionData) || {};
      const sessionId = (args['sessionId'] as string) || '';
      const initialQuery = (args['initialQuery'] as string) || '';

      // Create the notebook.
      const notebook = await app.commands.execute('notebook:create-new', {
        kernelName: 'python3'
      });
      // Move the notebook so it is in a split pane with the primary tab.
      // It has already been added, so this just has the effect of moving it.
      app.shell.add(notebook, 'main');

      await notebook.context.ready;

      // Define a function for injecting code into the notebook
      // on content changed. This is a somewhat ugly hack, as
      // the notebook model is not entirely ready when the context
      // is ready. Instead, it waits for a new stack frame to add
      // the initial cell. So as a workaround, we wait until there
      // is exactly one cell, then inject our code, then disconnect.
      const inject = () => {
        if (notebook.content.model.cells.length === 1) {
          notebook.content.model.contentChanged.disconnect(inject);
          Private.injectIbisConnection({
            notebook: notebook.content,
            connection: connectionData,
            environment,
            sessionId,
            initialQuery
          });
        }
      };
      notebook.content.model.contentChanged.connect(inject);

      return notebook;
    }
  });

  // Add a command to set up a new workspace with a notebook and SQL editor.
  // This specifically does not ask for user input, as we want it to
  // be triggerable via routing.
  app.commands.addCommand(CommandIDs.createWorkspace, {
    label: 'Create OmniSci Workspace',
    execute: async () => {
      await app.restored;
      const workspace = await Private.fetchWorkspaceData();
      const connectionData = workspace.connection;
      const environment = workspace.environment;
      const sessionId = workspace.session;
      const initialQuery = workspace.query;
      // Create the SQL editor
      const grid = await app.commands.execute(CommandIDs.newGrid, ({
        initialQuery,
        connectionData,
        sessionId
      } as any) as ReadonlyJSONObject);
      // Prefer the environment variables for the notebook creation.
      const notebook = await app.commands.execute(CommandIDs.createNotebook, ({
        environment,
        connectionData: Private.canUseSession(environment)
          ? {}
          : connectionData,
        sessionId,
        initialQuery
      } as any) as ReadonlyJSONObject);
      // Move the notebook to be side by side with the grid.
      app.shell.add(notebook, 'main', { ref: grid.id, mode: 'split-left' });
    }
  });

  // Add ibis connection injection to the palette and the edit menu.
  palette.addItem({
    command: CommandIDs.injectIbisConnection,
    category: 'OmniSci'
  });
  menu.editMenu.addGroup([{ command: CommandIDs.injectIbisConnection }], 50);

  // Add new notebook creation to the palette and file menu.
  menu.fileMenu.newMenu.addGroup([{ command: CommandIDs.createNotebook }], 11);
  palette.addItem({
    command: CommandIDs.createWorkspace,
    category: 'OmniSci'
  });

  // Add workspace creation to the router, so that external services
  // may launch a new workspace via URL.
  router.register({
    pattern: /(\?omnisci|\&omnisci)($|&)/,
    command: CommandIDs.createWorkspace
  });
}

/**
 * Export the plugin as default.
 */
const plugins: JupyterFrontEndPlugin<any>[] = [
  omnisciConnectionPlugin,
  omnisciVegaPlugin,
  omnisciGridPlugin,
  omnisciNotebookPlugin,
  vegaIbisPlugin
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
   * A utility function that checks whether data is enough
   * to connect via session id.
   */
  export function canUseSession(
    data: IOmniSciConnectionData | undefined
  ): boolean {
    return !!data && !!data.host && !!data.port && !!data.protocol;
  }

  /**
   * An interface for the initial notebook statedb.
   */
  export interface IWorkspaceData {
    /**
     * Connection data for the initial state.
     */
    connection?: IOmniSciConnectionData;

    /**
     * Connection data for the initial state.
     */
    environment?: IOmniSciConnectionData;

    /**
     * An initial query to use.
     */
    query?: string;

    /**
     * An ID for a pre-authenticated session.
     */
    session?: string;
  }

  /**
   * Settings for a connection to the server.
   */
  const serverSettings = ServerConnection.makeSettings();

  export async function fetchWorkspaceData(): Promise<IWorkspaceData> {
    const url = URLExt.join(serverSettings.baseUrl, 'omnisci', 'session');
    const response = await ServerConnection.makeRequest(
      url,
      {},
      serverSettings
    );
    const data = await response.json();
    return data as IWorkspaceData;
  }

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
{{os}}import ibis

con = ibis.mapd.connect(
    host={{host}}, user={{user}}, password={{password}},
    port={{port}}, database={{database}}, protocol={{protocol}}
)`.trim();

  /**
   * A template for an Ibis mapd client when a session ID is available.
   */
  const SESSION_IBIS_TEMPLATE = `
{{os}}import ibis

con = ibis.mapd.connect(
    host={{host}}, port={{port}}, protocol={{protocol}}, session_id={{session}}
)`.trim();

  /**
   * String to list tables.
   */
  const LIST_TABLES = '\n\ncon.list_tables()';

  /**
   * Template for an initial query.
   */
  const INITIAL_QUERY = '\n\nexpr = con.sql("{{query}}")';

  /**
   * Construct an ibis connection code snippet and insert it
   * into a notebook cell.
   */
  export function injectIbisConnection(options: {
    notebook: Notebook;
    connection?: IOmniSciConnectionData;
    environment?: IOmniSciConnectionData;
    sessionId?: string;
    initialQuery?: string;
  }) {
    const notebook = options.notebook;
    const env = options.environment || {};
    const con: IOmniSciConnectionData = {};
    let os = Object.keys(env).length === 0 ? '' : 'import os\n';
    // Merge the connection with any environment variables
    // that have been specified.
    const keys: ReadonlyArray<keyof IOmniSciConnectionData> = [
      'host',
      'protocol',
      'port',
      'username',
      'password',
      'database'
    ];
    keys.forEach(key => {
      if (options.connection && options.connection[key]) {
        con[key] = `"${options.connection[key]}"`;
      } else if (env[key]) {
        con[key] = `os.environ['${env[key]}']`;
      }
    });

    let value = '';
    if (options.sessionId) {
      value = SESSION_IBIS_TEMPLATE;
      value = value.replace('{{os}}', os);
      value = value.replace('{{host}}', con.host || '""');
      value = value.replace('{{protocol}}', con.protocol || '""');
      value = value.replace('{{session}}', `"${options.sessionId}"`);
      value = value.replace('{{port}}', `${con.port || '""'}`);
    } else {
      value = IBIS_TEMPLATE;
      value = value.replace('{{os}}', os);
      value = value.replace('{{host}}', con.host || '""');
      value = value.replace('{{protocol}}', con.protocol || '""');
      value = value.replace('{{password}}', con.password || '""');
      value = value.replace('{{database}}', con.database || '""');
      value = value.replace('{{user}}', con.username || '""');
      value = value.replace('{{port}}', `${con.port || '""'}`);
    }

    // Handle an initial query if given. If not, list tables.
    if (options.initialQuery) {
      value = value + INITIAL_QUERY.replace('{{query}}', options.initialQuery);
    } else {
      value = value + LIST_TABLES;
    }

    NotebookActions.insertAbove(options.notebook);
    const model =
      (notebook.activeCell && notebook.activeCell.model) ||
      notebook.model.cells.get(0);
    // Assert exists because we have verified by creating.
    model!.value.text = value;
  }
}
