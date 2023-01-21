import { Kernel, Process, ProcessPriority, registerProcess } from 'Kernel';
import { Logger } from 'utils/Logger';
import { MainBaseProcess } from './MainBaseProcess';

@registerProcess
export class HierarchProcess extends Process {
  public run(): void {
    this.checkMissingMainBaseMemory();

    let ownedRooms: Room[];

    if (Game.rooms.sim) {
      ownedRooms = [Game.rooms.sim];
    } else {
      ownedRooms = _.filter(Game.rooms, _ => _.controller && _.controller.my);
    }

    for (const ownedRoom of ownedRooms) {
      if (Memory.mainBases[ownedRoom.name]) {
        continue;
      }

      Logger.debug(`Creating MainBaseProcess for ${ownedRoom.name}`);

      const proc = new MainBaseProcess(this.pid);
      Kernel.addProcess(proc, { roomName: ownedRoom.name }, ProcessPriority.High);
      Memory.mainBases[ownedRoom.name] = { pid: proc.pid };
    }
  }

  checkMissingMainBaseMemory(): void {
    // Check Memory.mainBases for missing process memory
    for (const baseName in Memory.mainBases) {
      const pid = Memory.mainBases[baseName].pid;

      if (!Memory.processMemory[pid]) {
        Logger.debug(`No process memory for [${pid}] ${baseName}, removing Main Base`);
        delete Memory.mainBases[baseName];
      }
    }
  }
}
