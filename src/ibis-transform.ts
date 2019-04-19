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

  get value(): any {
    return this._value;
  }

  /* tslint:disable-next-line */
  readonly Definition = {
    type: 'QueryCore',
    metadata: { changes: true, source: true },
    params: [{ name: 'query', type: 'string', required: true }]
  };

  async transform(_: any, pulse: any): Promise<any> {
    console.log('TRANSFORM');
    const result = this._value;
    /* tslint:disable-next-line */
    const out = pulse.fork(pulse.NO_FIELDS & pulse.NO_SOURCE);
    out.rem = this._value;
    this._value = out.add = out.source = result;

    return out;
  }

  private _value: any;
}

export default QueryIbis;
