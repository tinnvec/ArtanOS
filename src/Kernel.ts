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

export abstract class Process {
  constructor(parentPID: number, pid = -1, status = ProcessStatus.Alive) {
    this.parentPID = parentPID;
    this.pid = pid;
    this.status = status;
  }

  public abstract run(): void;

  public setMemory(memory: Object) {
    this.memory = memory;
  }
}

class ProcessRegistry {
  private static readonly registry: { [processName: string]: ProcessConstructor | undefined } = {};

  public static fetch(processName: string) {
    return this.registry[processName];
  }

  public static register(constructor: ProcessConstructor) {
    this.registry[constructor.name] = constructor;
  }
}

export class Kernel {
  private static processQueue: Process[] = [];
  private static processTable: { [pid: string]: Process } = {};

  public static addProcess<T extends Process>(process: T, memory: Object = {}, priority = ProcessPriority.Normal): T {
    if (process.pid === -1) {
      process.pid = this.getNextPID();
    }

    Logger.debug(`Adding [${process.pid}] ${process.constructor.name}`);

    process.priority = priority;

    Memory.processMemory[process.pid] = memory;
    process.setMemory(memory);

    this.processTable[process.pid] = process;
    return process;
  }

  public static getProcessByPID<T extends Process>(pid: number): T | undefined {
    return this.processTable[pid] as T;
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
    this.processTable = {};
    this.processQueue = [];

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

  private static getNextPID() {
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

  private static getProcessMemory(pid: number) {
    if (!Memory.processMemory[pid]) {
     Memory.processMemory[pid] = {};
    }

     return Memory.processMemory[pid];
   }

  private static loadProcessTable() {
    const priorityQueue: Process[][] = [[], [], [], []];

    for (const [pid, parentPID, processName, priority, ...remaining] of Memory.processTable) {
      const processClass = ProcessRegistry.fetch(processName);

      if (!processClass) {
        continue;
      }

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

      priorityQueue[process.priority].push(process);
    }

    for (const subQueue of priorityQueue) {
      this.processQueue = this.processQueue.concat(subQueue);
    }
  }

  private static runQueue() {
    let process: Process | undefined = undefined;

    while (this.processQueue.length > 0) {
      if (!Game.rooms.sim && Game.cpu.getUsed() > Game.cpu.limit) {
        return;
      }

      process = this.processQueue.shift();

      if (!process) {
        continue;
      }

      if (!this.getProcessByPID(process.parentPID)) {
        Logger.warning(`Killing [${process.pid}] ${process.constructor.name}, can't find parent [${process.parentPID}]`);
        this.killProcess(process.pid);
        continue;
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
