import { JSONExt, JSONObject } from '@phosphor/coreutils';

import { DataGrid, DataModel, TextRenderer } from '@phosphor/datagrid';

import { Message } from '@phosphor/messaging';

import {
  Panel,
  PanelLayout,
  SplitLayout,
  SplitPanel,
  StackedPanel,
  Widget
} from '@phosphor/widgets';

import { ISignal, Signal } from '@phosphor/signaling';

import { MainAreaWidget, ToolbarButton } from '@jupyterlab/apputils';

import { CodeEditor, CodeEditorWrapper } from '@jupyterlab/codeeditor';

import {
  IOmniSciConnectionData,
  IOmniSciConnectionManager,
  makeConnection,
  OmniSciConnection
} from './connection';

/**
 * The default block size whenn streaming blocks of the query results.
 */
const BLOCK_SIZE = 50000;

/**
 * The default limit for standalone requests.
 */
const DEFAULT_LIMIT = 50000;

export class OmniSciSQLEditor extends MainAreaWidget<Widget> {
  /**
   * Construct a new OmniSciSQLEditor widget.
   */
  constructor(options: OmniSciSQLEditor.IOptions) {
    const connection =
      options.connectionData ||
      (options.manager && options.manager.defaultConnection);
    const content = new SplitPanel({ orientation: 'vertical', spacing: 0 });
    const grid = new OmniSciGrid({
      connectionData: connection,
      sessionId: options.sessionId,
      initialQuery: options.initialQuery || ''
    });
    const toolbar = Private.createToolbar(
      grid,
      options.editorFactory,
      options.manager
    );
    (content.layout as SplitLayout).addWidget(toolbar);
    (content.layout as SplitLayout).addWidget(grid);
    super({ content });
    content.setRelativeSizes([0.1, 0.9]);
    this._grid = grid;
    this._tool = toolbar;
    this.addClass('omnisci-OmniSciSQLEditor');
  }

  /**
   * Get a reference to the input editor.
   */
  get input(): CodeEditorWrapper {
    return this._tool.children().next() as CodeEditorWrapper;
  }

  /**
   * Get a reference to the grid widget.
   */
  get grid(): OmniSciGrid {
    return this._grid;
  }

  /**
   * Handle the DOM events for the widget.
   *
   * @param event - The DOM event sent to the widget.
   *
   * #### Notes
   * This method implements the DOM `EventListener` interface and is
   * called in response to events on the main area widget's node. It should
   * not be called directly by user code.
   */
  handleEvent(event: KeyboardEvent): void {
    switch (event.type) {
      case 'keydown':
        switch (event.keyCode) {
          case 13: // Enter
            event.stopPropagation();
            event.preventDefault();
            this._grid.query = this.input.editor.model.value.text;
            break;
          default:
            break;
        }
        break;
      default:
        break;
    }
  }

  /**
   * Handle `after-attach` messages for the widget.
   */
  protected onAfterAttach(msg: Message): void {
    this.input.node.addEventListener('keydown', this, true);
  }

  /**
   * Handle `before-detach` messages for the widget.
   */
  protected onBeforeDetach(msg: Message): void {
    this.input.node.removeEventListener('keydown', this, true);
  }

  /**
   * Handle `'activate-request'` messages.
   */
  protected onActivateRequest(msg: Message): void {
    this._focusInput();
  }

  /**
   * Focus the toolbar editor widget.
   */
  private _focusInput(): void {
    this.input.activate();
  }

  private _grid: OmniSciGrid;
  private _tool: Panel;
}

/**
 * A namespace for OmniSciSQLEditor statics.
 */
export namespace OmniSciSQLEditor {
  /**
   * Options for creating a new OmniSciSQLEditor.
   */
  export interface IOptions {
    /**
     * An editor factory for the SQL editor widget.
     */
    editorFactory: CodeEditor.Factory;

    /**
     * An optional initial connection data structure.
     */
    connectionData?: IOmniSciConnectionData;

    /**
     * An optional pre-authenticated session ID for the SQL editor.
     */
    sessionId?: string;

    /**
     * An optional initial query for the editor.
     */
    initialQuery?: string;

    /**
     * An optional connection manager.
     */
    manager?: IOmniSciConnectionManager;
  }
}

/**
 * A widget that hosts a phosphor grid with a OmniSci dataset.
 */
