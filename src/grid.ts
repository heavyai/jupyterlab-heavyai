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

const BLOCK_SIZE = 50000;

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

    // Add an `Enter` keydown handler for the input field.
    queryInput.onkeydown = (event: KeyboardEvent) => {
      switch (event.keyCode) {
        case 13: // Enter
          event.stopPropagation();
          event.preventDefault();
          this._model.query = queryInput.value;
          break;
        default:
          break;
      }
    };

    // Create the toolbar.
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
    if (region === 'column-header') {
      return 1;
    }
    if (this._tableLength > 0) {
      return this._tableLength;
    }

    const indices = Object.keys(this._dataBlocks).map(key => Number(key));
    if (indices.length === 0) {
      return 0;
    }
    const maxIndex = Math.max(...indices);
    return BLOCK_SIZE * maxIndex + this._dataBlocks[maxIndex].length;
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
      return String(row+1);
    }

    if (region === 'column-header') {
      return this._fieldNames[column];
    }

    if (region === 'corner-header') {
      return null;
    }

    const blockIndex = Math.floor(row/BLOCK_SIZE);
    const offset = BLOCK_SIZE * blockIndex;
    const localRow = row - offset;

    // Trash other blocks that we don't need.
    const keep = [0, blockIndex + 1, blockIndex, blockIndex - 1];
    Object.keys(this._dataBlocks).forEach(index => {
      let idx = Number(index);
      if (keep.indexOf(idx) === -1) {
        this._freeBlock(idx);
      }
    });

    // Check if we should fetch the next block.
    if (blockIndex <= this._maxBlock && localRow / BLOCK_SIZE > 0.9 && !this._dataBlocks[blockIndex+1]) {
      this._fetchBlock(blockIndex + 1);
    }

    // Check if we should fetch the previous block.
    if (blockIndex >= 1 && localRow / BLOCK_SIZE < 0.1 && !this._dataBlocks[blockIndex-1]) {
      this._fetchBlock(blockIndex - 1);
    }

    if (!this._dataBlocks[blockIndex]) {
      this._fetchBlock(blockIndex);
      return null;
    } else {
      const block = this._dataBlocks[blockIndex];
      const rowData = block[row - offset];
      return rowData[this._fieldNames[column]];
    }
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

  /**
   * Reset the model. Should be called when either
   * the query or the connection data change.
   */
  private _updateModel(): void {
    for (let key of Object.keys(this._dataBlocks)) {
      delete this._dataBlocks[Number(key)];
    }
    this._fieldNames = [];
    this._tableLength = -1;
    this._maxBlock = Infinity;
    this._pending.clear();

    if (this.query) {
      this._fieldNames = Private.getFields(this._query);
      this._fetchBlock(0);
    }
    this.emitChanged({ type: 'model-reset' });
    return;
  }

  private _fetchBlock(index: number): void {
    if (this._pending.has(index)) {
      return;
    }
    this._pending.add(index);
    const limit = BLOCK_SIZE;
    const offset = index * BLOCK_SIZE;
    const query = `${this._query} LIMIT ${limit} OFFSET ${offset}`;

    const indices = Object.keys(this._dataBlocks).map(key => Number(key));
    const maxIndex = Math.max(...indices);

    console.log(`Fetching block ${index}`);
    Private.makeQuery(this._connection, query).then(res => {
      this._pending.delete(index);
      console.log(`Fetched block ${index}`);
      this._dataBlocks[index] = res;
      if (index <= maxIndex || this._tableLength !== -1) {
        this.emitChanged({
          type: 'cells-changed',
          region: 'body',
          rowIndex: offset,
          columnIndex: 0,
          rowSpan: res.length,
          columnSpan: this._fieldNames.length,
        });
      } else {
        if (res.length < BLOCK_SIZE) {
          this._tableLength = offset + res.length;
          this._maxBlock = index;
          console.log('table length found!', this._tableLength);
        }
        this.emitChanged({
          type: 'rows-inserted',
          region: 'body',
          index: offset,
          span: res.length,
        });
      }
    });
  }

  private _freeBlock(index: number): void {
    if (!this._dataBlocks[index]) {
      return;
    }
    const offset = index * BLOCK_SIZE;
    const length = this._dataBlocks[index].length;
    delete this._dataBlocks[index];
    this.emitChanged({
      type: 'cells-changed',
      region: 'body',
      rowIndex: offset,
      columnIndex: 0,
      rowSpan: length,
      columnSpan: this._fieldNames.length,
    });
  }


  private _query = '';
  private _connection: IMapDConnectionData | undefined;

  private _fieldNames: string[];
  private _dataBlocks: { [idx: number]: ReadonlyArray<JSONObject> } = {};
  private _pending = new Set<number>();
  private _tableLength = -1;
  private _maxBlock = Infinity;
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
