import { Process } from './Process';

interface Registry {
  [processName: string]: ProcessConstructor | undefined;
}

// Class decorator to register Process
export function registerProcess(constructor: ProcessConstructor) {
  ProcessRegistry.register(constructor);
}

export interface ProcessConstructor {
  new (parentPID: number, pid: number): Process;
}

export class ProcessRegistry {
  private static readonly registry: Registry = {};

  public static fetch(processName: string) {
    return this.registry[processName];
  }

  public static register(constructor: ProcessConstructor) {
    this.registry[constructor.name] = constructor;
  }
}
