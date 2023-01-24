import { Kernel, Process, ProcessPriority, registerProcess } from 'Kernel';
import { Logger } from 'utils/Logger';
import { MainBaseProcess } from './MainBaseProcess';

//#region Types

type HierarchProcessMemory = {
  mainBasesProcesses: { [roomName: string]: { pid: number } }
}

//#region

@registerProcess
export class HierarchProcess extends Process {
  public memory: HierarchProcessMemory = {
    mainBasesProcesses: {}
  };

  private _mainBaseProcesses?: MainBaseProcess[];
  private get mainBaseProcesses(): MainBaseProcess[] {
    if (this._mainBaseProcesses) {
      return this._mainBaseProcesses;
    }

    this._mainBaseProcesses = [];
    const mainBaseNames = Object.keys(this.memory.mainBasesProcesses);

    if (mainBaseNames.length > 0) {
      for (const roomName of mainBaseNames) {
        const proc = Kernel.getProcessByPID(this.memory.mainBasesProcesses[roomName].pid) as MainBaseProcess;

        if (!proc) {
          delete this.memory.mainBasesProcesses[roomName];
          continue;
        }

        this._mainBaseProcesses.push(proc);
      }

      return this._mainBaseProcesses;
    }

    for (const room of this.ownedRooms) {
      Logger.debug(`Creating MainBaseProcess for ${room.name}`);
      const proc = new MainBaseProcess(this.pid);
      Kernel.addProcess(proc, { roomName: room.name }, ProcessPriority.High);
      this._mainBaseProcesses.push(proc);
      this.memory.mainBasesProcesses[room.name] = { pid: proc.pid }
    }

    return this._mainBaseProcesses;
  }

  private _ownedRooms?: Room[];
  private get ownedRooms(): Room[] {
    if (this._ownedRooms) {
      return this._ownedRooms;
    }

    if (Game.rooms.sim) {
      this._ownedRooms = [Game.rooms.sim];
    } else {
      this._ownedRooms = _.filter(Game.rooms, _ => _.controller && _.controller.my);
    }

    return this._ownedRooms;
  }

  public run(): void {
    Logger.debug(`${this.mainBaseProcesses.length} Main Base Processes`);
  }
}
