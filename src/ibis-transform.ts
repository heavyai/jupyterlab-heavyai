import { Kernel } from '@jupyterlab/services';

import { JSONObject, PromiseDelegate } from '@phosphor/coreutils';

import * as dataflow from 'vega-dataflow';

import { Transform } from 'vega';

/**
 * Tries parsing all values as dates.  Any that cannot be parsed are left alone
 *
 * https://github.com/Quansight/jupyterlab-omnisci/pull/85#issuecomment-519656950
 */
function parseDates(o: { [key: string]: any }): { [key: string]: any } {
  const n: { [key: string]: any } = {};
  for (const key in o) {
    const parsed = Date.parse(o[key] as any);
    n[key] = isNaN(parsed) ? o[key] : parsed;
  }
  return n;
}

/**
 * Generates a function to query data from an OmniSci Core database.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {function(object): *} params.query - The SQL query.
 */
class QueryIbis extends dataflow.Transform implements Transform {
  constructor(params: any) {
    super([], params);
  }

  /**
   * The current kernel instance for the QueryIbis transform.
   */
  static kernel: Kernel.IKernelConnection | null;

  /**
   * The definition for the transform. Used by the vega dataflow logic
   * to decide how to use the transform.
   */
  /* tslint:disable-next-line */
  static readonly Definition = {
    type: 'QueryIbis',
    metadata: { changes: true, source: true },
    params: [
      {
        name: 'name',
        type: 'string',
        required: true
      },
      {
        name: 'data',
        type: 'expr',
        required: false
      },
      {
        name: 'transform',
        type: 'transform',
        array: true,
        required: false
      }
    ]
  };

  get value(): any {
    return this._value;
  }
  set value(val: any) {
    this._value = val;
  }

  async transform(parameters: any, pulse: any): Promise<any> {
    const kernel = QueryIbis.kernel;
    if (!kernel) {
      console.error('Not connected to kernel');
      return;
    }

    // Fetch the query results from the kernel.
    const comm = kernel.connectToComm('queryibis');
    const resultPromise = new PromiseDelegate<JSONObject[]>();
    comm.onMsg = msg =>
      resultPromise.resolve((msg.content.data as any) as JSONObject[]);

    console.log('Fetching data', parameters, pulse);
    await comm.open(parameters).done;
    const result: JSONObject[] = await resultPromise.promise;
    console.log('Received data', result);
    const parsedResult = result.map(parseDates);
    console.log('Parsed data', parsedResult);

    // Ingest the data and push it into the dataflow graph.
    parsedResult.forEach(dataflow.ingest);

    /* tslint:disable-next-line */
    const out = pulse.fork(pulse.NO_FIELDS & pulse.NO_SOURCE);
    out.rem = this._value;
    this._value = out.add = out.source = parsedResult;

    return out;
  }

  private _value: any;
}

export default QueryIbis;
