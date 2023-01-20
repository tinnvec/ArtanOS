import { Kernel } from 'Kernel';
import { ErrorMapper } from 'utils/ErrorMapper';
import { Logger } from 'utils/Logger';

declare global {
  // Memory extensions
  interface Memory {
    pidCounter: number;
    processMemory: any;
    processTable: any;
  }
}

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  Logger.debug(`--- Tick ${Game.time} ---`);

  Kernel.load();

  Kernel.run();

  Logger.debug(`--- End Tick ---`);
});
