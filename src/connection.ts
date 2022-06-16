import { Dialog, showDialog } from '@jupyterlab/apputils';
import { CompletionHandler } from '@jupyterlab/completer';
import { URLExt } from '@jupyterlab/coreutils';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { DataConnector } from '@jupyterlab/statedb';
import { JSONExt, JSONObject, Token } from '@lumino/coreutils';
import { IDisposable } from '@lumino/disposable';
import { ISignal, Signal } from '@lumino/signaling';
import { PanelLayout, Widget } from '@lumino/widgets';

declare const require: any;
// tslint:disable-next-line:no-var-requires
require('@mapd/connector/dist/browser-connector');

declare const MapdCon: any;

/* tslint:disable */
/**
 * The OmniSciConnectionManager token.
 */
export const IOmniSciConnectionManager = new Token<IOmniSciConnectionManager>(
  'jupyterlab-omnisci:IOmniSciConnectionManager'
);

/* tslint:enable */

/**
 * A type stub for a connection object.
 */
export type OmniSciConnection = any;

/**
 * Connection data for the omnisci browser client.
 *
 * #### Notes
 * This interface is intended to be API compatible with the servers.json
 * server specification that is used by OmniSci Immerse. As such,
 * it includes a number of fields that we do not use in this package.
 */
export interface IOmniSciConnectionData {
  /**
   * The name of the database to connect to.
   */
  database?: string;

  /**
   * Whether this connection should be considered the default one.
   */
  master?: boolean;

  /**
   * Username for the database connection.
   */
  username?: string;

  /**
   * Password for the database connection.
   */
  password?: string;

  /**
   * A URL for the OmniSci server.
   *
   * If host, protocol, and port are given,
   * those will take precedence.
   */
  url?: string;

  /**
   * Custom styles used by Immerse.
   * Typed as `any` here as they are unused.
   */
  customStyles?: any;

  /**
   * The protocol to use when connecting.
   */
  protocol?: 'http' | 'https' | string;

  /**
   * Custom styles for mapbox.
   * Unused here.
   */
  mapboxCustomStyles?: any;

  /**
   * The host URL for the connection.
   */
  host?: string;

  /**
   * The port for the connection.
   */
  port?: number | string;

  /**
   * GTM string.
   */
  GTM?: string;

  /**
   * The dashboard to load in Immerse.
   * Not used here.
   */
  loadDashboard?: any;
}

/**
 * The public interface for a connection manager.
 */
export interface IOmniSciConnectionManager extends IDisposable {
  /**
   * The default connection data.
   */
  readonly defaultConnection: IOmniSciConnectionData | undefined;

  /**
   * A connection specifying properties that are stored
   * in environment variables. For places where code is submitted
   * to kernels, this may be used to pull from environment variables
   * instead of supplying credentials from the settings system.
   *
   * #### Notes
   * This is not used for client-side connections like the SQL editor,
   * as they do not have access to environment variables.
   */
  readonly environment: IOmniSciConnectionData | undefined;

  /**
   * A list of predefined connections.
   */
  readonly connections: ReadonlyArray<IOmniSciConnectionData>;

  /**
   * Prompt user to choose a connection.
   */
  chooseConnection(
    label: string,
    oldData?: IOmniSciConnectionData
  ): Promise<IOmniSciConnectionData | undefined>;

  /**
   * A signal that fires when the connection listing changes.
   */
  readonly changed: ISignal<this, void>;
}

export class OmniSciConnectionManager implements IOmniSciConnectionManager {
  /**
   * Construct a new conection manager.
   */
  constructor(options: OmniSciConnectionManager.IOptions) {
    this._settings = options.settings;
    this._settings.changed.connect(this._onSettingsChanged, this);
    this._onSettingsChanged(this._settings);
  }

