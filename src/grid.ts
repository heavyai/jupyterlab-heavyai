import {
  JSONObject
} from '@phosphor/coreutils';

import {
  DataGrid, JSONModel
} from '@phosphor/datagrid';

import {
  PanelLayout, StackedPanel, Widget
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
    this._content = new StackedPanel();
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
        this._query(queryInput.value).then(() => {
          this._render();
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
  private _query(query: string): Promise<void> {
    const connection = this._connection;
    return new Promise<void>((resolve, reject) => {
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
            con.query(query, {}, (err: any, result: ReadonlyArray<JSONObject>) => {
              if (err) {
                reject(err);
              } else {
                this._model = Private.constructModel(query, result);
                resolve(void 0);
              }
            });
          }
        });
    });
  }

  private _render(): void {
    if (this._grid) {
      this._grid.parent = null;
      this._grid.dispose();
    }

    this._grid = new DataGrid();
    this._grid.model = this._model;

    this._content.addWidget(this._grid);
  }


  private _model: JSONModel;
  private _grid: DataGrid;
  private _toolbar: Toolbar<any>;
  private _connection: IMapDConnectionData | undefined;
  private _content: StackedPanel;
}


namespace Private {
  export
  function constructModel(query: string, result: ReadonlyArray<JSONObject>): JSONModel {
    let selection = query.match(/SELECT(.*)FROM/i);
    if (!selection) {
      throw Error('Malformed query');
    }
    let fieldNames = selection[1].split(',').map(sel => {
      let test = sel.split(' as ');
      if (test.length === 2) {
        return test[1].trim();
      }
      test = sel.split(' AS ');
      if (test.length === 2) {
        return test[1].trim();
      }
      return sel.trim();
    });
    let fields = fieldNames.map(name => {
      return {
        "name": name,
        "type": "string",
      };
    });
    let schema = {
      "fields": fields
    };
    return new JSONModel({
      "data": result,
      "schema": schema
    });
  }
}
