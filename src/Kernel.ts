import { Logger } from 'utils/Logger';

//#region Types

type ProcessSleep = {
  start: number;
  duration: number;
}

//#endregion

//#region Enums

export enum ProcessPriority {
  Always = 0,
  High,
  Normal,
  Low
}

enum ProcessStatus {
  Dead = 0,
  Alive,
  Asleep
}

//#endregion

//#region Interfaces

export interface Process {
  memory: Object;
  parentPID: number;
  pid: number;
  priority?: ProcessPriority;
  sleepInfo?: ProcessSleep;
  status: ProcessStatus;
}

interface ProcessConstructor {
  new (parentPID: number, pid: number): Process;
}

//#endregion

// Class decorator to register Process
export function registerProcess(constructor: ProcessConstructor) {
  ProcessRegistry.register(constructor);
}

export class Kernel {
  public static processTable: { [pid: string]: Process } = {};

  private static processQueue: { [key in ProcessPriority]: Process[] }

  public static addProcess<T extends Process>(process: T, memory: Object = {}, priority = ProcessPriority.Normal): T {
    Logger.debug(`Adding ${process.constructor.name}`);
    if (process.pid === undefined) {
      process.pid = this.getNextPID();
    }

    process.priority = priority;
    process.setMemory(memory);
    Memory.processMemory[process.pid] = memory;
    this.processTable[process.pid] = process;

    return process;
  }

  public static getNextPID() {
    // Find next unused PID
    while (this.getProcessByPID(Memory.pidCounter) !== undefined) {
      // Loop back to 0 to avoid overflow
      if (Memory.pidCounter >= Number.MAX_SAFE_INTEGER) {
        Memory.pidCounter = 0;
      }

      Memory.pidCounter++;
    }

    return Memory.pidCounter;
  }

  public static getProcessByPID(pid: number) {
    return this.processTable[pid];
  }

  public static getProcessMemory(pid: number) {
   if (!Memory.processMemory[pid]) {
    Memory.processMemory[pid] = {};
   }

    return Memory.processMemory[pid];
  }

  public static killProcess(pid: number) {
    // Can't kill process 0
    if (pid === 0) {
      return;
    }

    // Kill children
    for (const otherPid in this.processTable) {
      const process = this.processTable[otherPid];

      if (process.parentPID === pid && process.status !== ProcessStatus.Dead) {
        this.killProcess(process.pid);
      }
    }

    // Kill process
    this.processTable[pid].status = ProcessStatus.Dead;
    Memory.processMemory[pid] = undefined;
  }

  public static load() {
    this.reboot();

    this.loadProcessTable();
    this.garbageCollection();
  }

  public static run() {
    this.runQueue();
    this.storeProcessTable();
  }

  public static sleepProcess(process: Process, ticks: number) {
    Logger.debug(`Sleeping [${process.pid}] ${process.constructor.name} for ${ticks} ticks`);

    process.status = ProcessStatus.Asleep;
    process.sleepInfo = { start: Game.time, duration: ticks };

    return process;
  }

  //#region Private Methods

  private static garbageCollection() {
    // Clean process memory
    Memory.processMemory = _.pick(Memory.processMemory, (_: any, k: string) => this.processTable[k] !== undefined);

    // Clean default memory
    Memory.creeps = _.pick(Memory.creeps, (_: any, k: string) => Game.creeps[k] !== undefined);
    Memory.spawns = _.pick(Memory.spawns, (_: any, k: string) => Game.spawns[k] !== undefined);
    Memory.flags = _.pick(Memory.flags, (_: any, k: string) => Game.flags[k] !== undefined);
    Memory.rooms = _.pick(Memory.rooms, (_: any, k: string) => Game.rooms[k] !== undefined);
  }

  private static loadProcessTable() {
    for (const [pid, parentPID, processName, priority, ...remaining] of Memory.processTable) {
      const processClass = ProcessRegistry.fetch(processName);

      if (!processClass) {
        continue;
      }

      Logger.debug(`Loading [${pid}] ${processName}`);
      const process = new processClass(parentPID, pid);
      process.setMemory(this.getProcessMemory(pid));
      process.priority = priority;
      this.processTable[pid] = process;
      const sleepInfo = remaining.pop();

      if (sleepInfo) {
        process.sleepInfo = sleepInfo;
        process.status = ProcessStatus.Asleep;
      }

      if (process.priority === undefined) {
        process.priority = ProcessPriority.Normal;
      }

      this.processQueue[process.priority].push(process);
    }
  }

  private static memtest() {
    if (Memory.pidCounter === undefined || typeof(Memory.pidCounter) != 'number') {
      Logger.debug('Resetting Memory.pidCounter');
      Memory.pidCounter = 0;
    }

    if (!Memory.processMemory || typeof(Memory.processMemory) != 'object') {
      Logger.debug('Resetting Memory.processMemory');
      Memory.processMemory = {};
    }

    if (!Memory.processTable || !Array.isArray(Memory.processTable)) {
      Logger.debug('Resetting Memory.processTable');
      Memory.processTable = [];
    }
  }

  private static reboot() {
    this.memtest();

    this.processQueue = {
      [ProcessPriority.Always]: new Array<Process>(),
      [ProcessPriority.High]: new Array<Process>(),
      [ProcessPriority.Normal]: new Array<Process>(),
      [ProcessPriority.Low]: new Array<Process>()
    }

    this.processTable = {};
  }

  private static runQueue() {
    for (const item in ProcessPriority) {
      const priority: ProcessPriority = Number(item);

      if (isNaN(priority)) {
        continue;
      }

      const queue = this.processQueue[priority];

      while (queue.length > 0) {
        let process = queue.shift();

        while (process) {
          if (!this.getProcessByPID(process.parentPID)) {
            Logger.debug(`Killing [${process.pid}] ${process.constructor.name}, can't find parent [${process.parentPID}]`);
            this.killProcess(process.pid);
          }

          if (
            process.status === ProcessStatus.Asleep
            && process.sleepInfo
            && process.sleepInfo.start + process.sleepInfo.duration < Game.time
          ) {
            process.status = ProcessStatus.Alive;
            process.sleepInfo = undefined;
          }

          if (process.status === ProcessStatus.Alive) {
            Logger.debug(`Running [${process.pid}] ${process.constructor.name}`);
            process.run();
          }

          process = queue.shift();
        }
      }
    }
  }

  private static storeProcessTable() {
    const liveProcs = _.filter(this.processTable, _ => _.status !== ProcessStatus.Dead);

    for (const proc of liveProcs) {
      Memory.processMemory[proc.pid] = proc.memory;
    }

    Memory.processTable = _.map(liveProcs, _ => [_.pid, _.parentPID, _.constructor.name, _.priority, _.sleepInfo]);
  }

  //#endregion
}

export abstract class Process {
  constructor(parentPID: number, pid = Kernel.getNextPID(), status = ProcessStatus.Alive) {
    this.parentPID = parentPID;
    this.pid = pid;
    this.status = status;
  }

  public abstract run(): void;

  public setMemory(memory: Object) {
    this.memory = memory;
  }

  public stop() {
    Kernel.killProcess(this.pid);
  }
}

class ProcessRegistry {
  private static readonly registry: { [processName: string]: ProcessConstructor | undefined } = {};

  public static fetch(processName: string) {
    return this.registry[processName];
  }

  public static register(constructor: ProcessConstructor) {
    Logger.debug(`Registering ${constructor.name}`);
    this.registry[constructor.name] = constructor;
  }
}
