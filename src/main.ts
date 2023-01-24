import { Kernel, ProcessPriority } from 'Kernel';
import { HierarchProcess } from 'processes/HierarchProcess';
import { ErrorMapper } from 'utils/ErrorMapper';

declare global {
  // Memory extensions
  interface Memory {
    pidCounter: number;
    processMemory: { [index: string]: any };
    processTable: any[];
    settings: {
      minimumLogLevel: number;
    }
  }
}

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  Kernel.load();

  if (!Kernel.getProcessByPID(0)) {
    Kernel.addProcess(
      new HierarchProcess(0, 0),
      { mainBaseProcesses: {} },
      ProcessPriority.Always
    );
  }

  Kernel.run();
});