  /**
   * The default connection data.
   *
   * #### Notes
   * Setting the default triggers an asynchronous write to the settings
   * system. The changed signal will not fire until that is complete.
   *
   * Setting the default to `undefined` will not necessarily produce
   * the expected behavior! The connection manager will still look through the
   * servers known to it, and select one that is marked with `"master": true`,
   * or, if there is only one option, select that.
   */
  get defaultConnection(): IOmniSciConnectionData | undefined {
    return this._defaultConnection;
  }
  set defaultConnection(value: IOmniSciConnectionData | undefined) {
    // If the new value is undefined, write the existing values
    // unmodified. This will trigger a possible selection of the
    // value in `_onSettingsChanged.
    if (!value) {
      this._defaultConnection = Private.chooseDefault(this.connections);
      this._changed.emit(void 0);
      return;
    }
    // Do nothing if there is no change.
    if (
      this._defaultConnection &&
      JSONExt.deepEqual(
        this._defaultConnection as JSONObject,
        value as JSONObject
      )
    ) {
      return;
    }
    value.master = false; // Temporarily set to false;
    let labServers = this._labConnections.slice();
    // First loop through the existing servers and unset the master attribute.
    labServers.forEach(s => {
      s.master = false;
    });
    // Next loop through the existing servers and see if one already matches
    // the new server.
    const labMatch = labServers.find(s => {
      return (
        Object.keys(value).filter(
          (key: keyof IOmniSciConnectionData) => value[key] !== s[key]
        ).length === 0
      );
    });

    // If we found one, set it to the master server.
    if (labMatch) {
      labMatch.master = true;
    } else {
      value.master = true;
      labServers = [value, ...labServers];
    }

    void this._settings.set('servers', (labServers as unknown) as JSONObject);
  }

  /**
   * A connection specifying properties that are stored
   * in environment variables. For places where code is submitted
   * to kernels, this may be used to pull from environment variables
   * instead of supplying credentials from the settings system.
   *
   * #### Notes
   * This is not used for client-side connections like the SQL editor,
   * as they do not have access to environment variables.
   */
  get environment(): IOmniSciConnectionData | undefined {
    return this._environment;
  }
  set environment(value: IOmniSciConnectionData | undefined) {
    if (
      (!value && !this._environment) ||
      JSONExt.deepEqual(value as JSONObject, this._environment as JSONObject)
    ) {
      return;
    } else if (!value) {
      void this._settings.remove('environment');
      return;
    }
    void this._settings.set('environment', value as JSONObject);
  }

  /**
   * The overall list of connections known to the manager.
   */
  get connections(): ReadonlyArray<IOmniSciConnectionData> {
    return this._labConnections.slice();
  }

  /**
   * A signal that fires when the list of connections changes.
   */
  get changed(): ISignal<this, void> {
    return this._changed;
  }

  /**
   * Prompt user to choose a connection.
   */
  chooseConnection(
    label: string,
    oldData?: IOmniSciConnectionData
  ): Promise<IOmniSciConnectionData | undefined> {
    return Private.showConnectionDialog({
      title: label,
      oldData,
      knownServers: this.connections,
      showPassword: false
    });
  }

  /**
   * Prompt the user to populate environment variables.
   */
  setEnvironment(): Promise<IOmniSciConnectionData | undefined> {
    return Private.showConnectionDialog({
      title: 'Set Connection Environment Variables',
      oldData: this._environment,
      showPassword: true
    });
  }

  /**
   * Dispose of the connection manager.
   */
  dispose(): void {
    this._isDisposed = true;
    Signal.clearData(this);
  }

  /**
   * Whether the connection manager is disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * React to the settings changing.
   * This emits the `changed` signal once it is done.
   */
  private _onSettingsChanged(settings: ISettingRegistry.ISettings): void {
    const newServers =
      ((settings.get('servers').composite as unknown) as
        | IOmniSciConnectionData[]
        | undefined) || [];
    // Normalize the connection data.
    this._labConnections = newServers.map(Private.normalizeConnectionData);
    const environment = settings.get('environment').composite as
      | IOmniSciConnectionData
      | undefined;
    this._environment = environment;
    this._defaultConnection = Private.chooseDefault(this.connections);
    this._changed.emit(void 0);
  }

  private _settings: ISettingRegistry.ISettings;
  private _isDisposed = false;
  private _defaultConnection: IOmniSciConnectionData | undefined = undefined;
  private _environment: IOmniSciConnectionData | undefined = undefined;
  private _changed = new Signal<this, void>(this);
  private _labConnections: ReadonlyArray<IOmniSciConnectionData> = [];
}

