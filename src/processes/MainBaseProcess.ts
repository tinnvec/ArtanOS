import { LayoutPlanner } from 'components/LayoutPlanner';
import { Kernel, Process, registerProcess } from 'Kernel';
import { Logger } from 'utils/Logger';

//#region Types

type MainBaseProcessMemory = {
  roomName: string;
};

//#endregion

@registerProcess
export class MainBaseProcess extends Process {
  public memory: MainBaseProcessMemory = {
    roomName: ''
  };

  private _room?: Room;
  private get room(): Room {
    if (this._room) {
      return this._room;
    }

    this._room = Game.rooms[this.memory.roomName];
    return this._room;
  }

  public run(): void {
    if (this.memory.roomName === '') {
      Logger.debug('No roomName in MainBaseProcess memory, killing process');
      return Kernel.killProcess(this.pid);
    }

    LayoutPlanner.generateLayout(this.room.name);

    // Temp first room code

    // const starterBody = [CARRY, WORK, MOVE, MOVE];

    // for (const spawn of this.spawns) {
    //   if (spawn.spawning) {
    //     continue;
    //   }

    //   const result = spawn.spawnCreep(starterBody, Game.time.toString());
    //   Logger.debug(`Spawn result: ${result}`);
    // }
  }

  //#region Private Methods

  //#endregion
}
