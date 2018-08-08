import { Dialog, showDialog } from '@jupyterlab/apputils';

import { CompletionHandler } from '@jupyterlab/completer';

import { DataConnector } from '@jupyterlab/coreutils';

import { JSONObject } from '@phosphor/coreutils';

import { PanelLayout, Widget } from '@phosphor/widgets';

import './browser-connector';

declare const MapdCon: any;

/**
 * Connection data for the mapd browser client.
 */
export interface IMapDConnectionData extends JSONObject {
  /**
   * The host of the connection, e.g. `metis.mapd.com`.
   */
  host: string;

  /**
   * The protocol to use, e.g. `https`.
   */
  protocol: string;

  /**
   * The port to use, e.g. `443`.
   */
  port: string;

  /**
   * The user name.
   */
  user: string;

  /**
   * The database name.
   */
  dbName: string;

  /**
   * The password for the connection.
   */
  password: string;
}

/**
 * Show a dialog for entering MapD connection data.
 */
export function showConnectionDialog(
  oldConnection?: IMapDConnectionData
): Promise<IMapDConnectionData> {
  return showDialog<IMapDConnectionData>({
    title: 'MapD Connection',
    body: new MapDConnectionDialog(oldConnection),
    buttons: [Dialog.cancelButton(), Dialog.okButton()]
  }).then(result => {
    if (result.button.accept) {
      return result.value;
    } else {
      return oldConnection;
    }
  });
}

/**
 * A dialog for entering MapD connection data.
 */
export class MapDConnectionDialog extends Widget
  implements Dialog.IBodyWidget<IMapDConnectionData> {
  constructor(oldData?: IMapDConnectionData) {
    super();
    let layout = (this.layout = new PanelLayout());

    this._user = document.createElement('input');
    this._password = document.createElement('input');
    this._database = document.createElement('input');
    this._host = document.createElement('input');
    this._protocol = document.createElement('input');
    this._port = document.createElement('input');

    this._user.placeholder = 'User name';
    this._password.placeholder = 'Password';
    this._database.placeholder = 'Database name';
    this._host.placeholder = 'Host name';
    this._protocol.placeholder = 'Protocol';
    this._port.placeholder = 'Port';
    if (oldData) {
      this._user.value = oldData.user;
      this._password.value = oldData.password;
      this._database.value = oldData.dbName;
      this._host.value = oldData.host;
      this._protocol.value = oldData.protocol;
      this._port.value = oldData.port;
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

  getValue(): IMapDConnectionData {
    return {
      user: this._user.value,
      password: this._password.value,
      dbName: this._database.value,
      host: this._host.value,
      protocol: this._protocol.value,
      port: this._port.value
    };
  }

  private _user: HTMLInputElement;
  private _password: HTMLInputElement;
  private _database: HTMLInputElement;
  private _host: HTMLInputElement;
  private _protocol: HTMLInputElement;
  private _port: HTMLInputElement;
}

/**
 * A class for fetching completion data from a MapD connection.
 */
export class MapDCompletionConnector extends DataConnector<
  CompletionHandler.IReply,
  void,
  CompletionHandler.IRequest
> {
  /**
   * Construct a new completion connector.
   */
  constructor(connection: IMapDConnectionData) {
    super();
    this._connection = connection;
  }

  /**
   * Fetch completion data from the MapD backend.
   */
  fetch(
    request: CompletionHandler.IRequest
  ): Promise<CompletionHandler.IReply | undefined> {
    const connection = this._connection;
    return new Promise<CompletionHandler.IReply>((resolve, reject) => {
      new MapdCon()
        .protocol(connection.protocol)
        .host(connection.host)
        .port(connection.port)
        .dbName(connection.dbName)
        .user(connection.user)
        .password(connection.password)
        .connect((error: any, con: any) => {
          if (error) {
            reject(error);
          } else {
            con.getCompletionHints(
              request.text,
              { cursor: request.offset },
              (err: any, result: any) => {
                if (err) {
                  reject(err);
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
          }
        });
    });
  }

  private _connection: IMapDConnectionData;
}