/**
 * A namespace for OmniSciConnectionManager statics.
 */
export namespace OmniSciConnectionManager {
  /**
   * Options for creating a connection manager.
   */
  export interface IOptions {
    /**
     * A settings object which gets connection data from the server.
     */
    settings: ISettingRegistry.ISettings;
  }
}

/**
 * Make a connection to the OmniSci backend.
 *
 * @param data: connection data for the OmniSci database.
 *   Must include at least protocol, host, and port. If a session ID
 *   is not given, it must also incldue database, usernamem and password.
 *
 * @param sessionId: an optional session ID for an already-authenticated
 *   database session.
 *
 * @returns a promise that resolves with the connection object.
 */
export async function makeConnection(
  data: IOmniSciConnectionData,
  sessionId?: string
): Promise<OmniSciConnection> {
  // Whether or not we have a session id, we need protocol,
  // host, and port to be defined.
  let con = new MapdCon()
    .protocol(data.protocol)
    .host(data.host)
    .port(data.port);
  if (sessionId) {
    // Set fake dbname and user arrays if we are provided a session ID.
    // These are not necessary to make the connection, but the initClients
    // function checks for them anyways.
    // Once the clients have been initialized, set the session id,
    // but do *not* call connect, as that requires username, db and password.
    con = con.dbName(['']).user(['']);
    return con.initClients().sessionId([sessionId]);
  } else {
    // If we don't have a session id, provide user authentication.
    con = con
      .dbName(data.database)
      .user(data.username)
      .password(data.password);
  }
  return await con.connectAsync();
}

/**
 * A dialog for entering OmniSci connection data.
 */
