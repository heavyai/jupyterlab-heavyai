declare module 'vega-dataflow' {
  import * as typings from 'vega-typings';
  export class Transform implements typings.Transform {
    constructor(init: any, params: any);
    targets: any;
    set: any;
    skip: any;
    modified: any;
    parameters: any;
    marshall: any;
    evaluate: any;
    run: any;
  }
  export function ingest(datum: any): any;
}
