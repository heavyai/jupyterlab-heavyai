import {
  JSONObject
} from '@phosphor/coreutils';

import {
  PanelLayout, Widget
} from '@phosphor/widgets';

import {
  Toolbar, ToolbarButton
} from '@jupyterlab/apputils';

import {
  IMapDConnectionData, showConnectionDialog
} from './connection';

import 'mapd-connector/dist/browser-connector.js';

declare const MapdCon: any

export
class MapDGrid extends Widget {
  constructor(connection?: IMapDConnectionData) {
    super();
    this.connection = connection;
    this.title.label = 'MapD Grid';

    this.layout = new PanelLayout();
    this._toolbar = new Toolbar();
    this._toolbar.addClass('mapd-MapD-toolbar');
    this._content = new Widget();
    this._content.addClass('mapd-MapDViewer-content');


    (this.layout as PanelLayout).addWidget(this._toolbar);
    (this.layout as PanelLayout).addWidget(this._content);

    // Create the query input box
    const queryInput = document.createElement('input');
    queryInput.value = '';
    queryInput.placeholder = 'SQL Query';
    const queryInputWidget = new Widget({ node: queryInput });

    this._toolbar.addItem('QueryInput', queryInputWidget);
    this._toolbar.addItem('Query', new ToolbarButton({
      className: 'jp-RunIcon',
      onClick: () => {
        this._query(queryInput.value).then(data => {
          this._render(data);
        });
      },
      tooltip: 'Query'
    }));
    this._toolbar.addItem('Connect', new ToolbarButton({
      className: 'mapd-MapD-logo',
      onClick: () => {
        showConnectionDialog(this._connection).then(connection => {
          this._connection = connection;
        });
      },
      tooltip: 'Enter MapD Connection Data'
    }));
  }

  /**
   * The current connection data for the viewer.
   */
  get connection(): IMapDConnectionData {
    return this._connection;
  }
  set connection(value: IMapDConnectionData) {
    this._connection = value;
  }

  /**
   * Query the MapD backend.
   */
  private _query(query: string): Promise<JSONObject> {
    const connection = this._connection;
    return new Promise<JSONObject>((resolve, reject) => {
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
          }
          else {
            con.validateQuery(query).then((res: any) => {
              resolve(res);
            }).catch((res: any) => {
              reject(res);
            });
          }
        });
    });
  }

  private _render(data: JSONObject): void {
    this._content.node.textContent = JSON.stringify(data);
  }


  private _toolbar: Toolbar<any>;
  private _connection: IMapDConnectionData | undefined;
  private _content: Widget;
}
