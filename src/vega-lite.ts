import { compile } from "vega-lite";


/**
 * Compiles a Mapd vega lite spec to a Mapd vega spec.
 * 
 * The vega lite spec should have an `sql` field in it's data instead of a `values` field.
 * @param spec 
 */
export function compileToVega(vlSpec: any): any {
    const sql = vlSpec.data.sql;
    delete vlSpec.data.sql;
    vlSpec.data.name = 'mapd_data' 


    const vSpec = compile(vlSpec, {config: {invalidValues: null}}).spec;

    vSpec.data[0].sql = sql;
    return vSpec;
}
