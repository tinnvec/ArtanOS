import { Process, ProcessPriority, ProcessStatus } from './Process';
import { ProcessRegistry } from './ProcessRegistry';

export class Kernel {
  public static processTable: { [pid: string]: Process } = {};

  private static queueHigh: Process[] = [];
  private static queueNormal: Process[] = [];
  private static queueLow: Process[] = [];

  public static addProcess<T extends Process>(process: T, priority = ProcessPriority.Normal): T {
    if (process.pid === undefined) {
      process.pid = this.getNextPID();
    }

    process.priority = priority;
    this.processTable[process.pid] = process;
    Memory.processMemory[process.pid] = {};
    process.setMemory(this.getProcessMemory(process.pid));
    process.status = ProcessStatus.Alive;

    return process;
  }

  public static getNextPID() {
    Memory.pidCounter = Memory.pidCounter || 0;

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
    Memory.processMemory = Memory.processMemory || {};
    Memory.processMemory[pid] = Memory.processMemory[pid] || {};

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
    this.runQueue(this.queueHigh);
    this.runQueue(this.queueNormal);
    this.runQueue(this.queueLow);

    this.storeProcessTable();
  }

  public static sleepProcess(process: Process, ticks: number) {
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
    Memory.processTable = Memory.processTable || [];

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

      switch (process.priority) {
        case ProcessPriority.High:
          this.queueHigh.push(process);
          break;
        case ProcessPriority.Normal:
          this.queueNormal.push(process);
          break;
        default:
          this.queueLow.push(process);
      }
    }
  }

  private static reboot() {
    this.queueHigh = [];
    this.queueNormal = [];
    this.queueLow = [];

    this.processTable = {};
  }

  private static runQueue(queue: Process[]) {
    while (queue.length > 0) {
      let process = queue.shift();

      while (process) {
        // Check parent Process
        if (!this.getProcessByPID(process.parentPID)) {
          this.killProcess(process.pid);
        }

        // Check Sleep status
        if (
          process.status === ProcessStatus.Asleep &&
          process.sleepInfo &&
          process.sleepInfo.start + process.sleepInfo.duration < Game.time &&
          process.sleepInfo.duration !== -1
        ) {
          process.status = ProcessStatus.Alive;
          process.sleepInfo = undefined;
        }

        if (process.status === ProcessStatus.Alive) {
          process.run();
        }

        process = queue.shift();
      }
    }
  }

  private static storeProcessTable() {
    const liveProcs = _.filter(this.processTable, _ => _.status !== ProcessStatus.Dead);

    for (const proc of liveProcs) {
      Memory.processMemory[proc.pid] = proc.memory;
    }

    Memory.processTable = _.map(liveProcs, _ => [_.pid, _.parentPID, _.constructor.name, _.priority]);
  }

  //#endregion
}
