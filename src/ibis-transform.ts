import { Kernel } from '@jupyterlab/services';

import { JSONObject } from '@phosphor/coreutils';

import * as dataflow from 'vega-dataflow';

import { Transform } from 'vega';

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
        name: 'transforms',
        type: 'string',
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
    const comm = await kernel.connectToComm('queryibis');

    console.log('Fetching data', parameters, pulse);

    comm.open(parameters);
    const result: JSONObject[] = await new Promise(resolve => {
      comm.onMsg = msg => {
        resolve(msg.content.data as JSONObject[]);
      };
    });
    await comm.close().done;

    console.log('Recieved data', result);

    result.forEach(dataflow.ingest);

    /* tslint:disable-next-line */
    const out = pulse.fork(pulse.NO_FIELDS & pulse.NO_SOURCE);
    out.rem = this._value;
    this._value = out.add = out.source = result;

    return out;
  }

  private _value: any;
}

export default QueryIbis;
