import { compile } from "vega-lite";

/**
 * Compiles a Mapd vega lite spec to a Mapd vega spec.
 * 
 * The vega lite spec should have an `sql` field in it's data instead of a `values` field.
 * 
 * The vega spec has a bunch of differences between mapd and the original spec.
 * @param spec 
 */
export function compileToVega(vlSpec: any): any {
    const sql = vlSpec.data.sql;
    delete vlSpec.data.sql;
    vlSpec.data.name = 'mapd_data' 

    const vSpec = compile(vlSpec, {config: {invalidValues: null}}).spec;

    // manually remove transformation from vega spec
    // until https://github.com/vega/vega-lite/issues/3665 is merged
    vSpec.data[0].name = vSpec.data.pop().name;
    vSpec.data[0].sql = sql;
    
    for (const mark of vSpec.marks) {
        // mapd uses mark.properties instead of mark.encode.update
        const properties = mark.encode.update;
        mark.properties = properties;
        delete mark.encode;

        // mapd has an opacity value instead of an object
        if (properties.opacity) {
            properties.opacity = properties.opacity.value;
        }

        // mapd has a fillColor instead of a fill object
        if (properties.fill) {
            properties.fillColor = properties.fill.value;
            delete properties.fill;
        }

        //mapd has a shape string instead of object
        if (properties.shape) {
            properties.shape = properties.shape.value;
        }

        // the width and height are required in mapd for symbols,
        // unlike in vega where they are optional, or you can just set the
        // size
        if (mark.type === 'symbol') {
            properties.width = properties.height = properties.size;
            delete properties.size;
        }
    }

    return vSpec;
}
