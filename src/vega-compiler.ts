/**
 * JupyterLab plugin to present a Comm service for compiling vega-lite
 * to vega from kernels.
 */
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { IInstanceTracker } from '@jupyterlab/apputils';

import { ConsolePanel, IConsoleTracker } from '@jupyterlab/console';

import { NotebookPanel, INotebookTracker } from '@jupyterlab/notebook';

import { Kernel, KernelMessage } from '@jupyterlab/services';

import { compile } from 'vega-lite/build/src/compile/compile';

const PLUGIN_ID = 'jupyterlab-omnisci:vega-compiler';

const vegaCompiler: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID,
  autoStart: true,
  requires: [IConsoleTracker, INotebookTracker],
  activate: (
    app: JupyterFrontEnd,
    consoles: IConsoleTracker,
    notebooks: INotebookTracker
  ) => {
    /**
     * Handle a connection to the compile comm.
     */
    function compileSpec(comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) {
      const spec: any = msg.content.data;
      const compiled = compile(spec);
      comm.send(compiled.spec as any);
    }

    // When a new notebook or console widget is added,
    // register a comm target for compiling vega-lite.
    type SessionHolder = ConsolePanel | NotebookPanel;
    const trackers: IInstanceTracker<SessionHolder>[] = [notebooks, consoles];
    trackers.forEach(tracker => {
      tracker.widgetAdded.connect((_, widget: SessionHolder) => {
        const session = widget.session;
        if (session && session.kernel) {
          session.kernel.registerCommTarget(PLUGIN_ID, compileSpec);
        }
        session.kernelChanged.connect((_, { newValue, oldValue }) => {
          if (oldValue) {
            oldValue.removeCommTarget(PLUGIN_ID, compileSpec);
          }
          if (newValue) {
            newValue.registerCommTarget(PLUGIN_ID, compileSpec);
          }
        });
      });
    });
  }
};

export default vegaCompiler;
