import { TopLevelSpec } from 'vega-lite';

import { Kernel } from '@jupyterlab/services';

import { PromiseDelegate } from '@phosphor/coreutils';

import { compile } from 'vega-lite/build/src/compile/compile';

const PLUGIN_ID = 'jupyterlab-omnisci:vega-compiler';

/**
 * Takes in a Vega Lite spec and returns a compiled vega spec,
 * with the vega transforms swapped out for ibis transforms.
 */
export async function compileSpec(
  kernel: Kernel.IKernelConnection,
  vlSpec: TopLevelSpec
): Promise<object> {
  // Compile vega-lite to vega
  const vSpec = compile(vlSpec).spec;

  // Change vega transforms to ibis transforms on the server side.
  const transformedSpecPromise = new PromiseDelegate<any>();
  const comm = kernel.connectToComm(PLUGIN_ID);
  comm.onMsg = msg => transformedSpecPromise.resolve(msg.content.data);
  await comm.open(vSpec as any).done;
  return transformedSpecPromise.promise;
}