export class OmniSciConnectionDialog extends Widget
  implements Dialog.IBodyWidget<IOmniSciConnectionData> {
  constructor(options: OmniSciConnectionDialog.IOptions = {}) {
    super();
    let layout = (this.layout = new PanelLayout());
    const oldData = options.oldData;
    this._servers = options.knownServers || [];
    const showPassword: boolean = !!options.showPassword;

    if (this._servers.length) {
      this._select = this._buildSelect(this._servers);
      const knownServersLabel = new Widget();
      knownServersLabel.node.textContent = 'Known Servers';
      layout.addWidget(knownServersLabel);
      layout.addWidget(new Widget({ node: this._select }));
    }

    this._user = document.createElement('input');
    this._password = document.createElement('input');
    this._database = document.createElement('input');
    this._host = document.createElement('input');
    this._protocol = document.createElement('input');
    this._port = document.createElement('input');

    this._user.placeholder = 'User name';
    this._password.placeholder = 'Password';
    if (!showPassword) {
      this._password.setAttribute('type', 'password');
    }
    this._database.placeholder = 'Database name';
    this._host.placeholder = 'Host name';
    this._protocol.placeholder = 'Protocol';
    this._port.placeholder = 'Port';
    if (oldData) {
      this._populateInputs(oldData);
    }

    const userLabel = new Widget();
    userLabel.node.textContent = 'User';
    const passwordLabel = new Widget();
    passwordLabel.node.textContent = 'Password';
    const databaseLabel = new Widget();
    databaseLabel.node.textContent = 'Database';
    const hostLabel = new Widget();
    hostLabel.node.textContent = 'Host';
    const protocolLabel = new Widget();
    protocolLabel.node.textContent = 'Protocol';
    const portLabel = new Widget();
    portLabel.node.textContent = 'Port';

    layout.addWidget(userLabel);
    layout.addWidget(new Widget({ node: this._user }));
    layout.addWidget(passwordLabel);
    layout.addWidget(new Widget({ node: this._password }));
    layout.addWidget(databaseLabel);
    layout.addWidget(new Widget({ node: this._database }));
    layout.addWidget(hostLabel);
    layout.addWidget(new Widget({ node: this._host }));
    layout.addWidget(protocolLabel);
    layout.addWidget(new Widget({ node: this._protocol }));
    layout.addWidget(portLabel);
    layout.addWidget(new Widget({ node: this._port }));
  }

  /**
   * Get connection data for the current state of the dialog.
   */
  getValue(): IOmniSciConnectionData {
    const data: IOmniSciConnectionData = {
      username: this._user.value || undefined,
      password: this._password.value || undefined,
      database: this._database.value || undefined,
      host: this._host.value || undefined,
      protocol: this._protocol.value || undefined,
      port: this._port.value ? parseInt(this._port.value, 10) : undefined
    };
    Object.keys(data).forEach(
      (k: keyof IOmniSciConnectionData) =>
        data[k] === undefined && delete data[k]
    );
    return data;
  }

  handleEvent(event: Event) {
    switch (event.type) {
      case 'change':
        this._evtSelectChange(event);
        break;
      default:
        break;
    }
  }

  /**
   * Handle `after-attach` messages for the widget.
   */
  protected onAfterAttach(): void {
    if (this._select) {
      this._select.addEventListener('change', this);
    }
  }

  /**
   * Handle `before-detach` messages for the widget.
   */
  protected onBeforeDetach(): void {
    if (this._select) {
      this._select.removeEventListener('change', this);
    }
  }

  /**
   * On a change to the select element,
   * populate the input elements with the appropriate
   * data.
   */
  private _evtSelectChange(event: Event): void {
    const idx = parseInt((event.target as any).value, 10);
    if (idx > 0 && idx <= this._servers.length) {
      this._populateInputs(this._servers[idx - 1]);
    }
  }

  /**
   * Given connection data, populate the inputs.
   */
  private _populateInputs(data: IOmniSciConnectionData): void {
    this._user.value = data.username || '';
    this._password.value = data.password || '';
    this._database.value = data.database || '';
    this._host.value = data.host || '';
    this._protocol.value = data.protocol || '';
    this._port.value = data.port ? `${data.port}` : '';
  }

  /**
   * Given a list of servers, build a select element
   * with those options. The first option in the select
   * is the null "-" option, for when the inputs don't match.
   * The values for the options are their indices in the list-1
   */
  private _buildSelect(knownServers: ReadonlyArray<IOmniSciConnectionData>) {
    const select = document.createElement('select');
    let idx = 0;

    // Create an option corresponding to none of the known servers.
    const option = document.createElement('option');
    option.value = `${idx++}`;
    option.textContent = '-';
    select.appendChild(option);

    knownServers.forEach(server => {
      const option = document.createElement('option');
      option.value = `${idx++}`;
      option.textContent = server.host || 'Unknown host';
      option.title = `Hostname: ${server.host || 'unknown'}
Protocol: ${server.protocol || 'unknown'}
Port: ${server.port || 'unknown'}
Database: ${server.database || 'unknown'}
User: ${server.username || 'unknown'}
Password ${server.password ? '*****' : 'unknown'}`;
      select.appendChild(option);
    });
    return select;
  }

  private _servers: ReadonlyArray<IOmniSciConnectionData>;
  private _select: HTMLSelectElement;
  private _user: HTMLInputElement;
  private _password: HTMLInputElement;
  private _database: HTMLInputElement;
  private _host: HTMLInputElement;
  private _protocol: HTMLInputElement;
  private _port: HTMLInputElement;
}

/**
 * A namespace for OmniSciConnectionDialog statics.
 */
export namespace OmniSciConnectionDialog {
  /**
   * Options to create a new connection dialog.
   */
  export interface IOptions {
    /**
     * A previous connection to prepopulate.
     */
    oldData?: IOmniSciConnectionData;

    /**
     * A list of known servers for selection.
     */
    knownServers?: ReadonlyArray<IOmniSciConnectionData>;

    /**
     * Whether to show the password field.
     *
     * Defaults to `false`.
     */
    showPassword?: boolean;
  }
}

/**
 * A class for fetching completion data from a OmniSci connection.
 */
export class OmniSciCompletionConnector extends DataConnector<
  CompletionHandler.IReply,
  void,
  CompletionHandler.IRequest
