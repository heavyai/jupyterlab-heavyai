import plugins from './extension';

import vegaLitePlugin from './extract-vega-lite';

export default [...plugins, vegaLitePlugin];
