import { Process, registerProcess } from 'Kernel';
import { Logger } from 'utils/Logger';

@registerProcess
export class HierarchProcess extends Process {
  public run(): void {
    let mainBases: Room[];

    if (Game.rooms.sim) {
      mainBases = [Game.rooms.sim];
    } else {
      mainBases = _.filter(Game.rooms, _ => _.controller && _.controller.my);
    }

    for (const mainBase of mainBases) {
      Logger.debug(`Main Base ${mainBase.name}`);
    }
  }
}
