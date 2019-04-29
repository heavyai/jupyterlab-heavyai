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
   * The definition for the transform. Used by the vega dataflow logic
   * to decide how to use the transform.
   */
  /* tslint:disable-next-line */
  static readonly Definition = {
    type: 'QueryIbis',
    metadata: { changes: true, source: true },
    params: [
      {
        name: 'query',
        type: 'string',
        required: true
      }
    ]
  };

  get value(): any {
    return this._value;
  }
  set value(val: any) {
    this._value = val;
  }

  async transform(_: any, pulse: any): Promise<any> {
    console.log('TRANSFORM');
    const result = [
      { a: 'A', b: 28 },
      { a: 'B', b: 55 },
      { a: 'C', b: 43 },
      { a: 'D', b: 91 },
      { a: 'E', b: 81 },
      { a: 'F', b: 53 },
      { a: 'G', b: 19 },
      { a: 'H', b: 87 },
      { a: 'I', b: 52 }
    ];
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