export class OmniSciGrid extends Panel {
  /**
   * Construct a new OmniSciGrid widget.
   */
  constructor(options: OmniSciGrid.IOptions = {}) {
    super();
    this.addClass('omnisci-OmniSciGrid');
    // Create the Layout
    this._content = new StackedPanel();
    this._content.addClass('omnisci-OmniSciGrid-content');
    this._error = new Widget({ node: document.createElement('pre') });
    this._error.addClass('omnisci-ErrorMessage');
    this.addWidget(this._content);
    this.addWidget(this._error);

    // Create the data model
    this._model = new OmniSciTableModel();

    // Create the grid
    const renderer = new TextRenderer({
      textColor: '#111111',
      horizontalAlignment: 'right'
    });
    const gridStyle: DataGrid.IStyle = {
      ...DataGrid.defaultStyle,
      rowBackgroundColor: i => (i % 2 === 0 ? 'rgba(34, 167, 240, 0.2)' : '')
    };
    this._grid = new DataGrid({
      style: gridStyle,
      baseRowSize: 24,
      baseColumnSize: 144,
      baseColumnHeaderSize: 36,
      baseRowHeaderSize: 64
    });
    this._grid.defaultRenderer = renderer;
    this._grid.model = this._model;
    this._content.addWidget(this._grid);
    this._content.hide(); // Initially hide the grid until we set the query.

    // Initialize the data model.
    void this._updateModel(
      options.connectionData,
      options.initialQuery || '',
      options.sessionId
    );
  }

  /**
   * The current connection data for the viewer.
   */
  get connectionData(): IOmniSciConnectionData | undefined {
    return this._model.connectionData;
  }
  async setConnectionData(
    value: IOmniSciConnectionData | undefined,
    sessionId?: string
  ): Promise<void> {
    await this._updateModel(value, this._model.query, sessionId);
  }

  /**
   * The current style used by the grid viewer.
   */
  get style(): DataGrid.IStyle {
    return this._grid.style;
  }
  set style(value: DataGrid.IStyle) {
    this._grid.style = value;
  }

  /**
   * The text renderer for the viewer.
   */
  get renderer(): TextRenderer {
    return this._grid.defaultRenderer as TextRenderer;
  }
  set renderer(value: TextRenderer) {
    this._grid.defaultRenderer = value;
  }

  /**
   * The query for the viewer.
   */
  get query(): string {
    return this._model.query;
  }
  set query(value: string) {
    void this._updateModel(
      this._model.connectionData,
      value,
      this._model.sessionId
    );
  }

  /**
   * Get the session ID for the current connection.
   */
  get sessionId(): string | undefined {
    return this._model.sessionId;
  }

  /**
   * A change signal emitted when the connection or
   * query data change.
   */
  get onModelChanged(): ISignal<OmniSciGrid, void> {
    return this._onModelChanged;
  }

  /**
   * Update the underlying data model with a new query and connection.
   *
   * If the update fails, either due to a connection failure or a query
   * validation failure, it shows the error in the panel.
   */
  private async _updateModel(
    connectionData: IOmniSciConnectionData | undefined,
    query: string,
    sessionId?: string
  ): Promise<void> {
    const hasQuery = query !== '';
    await this._model
      .updateModel(connectionData, query, sessionId)
      .then(() => {
        this._content.setHidden(!hasQuery);
        this._error.hide();
        this._error.node.textContent = '';
      })
      .catch((err: any) => {
        let msg =
          (err.error_msg as string) || (err.message as string) || String(err);
        this._content.hide();
        this._error.show();
        this._error.node.textContent = msg;
      });
    this._onModelChanged.emit(void 0);
  }

  private _model: OmniSciTableModel;
  private _grid: DataGrid;
  private _content: StackedPanel;
  private _error: Widget;
  private _onModelChanged = new Signal<this, void>(this);
}

/**
 * A namespace for OmniSciGrid statics.
 */
export namespace OmniSciGrid {
  /**
   * Options for creating a new OmniSciGrid.
   */
  export interface IOptions {
    /**
     * An optional initial connection data structure.
     */
    connectionData?: IOmniSciConnectionData;

    /**
     * An optional pre-authenticated session ID for the grid.
     */
    sessionId?: string;

    /**
     * An optional initial query for the editor.
     */
    initialQuery?: string;
  }
}

/**
 * A data model for a query.
 */
export class OmniSciTableModel extends DataModel {
  /**
   * Construct a new data model.
   */
  constructor() {
    super();
    void this._updateModel();
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
    return region === 'body' ? this._fieldNames.length : 1;
  }

  /**
   * The current connection data for the model.
   */
  get connectionData(): IOmniSciConnectionData | undefined {
    return this._connectionData;
  }

  /**
   * The current query for the viewer.
   */
  get query(): string {
    return this._query;
  }

