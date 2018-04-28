import {
  JSONExt, JSONObject
} from '@phosphor/coreutils';

import {
  DataGrid, DataModel
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
    // Create the Layout
    this.layout = new PanelLayout();
    this._toolbar = new Toolbar();
    this._toolbar.addClass('mapd-MapD-toolbar');
    this._content = new StackedPanel();
    this._content.addClass('mapd-MapDViewer-content');
    (this.layout as PanelLayout).addWidget(this._toolbar);
    (this.layout as PanelLayout).addWidget(this._content);

    // Create the data model
    this._model = new MapDTableModel();
    this._model.connection = connection;

    // Create the grid
    this._grid = new DataGrid();
    this._grid.model = this._model;
    this._content.addWidget(this._grid);

    // Create the query input box
    const queryInput = document.createElement('input');
    queryInput.value = '';
    queryInput.placeholder = 'SQL Query';
    const queryInputWidget = new Widget({ node: queryInput });

    this._toolbar.addItem('QueryInput', queryInputWidget);
    this._toolbar.addItem('Query', new ToolbarButton({
      className: 'jp-RunIcon',
      onClick: () => {
        this._model.query = queryInput.value;
      },
      tooltip: 'Query'
    }));
    this._toolbar.addItem('Connect', new ToolbarButton({
      className: 'mapd-MapD-logo',
      onClick: () => {
        showConnectionDialog(this._model.connection).then(connection => {
          this._model.connection = connection;
        });
      },
      tooltip: 'Enter MapD Connection Data'
    }));
  }

  /**
   * The current connection data for the viewer.
   */
  get connection(): IMapDConnectionData {
    return this._model.connection;
  }
  set connection(value: IMapDConnectionData) {
    this._model.connection = value;
  }


  private _model: MapDTableModel;
  private _grid: DataGrid;
  private _toolbar: Toolbar<any>;
  private _content: StackedPanel;
}

export
class MapDTableModel extends DataModel {
  constructor() {
    super();
    this._updateModel();
  }
 
  /**
   * Get the number of rows for the model.
   */
  rowCount(region: DataModel.RowRegion): number {
    return region === 'body' ? this._data.length: 1;
  }

  /**
   * Get the number of columns for the model.
   */
  columnCount(region: DataModel.ColumnRegion): number {
    return region === 'body' ? this._fieldNames.length: 1;
  }

  /**
   * The current connection data for the model.
   */
  get connection(): IMapDConnectionData | undefined {
    return this._connection;
  }
  set connection(value: IMapDConnectionData | undefined) {
    if (this._connection && JSONExt.deepEqual(value, this._connection)) {
      return;
    }
    this._connection = value;
    this._updateModel();
  }

  /**
   * Get data from the model.
   */
  data(region: DataModel.CellRegion, row: number, column: number): any {
    if (region === 'row-header') {
      return String(row);
    }

    if (region === 'column-header') {
      return this._fieldNames[column];
    }

    if (region === 'corner-header') {
      return null;
    }

    const rowData = this._data[row];
    return rowData[this._fieldNames[column]];
  }


  /**
   * The current query for the viewer.
   */
  get query(): string {
    return this._query;
  }
  set query(value: string) {
    if (this._query === value) {
      return;
    }
    this._query = value;
    this._updateModel();
  }

  private _updateModel(): void {
    if (!this.query) {
      this._data = [];
      this._fieldNames = [];
      this.emitChanged({ type: 'model-reset' });
      return;
    }
    this._fieldNames = Private.getFields(this._query);
    Private.makeQuery(this._connection, this._query).then(res => {
      this._data = res;
      this.emitChanged({ type: 'model-reset' });
    });
  }

  private _fieldNames: string[];
  private _query = '';
  private _connection: IMapDConnectionData | undefined;
  private _data: ReadonlyArray<JSONObject> = [];
}




namespace Private {
  export
  function getFields(query: string): string[] {
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
    return fieldNames;
  }

  /**
   * Query the MapD backend.
   */
  export
  function makeQuery(connection: IMapDConnectionData, query: string): Promise<ReadonlyArray<JSONObject>> {
    return new Promise<ReadonlyArray<JSONObject>>((resolve, reject) => {
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
                resolve(result);
              }
            });
          }
        });
    });
  }
}
