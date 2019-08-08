import { Kernel } from '@jupyterlab/services';
import { PromiseDelegate } from '@phosphor/coreutils';
import { compile, TopLevelSpec } from 'vega-lite';
import { initConfig } from 'vega-lite/build/src/config';

const PLUGIN_ID = 'jupyterlab-omnisci:vega-compiler';

/**
 * Takes in a Vega-Lite spec and returns a compiled Vega spec,
 * with the Vega transforms swapped out for Ibis transforms.
 */
export async function compileSpec(
  kernel: Kernel.IKernelConnection,
  vlSpec: TopLevelSpec
): Promise<object> {
  // uses same logic as
  // https://github.com/vega/vega-lite/blob/a4ee4ec393d86b611f95486ad2e1902bfa3ed0cf/test/transformextract.test.ts#L133
  const config = initConfig(vlSpec.config || {});
  const extractSpec = vlSpec;
  const vSpec = compile(extractSpec, { config }).spec;

  // Change vega transforms to ibis transforms on the server side.
  const transformedSpecPromise = new PromiseDelegate<any>();
  const comm = kernel.connectToComm(PLUGIN_ID);
  comm.onMsg = msg => transformedSpecPromise.resolve(msg.content.data);
  await comm.open(vSpec as any).done;
  return transformedSpecPromise.promise;
}
