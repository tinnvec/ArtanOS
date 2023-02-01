import { Kernel, Process, ProcessPriority, registerProcess } from 'Kernel';
import { Logger } from 'utils/Logger';
import { MainBaseProcess } from './MainBaseProcess';

//#region Types

type HierarchProcessMemory = {
  mainBaseProcesses: { [roomName: string]: number }
};

//#region

@registerProcess
export class HierarchProcess extends Process {
  public memory: HierarchProcessMemory = {
    mainBaseProcesses: {}
  };

  private _mainBaseProcesses?: MainBaseProcess[];
  private get mainBaseProcesses(): MainBaseProcess[] {
      return this._mainBaseProcesses || this.loadMainBaseProcessesFromMemory();
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
    // Create MainBaseProcess for each owned room
    for (const room of this.ownedRooms) {
      if (this.mainBaseProcesses.find(_ => _.memory.roomName === room.name)) {
        continue;
      }
      Logger.debug(`Creating MainBaseProcess for ${room.name}`);
      const proc = new MainBaseProcess(this.pid);
      Kernel.addProcess(proc, { roomName: room.name }, ProcessPriority.High);
      this.mainBaseProcesses.push(proc);
    }

    // Save MainBaseProcess pids
    for (const process of this.mainBaseProcesses) {
      this.memory.mainBaseProcesses[process.memory.roomName] = process.pid;
    }
  }

  //#region Private Methods

  private loadMainBaseProcessesFromMemory(): MainBaseProcess[] {
    this._mainBaseProcesses = [];
    const mainBaseNames = Object.keys(this.memory.mainBaseProcesses);

    for (const roomName of mainBaseNames) {
      const proc = Kernel.getProcessByPID<MainBaseProcess>(this.memory.mainBaseProcesses[roomName]);

      if (!proc) {
        delete this.memory.mainBaseProcesses[roomName];
        continue;
      }

      this._mainBaseProcesses.push(proc);
    }

    return this._mainBaseProcesses;
  }

  //#endregion
}
