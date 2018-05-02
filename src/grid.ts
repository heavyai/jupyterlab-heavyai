import {
  JSONExt, JSONObject
} from '@phosphor/coreutils';

import {
  DataGrid, DataModel, TextRenderer
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

/**
 * The default block size whenn streaming blocks of the query results.
 */
const BLOCK_SIZE = 50000;

/**
 * The default limit for standalone requests.
 */
const DEFAULT_LIMIT = 50000;

/**
 * A widget that hosts a phosphor grid with a MapD dataset.
 */
export
class MapDGrid extends Widget {
  /**
   * Construct a new MapDGrid widget.
   */
  constructor(connection?: IMapDConnectionData) {
    super();
    // Create the Layout
    this.layout = new PanelLayout();
    this._toolbar = new Toolbar();
    this._toolbar.addClass('mapd-MapD-toolbar');
    this._content = new StackedPanel();
    this._content.addClass('mapd-MapDViewer-content');
    this._error = new Widget({ node: document.createElement('pre') });
    this._error.addClass('mapd-ErrorMessage');
    (this.layout as PanelLayout).addWidget(this._toolbar);
    (this.layout as PanelLayout).addWidget(this._content);
    (this.layout as PanelLayout).addWidget(this._error);

    // Create the data model
    this._model = new MapDTableModel();

    // Create the grid
    const headerRenderer = new TextRenderer({
      font: 'bold 14px sans-serif',
      horizontalAlignment: 'left'
    });
    const bodyRenderer = new TextRenderer({
      horizontalAlignment: 'right'
    });
    this._gridStyle = {
      ...DataGrid.defaultStyle,
      rowBackgroundColor: i => i % 2 === 0 ? 'rgba(34, 167, 240, 0.2)' : ''
    };
    this._grid = new DataGrid({
      style: this._gridStyle,
      baseRowSize: 24,
      baseColumnSize: 96,
      baseColumnHeaderSize: 24,
      baseRowHeaderSize: 64,
    });
    this._grid.cellRenderers.set('body', {}, bodyRenderer);
    this._grid.cellRenderers.set('column-header', {}, headerRenderer);
    this._grid.model = this._model;
    this._content.addWidget(this._grid);
    this._content.hide(); // Initially hide the grid until we set the query.

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
          this._updateModel(this._model.connection, queryInput.value);
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
        this._updateModel(this._model.connection, queryInput.value);
      },
      tooltip: 'Query'
    }));
    this._toolbar.addItem('Connect', new ToolbarButton({
      className: 'mapd-MapD-logo',
      onClick: () => {
        showConnectionDialog(this._model.connection).then(connection => {
          this._updateModel(connection, this._model.query);
        });
      },
      tooltip: 'Enter MapD Connection Data'
    }));

    // Initialize the data model.
    this._updateModel(connection, '');
  }

  /**
   * The current connection data for the viewer.
   */
  get connection(): IMapDConnectionData {
    return this._model.connection;
  }
  set connection(value: IMapDConnectionData) {
    this._updateModel(value, this._model.query);
  }

  /**
   * Update the underlying data model with a new query and connection.
   *
   * If the update fails, either due to a connection failure or a query
   * validation failure, it shows the error in the panel.
   */
  private _updateModel(connection: IMapDConnectionData, query: string): void {
    const hasQuery = query !== '';
    this._model.updateModel(connection, query).then(() => {
      this._content.setHidden(!hasQuery);
      this._error.node.textContent = '';
    }).catch((err: any) => {
      this._content.hide()
      this._error.node.textContent = err ? (err.message || err) : 'Error';
    });
  }

  private _model: MapDTableModel;
  private _grid: DataGrid;
  private _gridStyle: DataGrid.IStyle;
  private _toolbar: Toolbar<any>;
  private _content: StackedPanel;
  private _error: Widget;
}

/**
 * A data model for a query.
 */
export
class MapDTableModel extends DataModel {
  /**
   * Construct a new data model.
   */
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
    // If we have found the length of the table, return that.
    if (this._tableLength > 0) {
      return this._tableLength;
    }

    // If we don't know the length, try to infer it from the currently
    // loaded blocks.
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

  /**
   * The current query for the viewer.
   */
  get query(): string {
    return this._query;
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

    // If we are streaming data, first check to see if the
    // relevant block is loaded into memory. If it is not,
    // load it. Also load the blocks on each side of the relevant block,
    // and free blocks outside of that window.
    if (this._streaming) {
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
      if (blockIndex <= this._maxBlock &&
          localRow / BLOCK_SIZE > 0.9 &&
          !this._dataBlocks[blockIndex+1]
      ) {
        this._fetchBlock(blockIndex + 1);
      }

      // Check if we should fetch the previous block.
      if (blockIndex >= 1 &&
          localRow / BLOCK_SIZE < 0.1 &&
          !this._dataBlocks[blockIndex-1]
      ) {
        this._fetchBlock(blockIndex - 1);
      }

      // If the current block has not been loaded, then load it and
      // return null. The grid will be notified when it is loaded.
      // If the current block has been loaded, then return the data from it.
      if (!this._dataBlocks[blockIndex]) {
        this._fetchBlock(blockIndex);
        return null;
      } else {
        const block = this._dataBlocks[blockIndex];
        const rowData = block[row - offset];
        return rowData[this._fieldNames[column]];
      }
    } else {
      // If we are not streaming, then just return the loaded data.
      const rowData = this._dataset[row];
      return rowData[this._fieldNames[column]];
    }
  }


