import { Kernel, KernelMessage } from '@jupyterlab/services';

import { compile } from 'vega-lite/build/src/compile/compile';

const PLUGIN_ID = 'jupyterlab-omnisci:vega-compiler';

/**
 * Takes in a Vega Lite spec and returns a compiled vega spec.
 */
export async function compileSpec(
  kernel: Kernel.IKernelConnection,
  vlSpec: any
): Promise<object> {
  const vSpec = compile(vlSpec).spec;

  const comm = await kernel.connectToComm(PLUGIN_ID);
  comm.open(vSpec as any);
  const returnMsg: KernelMessage.ICommMsgMsg = await new Promise(resolve => {
    comm.onMsg = resolve;
  });
  await comm.close().done;
  return returnMsg.content.data as any;
}
