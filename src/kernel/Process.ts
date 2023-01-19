import { Kernel } from './Kernel';

export enum ProcessPriority {
  Always = 0,
  High,
  Normal,
  Low
}

export enum ProcessStatus {
  Dead = 0,
  Alive,
  Asleep
}

export interface ProcessMemory {
  [index:string]: any
}

export interface ProcessSleep {
  start: number;
  duration: number;
}

export interface Process {
  memory: ProcessMemory;
  parentPID: number;
  pid: number;
  priority?: ProcessPriority;
  sleepInfo?: ProcessSleep;
  status: ProcessStatus;
}

export abstract class Process {
  constructor(parentPID: number, pid = Kernel.getNextPID()) {
    this.parentPID = parentPID;
    this.pid = pid;
    this.memory = {};
    this.status = ProcessStatus.Alive;
  }

  public abstract run(): void;

  public setMemory(memory: ProcessMemory) {
    this.memory = memory;
  }

  public stop() {
    Kernel.killProcess(this.pid);
  }
}