  /**
   * Update the model with new connection data or a new query.
   *
   * @param connection - the connection data to use.
   *
   * @param query - the query to use.
   *
   * @returns a promsise that resolves when the model has been updated,
   *   and the connection and query data have been validated. It throws
   *   an error if the validation fails.
   */
  updateModel(connection: IMapDConnectionData, query: string): Promise<void> {
    if (this._query === query && connection && this._connection
        && JSONExt.deepEqual(connection, this._connection)) {
      return Promise.resolve(void 0);
    }
    this._query = query;
    this._connection = connection;
    return this._updateModel();
  };

  /**
   * Reset the model. Should be called when either
   * the query or the connection data change.
   */
  private _updateModel(): Promise<void> {
    // Clear the data of any previous model
    for (let key of Object.keys(this._dataBlocks)) {
      delete this._dataBlocks[Number(key)];
    }
    this._dataset = null;
    this._fieldNames = [];
    this._tableLength = -1;
    this._maxBlock = Infinity;
    this._pending.clear();
    this._streaming = false;

    if (this.query) {
      this._streaming = Private.shouldChunkRequests(this._query);
      return Private.getFields(this._connection, this._query).then(names => {
        this._fieldNames = names;
        this.emitChanged({ type: 'model-reset' });
        if (this._streaming) {
          this._fetchBlock(0);
        } else {
          this._fetchDataset();
        }
      }).catch(err => {
        this.emitChanged({ type: 'model-reset' });
        throw err;
      });
    } else {
      this.emitChanged({ type: 'model-reset' });
      return Promise.resolve(void 0);
    }
  }

  /**
   * Fetch a block with a given index into memory.
   */
  private _fetchBlock(index: number): void {
    // If we are already fetching this block, do nothing.
    if (this._pending.has(index)) {
      return;
    }
    this._pending.add(index);

    // Augment the query with the relevant LIMIT and OFFSET.
    const limit = BLOCK_SIZE;
    const offset = index * BLOCK_SIZE;
    const query = `${this._query} LIMIT ${limit} OFFSET ${offset}`;

    const indices = Object.keys(this._dataBlocks).map(key => Number(key));
    const maxIndex = Math.max(...indices);

    Private.makeQuery(this._connection, query).then(res => {
      this._pending.delete(index);
      this._dataBlocks[index] = res;
      if (index <= maxIndex || this._tableLength !== -1) {
        // In this case, we are not appending, so emit a changed
        // signal.
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
          // If the length of the result is less than the block size,
          // we have found the table length. Set that.
          this._tableLength = offset + res.length;
          this._maxBlock = index;
        }
        // Emit a rows-inserted signal.
        this.emitChanged({
          type: 'rows-inserted',
          region: 'body',
          index: offset,
          span: res.length,
        });
      }
    });
  }

  /**
   * Free references to a block when it is no longer needed.
   */
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

  /**
   * If we are not chunking the data, then just load the whole thing,
   * limited by DEFAULT_LIMIT.
   */
  private _fetchDataset(): void {
    Private.makeQuery(this._connection, this._query, { limit: DEFAULT_LIMIT }).then(res => {
      this._tableLength = res.length;
      // If the dataset already exists, emit a cells-changed signal.
      // Otherwise, emit a 'rows-inserted' signal.
      if (this._dataset) {
        this._dataset = res;
        this.emitChanged({
          type: 'cells-changed',
          region: 'body',
          rowIndex: 0,
          columnIndex: 0,
          rowSpan: res.length,
          columnSpan: this._fieldNames.length,
        });
      } else {
        this._dataset = res;
        this.emitChanged({
          type: 'rows-inserted',
          region: 'body',
          index: 0,
          span: res.length,
        });
      }
    });
  }

  private _query = '';
  private _connection: IMapDConnectionData | undefined;

  private _fieldNames: string[];
  private _dataBlocks: { [idx: number]: ReadonlyArray<JSONObject> } = {};
  private _dataset: ReadonlyArray<JSONObject> | null = null;
  private _pending = new Set<number>();
  private _tableLength = -1;
  private _maxBlock = Infinity;
  private _streaming = false;
}




namespace Private {
  /**
   * Whether to chunk requests to the backend. We only do this is if
   * (1) LIMIT/OFFSET has not been defined.
   * (2) ORDER BY has been defined, otherwise we cannot guarantee a consistent
   * ordering across requests.
   */
  export
  function shouldChunkRequests(query: string): boolean {
    return query.search(/limit/i) === -1 && query.search(/offset/i) === -1
           && query.search(/order by/i) !== -1;
  }

  /**
   * Validate a query, getting the fields that will be returned by the query.
   */
  export
  function getFields(connection: IMapDConnectionData, query: string): Promise<string[]> {
    return validateQuery(connection, query).then(res => {
      return res.map(item => item.name as string);
    });
  }

  /**
   * Query the MapD backend.
   */
  export
  function makeQuery(connection: IMapDConnectionData, query: string, options: Object = {}): Promise<ReadonlyArray<JSONObject>> {
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
            con.query(query, options, (err: any, result: ReadonlyArray<JSONObject>) => {
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

  /**
   * Validate a query with the MapD backend.
   */
  function validateQuery(connection: IMapDConnectionData, query: string): Promise<ReadonlyArray<JSONObject>> {
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
            con.validateQuery(query).then((result: ReadonlyArray<JSONObject>) => {
              resolve(result);
            }).catch((err: any) => { reject(err); });
          }
        });
    });
  }
}
