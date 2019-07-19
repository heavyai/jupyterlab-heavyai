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
  const comm = kernel.connectToComm(PLUGIN_ID);
  const msgPromise: Promise<KernelMessage.ICommMsgMsg> = new Promise(
    resolve => {
      comm.onMsg = resolve;
    }
  );
  await comm.open(vSpec as any);
  const returnMsg = await msgPromise;
  await comm.close().done;
  return returnMsg.content.data as any;
}