> {
  /**
   * Construct a new completion connector.
   */
  constructor(options: OmniSciCompletionConnector.IOptions = {}) {
    super();
    // Note: unlike other places, this expects an authenticated
    // session ID to work.
    // TODO: remove this restriction.
    if (options.connection && options.sessionId) {
      this._connection = makeConnection(options.connection, options.sessionId);
    }
  }

  /**
   * Fetch completion data from the OmniSci backend.
   */
  fetch(
    request: CompletionHandler.IRequest
  ): Promise<CompletionHandler.IReply | undefined> {
    if (!this._connection) {
      return Promise.resolve(void 0);
    }
    return new Promise<CompletionHandler.IReply | undefined>(
      (resolve, reject) => {
        if (!this._connection) {
          resolve(void 0);
          return;
        }
        this._connection
          .then(con => {
            con.getCompletionHints(
              request.text,
              { cursor: request.offset },
              (err: any, result: any) => {
                if (err) {
                  throw err;
                } else if (result && result[0] && result[0].hints) {
                  const matches = result
                    .map((hintObject: any) => hintObject.hints)
                    .reduce((acc: any, val: any) => [].concat(acc, val), []);

                  resolve({
                    start: request.offset - result[0].replaced.length,
                    end: request.offset,
                    matches,
                    metadata: {}
                  });
                  resolve(void 0);
                } else {
                  resolve(void 0);
                }
              }
            );
          })
          .catch(err => {
            console.warn(
              'There was an error making a connection to the backend'
            );
            console.warn(err);
            return void 0;
          });
      }
    );
  }
  private _connection: Promise<OmniSciConnection> | undefined = undefined;
}

/**
 * A namespace for OmniSciCompletionConnector statics.
 */
export namespace OmniSciCompletionConnector {
  /**
   * Options used to create the completion connector.
   */
  export interface IOptions {
    /**
     * Connection data for the backend.
     */
    connection?: IOmniSciConnectionData;

    /**
     * A session ID for an already authenticated session.
     */
    sessionId?: string;
  }
}

/**
 * A namespace for private functionality.
 */
namespace Private {
  /**
   * Given a list of connections, select one as default.
   * This looks for a the first connection indicated with "master: true".
   * If none is found returns the first in the list.
   * If the list is empty, returns undefined.
   */
  export function chooseDefault(
    connections: ReadonlyArray<IOmniSciConnectionData>
  ): IOmniSciConnectionData | undefined {
    if (!connections.length) {
      return undefined;
    }
    return connections.find(c => c.master === true) || connections[0];
  }

  /**
   * Given a valid connection data, normalize it to the format
   * expected in this plugin. In particular, if given a URL to
   * a database, parse it into protocol, host, and port.
   */
  export function normalizeConnectionData(
    data: IOmniSciConnectionData
  ): IOmniSciConnectionData {
    let { host, port, protocol } = data;

    // Assume https if protocol is undefined.
    protocol = (protocol || 'https').replace(':', '');
    port = port
      ? parseInt(`${port}`, 10)
      : protocol === 'http'
      ? 80
      : protocol === 'https'
      ? 443
      : NaN;

    if (data.url) {
      const parsed = URLExt.parse(data.url);
      protocol = parsed.protocol;
      host = parsed.hostname;
      protocol = (protocol || 'https').replace(':', '');

      // Fill in the port with defaults if necessary.
      if (parsed.port) {
        port = parseInt(parsed.port, 10);
      } else {
        port = protocol === 'http' ? 80 : protocol === 'https' ? 443 : NaN;
      }
    }
    return {
      ...data,
      host,
      port,
      protocol
    };
  }

  /**
   * Show a dialog for entering OmniSci connection data.
   */
  export function showConnectionDialog(
    options: IConnectionDialogOptions
  ): Promise<IOmniSciConnectionData | undefined> {
    return showDialog<IOmniSciConnectionData>({
      title: options.title,
      body: new OmniSciConnectionDialog(options),
      buttons: [Dialog.cancelButton(), Dialog.okButton()]
    }).then(result => {
      if (result.button.accept) {
        return result.value || options.oldData;
      } else {
        return options.oldData;
      }
    });
  }

  export interface IConnectionDialogOptions
    extends OmniSciConnectionDialog.IOptions {
    title: string;
  }
}
