import { Kernel, Process, ProcessPriority, registerProcess } from 'Kernel';
import { Logger } from 'utils/Logger';
import { MainBaseProcess } from './MainBaseProcess';

type HierarchProcessMemory = {
  mainBases: { roomName: string, pid: number }[]
}

@registerProcess
export class HierarchProcess extends Process {
  public memory: HierarchProcessMemory = {
    mainBases: []
  };

  public run(): void {
    this.checkMemory();

    const ownedRooms = this.getOwnedRooms();
    for (const ownedRoom of ownedRooms) {
      if (this.memory.mainBases.find(_ => _.roomName === ownedRoom.name)) {
        continue;
      }

      Logger.debug(`Creating MainBaseProcess for ${ownedRoom.name}`);
      const proc = new MainBaseProcess(this.pid);
      Kernel.addProcess(proc, { roomName: ownedRoom.name }, ProcessPriority.High);
      this.memory.mainBases.push({ roomName: ownedRoom.name, pid: proc.pid });
    }
  }

  private checkMemory() {
    // Check Memory.mainBases for missing processes
    for (const mainBase of this.memory.mainBases) {
      if (!Kernel.getProcessByPID(mainBase.pid)) {
        Logger.debug(`No process found for [${mainBase.pid}] ${mainBase.roomName}, removing Main Base`);
        this.memory.mainBases.splice(this.memory.mainBases.indexOf(mainBase));
      }
    }
  }

  private getOwnedRooms() {
    if (Game.rooms.sim) {
      return [Game.rooms.sim];
    }

    return _.filter(Game.rooms, _ => _.controller && _.controller.my);
  }
}