  /**
   * Get the session ID for the current connection.
   */
  get sessionId(): string | undefined {
    if (!this._connection) {
      return undefined;
    }
    const ids = this._connection.sessionId();
    return ids.length ? ids[0] : undefined;
  }

  /**
   * Get data from the model.
   */
  data(region: DataModel.CellRegion, row: number, column: number): any {
    if (region === 'row-header') {
      return String(row + 1);
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
      const blockIndex = Math.floor(row / BLOCK_SIZE);
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
      if (
        blockIndex <= this._maxBlock &&
        localRow / BLOCK_SIZE > 0.9 &&
        !this._dataBlocks[blockIndex + 1]
      ) {
        void this._fetchBlock(blockIndex + 1);
      }

      // Check if we should fetch the previous block.
      if (
        blockIndex >= 1 &&
        localRow / BLOCK_SIZE < 0.1 &&
        !this._dataBlocks[blockIndex - 1]
      ) {
        void this._fetchBlock(blockIndex - 1);
      }

      // If the current block has not been loaded, then load it and
      // return null. The grid will be notified when it is loaded.
      // If the current block has been loaded, then return the data from it.
      if (!this._dataBlocks[blockIndex]) {
        void this._fetchBlock(blockIndex);
        return null;
      } else {
        const block = this._dataBlocks[blockIndex];
        const rowData = block[row - offset];
        return rowData[this._fieldNames[column]];
      }
    } else {
      // If we are not streaming, then just return the loaded data.
      const rowData = this._dataset![row];
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
  async updateModel(
    connectionData: IOmniSciConnectionData | undefined,
    query: string,
    sessionId?: string
  ): Promise<void> {
    const sameConnection =
      connectionData &&
      this._connectionData &&
      this._connection &&
      JSONExt.deepEqual(
        connectionData as JSONObject,
        this._connectionData as JSONObject
      );
    // If nothing has changed, do nothing.
    if (sameConnection && this._query === query) {
      return Promise.resolve(void 0);
    }
    if (!sameConnection) {
      this._connectionData = connectionData;
      this._connection = connectionData
        ? await makeConnection(connectionData, sessionId)
        : undefined;
    }
    this._query = query;
    await this._updateModel();
  }

  /**
   * Reset the model. Should be called when either
   * the query or the connection data change.
   */
  private async _updateModel(): Promise<void> {
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

    if (this.query && this.connectionData) {
      this._streaming = Private.shouldChunkRequests(this._query);
      await this._makeQuery();
    } else {
      this.emitChanged({ type: 'model-reset' });
    }
  }

  /**
   * Make a query to the database.
   */
  private async _makeQuery(): Promise<void> {
    if (!this._connection || !this._query) {
      return;
    }
    try {
      void (await Private.validateQuery(this._connection, this._query));
      this.emitChanged({ type: 'model-reset' });
      if (this._streaming) {
        return this._fetchBlock(0);
      } else {
        return this._fetchDataset();
      }
    } catch (err) {
      this.emitChanged({ type: 'model-reset' });
      throw err;
    }
  }

  /**
   * Fetch a block with a given index into memory.
   */
  private async _fetchBlock(index: number): Promise<void> {
    if (!this._connection) {
      return Promise.resolve(void 0);
    }
    // If we are already fetching this block, do nothing.
    if (this._pending.has(index)) {
      return Promise.resolve(void 0);
    }
    this._pending.add(index);

    // Augment the query with the relevant LIMIT and OFFSET.
    const limit = BLOCK_SIZE;
    const offset = index * BLOCK_SIZE;
    const query = `${this._query} LIMIT ${limit} OFFSET ${offset}`;

    const indices = Object.keys(this._dataBlocks).map(key => Number(key));
    const maxIndex = Math.max(...indices);

    const res: any = await Private.makeQuery(this._connection, query);
    this._pending.delete(index);
    if (!this._fieldNames.length) {
      this._fieldNames = res.fields.map((field: any) => field.name as string);
      this.emitChanged({ type: 'model-reset' });
    }
    this._dataBlocks[index] = res.results;
    if (index <= maxIndex || this._tableLength !== -1) {
      // In this case, we are not appending, so emit a changed
      // signal.
      this.emitChanged({
        type: 'cells-changed',
        region: 'body',
        rowIndex: offset,
        columnIndex: 0,
        rowSpan: res.results.length,
        columnSpan: this._fieldNames.length
      });
    } else {
      if (res.results.length < BLOCK_SIZE) {
        // If the length of the result is less than the block size,
        // we have found the table length. Set that.
        this._tableLength = offset + res.results.length;
        this._maxBlock = index;
      }
      // Emit a rows-inserted signal.
      this.emitChanged({
        type: 'rows-inserted',
        region: 'body',
        index: offset,
        span: res.results.length
      });
    }
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
      columnSpan: this._fieldNames.length
    });
  }

