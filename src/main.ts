import { MINIMUM_LOG_LEVEL } from 'defaults';
import { Kernel, ProcessPriority } from 'Kernel';
import { HierarchProcess } from 'processes/HierarchProcess';
import { ErrorMapper } from 'utils/ErrorMapper';
import { Logger } from 'utils/Logger';

import 'Commands';
import 'extensions/RoomVisual/RoomVisual';

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

  // RoomVisual extensions
  interface RoomVisual {
    animatedPosition(x: number, y: number, opts?: { color?: string, frames?: number, opacity?: number, radius?: number}): RoomVisual;
    connectRoads(opts?: { color?: string, opacity?: number }): RoomVisual;
    resource(type: string, x: number, y: number, size?: number): number;
    speech(text: string, x: number, y: number, opts?: { background?: string, opacity?: number, textcolor?: string, textfont?: string, textsize?: number, textstyle?: string }): RoomVisual;
    structure(x: number, y: number, type: string, opts?: { opacity?: number}): RoomVisual;
    test(): RoomVisual;
  }

  // Commands
  function clearMemory(): void;
  function showMemory(): void;
}

function memtest() {
  // Core

  if (Memory.pidCounter === undefined || typeof(Memory.pidCounter) != 'number') {
    Memory.pidCounter = 0;
  }

  if (!Memory.processMemory || typeof(Memory.processMemory) != 'object') {
    Memory.processMemory = {};
  }

  if (!Memory.processTable || !Array.isArray(Memory.processTable)) {
    Memory.processTable = [];
  }

  // Settings

  if (!Memory.settings || typeof(Memory.settings) != 'object') {
    Memory.settings = {
      minimumLogLevel: MINIMUM_LOG_LEVEL
    };
  }

  if (!Memory.settings.minimumLogLevel || typeof(Memory.settings.minimumLogLevel) != 'number') {
    Memory.settings.minimumLogLevel = MINIMUM_LOG_LEVEL;
  }
}

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  memtest();
  Kernel.load();

  if (!Kernel.getProcessByPID(0)) {
    Kernel.addProcess(
      new HierarchProcess(0, 0),
      { mainBaseProcesses: {} },
      ProcessPriority.Always
    );
  }

  Kernel.run();
  Logger.debug('-'.repeat(40));
});
