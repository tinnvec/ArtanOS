import { Kernel, Process, registerProcess } from 'Kernel';
import { Logger } from 'utils/Logger';

@registerProcess
export class MainBaseProcess extends Process {
  room?: Room;

  public run(): void {
    if (this.memory.roomName === '') {
      Logger.debug('No roomName in MainBaseProcess memory, killing process');
      Kernel.killProcess(this.pid);
      return;
    }

    if (!this.room) {
      this.room = Game.rooms[this.memory.roomName];
    }

    Logger.debug(`MainBaseProcess for ${this.room.name}`);
  }
}
