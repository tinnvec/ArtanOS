import { Process, registerProcess } from 'Kernel';
import { Logger } from 'utils/Logger';

type MainBaseProcessMemory = {
  roomName: string;
}

@registerProcess
export class MainBaseProcess extends Process {
  public memory: MainBaseProcessMemory = {
    roomName: ''
  };

  private room?: Room;

  public run(): void {
    if (this.memory.roomName === '') {
      Logger.debug('No roomName in MainBaseProcess memory, killing process');
      return this.stop();
    }

      this.room = Game.rooms[this.memory.roomName];
    }

    Logger.debug(`MainBaseProcess for ${this.room.name}`);
  }
}
