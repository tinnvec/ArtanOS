import { Kernel, ProcessPriority } from 'Kernel';
import { HierarchProcess } from 'processes/HierarchProcess';
import { ErrorMapper } from 'utils/ErrorMapper';
import { Logger } from 'utils/Logger';

declare global {
  // Memory extensions
  interface Memory {
    pidCounter: number;
    processMemory: { [index: string]: any };
    processTable: any[];
    mainBases: {
      [index: string]: {
        pid: number
      }
    };
  }
}

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  Logger.debug(`--- Tick ${Game.time} ---`);

  Kernel.load();

  if (!Kernel.getProcessByPID(0)) {
    const proc = new HierarchProcess(0, 0);
    Kernel.addProcess(proc, {}, ProcessPriority.Always);
  }

  Kernel.run();

  Logger.debug(`--- End Tick ---`);
});