  /**
   * If we are not chunking the data, then just load the whole thing,
   * limited by DEFAULT_LIMIT.
   */
  private async _fetchDataset(): Promise<void> {
    if (!this._connection) {
      return Promise.resolve(void 0);
    }
    const res: any = await Private.makeQuery(this._connection, this._query, {
      limit: DEFAULT_LIMIT
    });
    this._fieldNames = res.fields.map((field: any) => field.name as string);
    this.emitChanged({ type: 'model-reset' });
    this._tableLength = res.results.length;
    // If the dataset already exists, emit a cells-changed signal.
    // Otherwise, emit a 'rows-inserted' signal.
    if (this._dataset) {
      this._dataset = res.results;
      this.emitChanged({
        type: 'cells-changed',
        region: 'body',
        rowIndex: 0,
        columnIndex: 0,
        rowSpan: res.results.length,
        columnSpan: this._fieldNames.length
      });
    } else {
      this._dataset = res.results;
      this.emitChanged({
        type: 'rows-inserted',
        region: 'body',
        index: 0,
        span: res.results.length
      });
    }
  }

  private _query = '';
  private _connectionData: IOmniSciConnectionData | undefined;
  private _connection: OmniSciConnection | undefined;

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
   * Create a toolbar. If a connection manager is provided,
   * it will create a change-connection button.
   */
  export function createToolbar(
    widget: OmniSciGrid,
    editorFactory: CodeEditor.Factory,
    manager?: IOmniSciConnectionManager
  ): Panel {
    const toolbar = new Panel();
    toolbar.addClass('omnisci-OmniSci-toolbar');

    // Create the query editor.
    const queryEditor = new CodeEditorWrapper({
      model: new CodeEditor.Model(),
      factory: editorFactory
    });
    queryEditor.editor.setOption('lineWrap', 'on');
    queryEditor.editor.model.value.text = '';
    queryEditor.editor.model.mimeType = 'text/x-sql';

    // Create the toolbar.
    (toolbar.layout as PanelLayout).addWidget(queryEditor);
    (toolbar.layout as PanelLayout).addWidget(
      new ToolbarButton({
        iconClassName: 'jp-RunIcon jp-Icon jp-Icon-16',
        onClick: () => {
          widget.query = queryEditor.editor.model.value.text;
        },
        tooltip: 'Query'
      })
    );
    if (manager) {
      (toolbar.layout as PanelLayout).addWidget(
        new ToolbarButton({
          iconClassName: 'omnisci-OmniSci-logo jp-Icon jp-Icon-16',
          onClick: () => {
            void manager
              .chooseConnection(
                'Set SQL Editor Connection',
                widget.connectionData
              )
              .then(connectionData => {
                return widget.setConnectionData(connectionData);
              });
          },
          tooltip: 'Enter OmniSci Connection Data'
        })
      );
    }

    widget.onModelChanged.connect(() => {
      if (widget.query === queryEditor.editor.model.value.text) {
        return;
      }
      queryEditor.editor.model.value.text = widget.query;
    });

    return toolbar;
  }

  /**
   * Whether to chunk requests to the backend. We only do this is if
   * (1) LIMIT/OFFSET has not been defined.
   * (2) ORDER BY has been defined, otherwise we cannot guarantee a consistent
   * ordering across requests.
   */
  export function shouldChunkRequests(query: string): boolean {
    return (
      query.search(/limit/i) === -1 &&
      query.search(/offset/i) === -1 &&
      query.search(/order by/i) !== -1
    );
  }

  /**
   * Query the OmniSci backend.
   */
  export function makeQuery(
    connection: OmniSciConnection,
    query: string,
    options: Object = {}
  ): Promise<ReadonlyArray<JSONObject>> {
    options = { returnTiming: true, ...options };
    return new Promise<ReadonlyArray<JSONObject>>((resolve, reject) => {
      connection.query(
        query,
        options,
        (err: any, result: ReadonlyArray<JSONObject>) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        }
      );
    });
  }

  /**
   * Validate a query with the OmniSci backend.
   */
  export function validateQuery(
    connection: OmniSciConnection,
    query: string
  ): Promise<ReadonlyArray<JSONObject>> {
    return new Promise<ReadonlyArray<JSONObject>>((resolve, reject) => {
      connection
        .validateQuery(query)
        .then((result: ReadonlyArray<JSONObject>) => {
          resolve(result);
        })
        .catch((err: any) => {
          reject(err);
        });
    });
  }
}
