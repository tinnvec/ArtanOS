import { Process, registerProcess } from 'Kernel';
import { Logger } from 'utils/Logger';

//#region Types

type MainBaseProcessMemory = {
  roomName: string;
  sourceIDs: string[];
}

//#endregion

@registerProcess
export class MainBaseProcess extends Process {
  public memory: MainBaseProcessMemory = {
    roomName: '',
    sourceIDs: []
  };

  private _room?: Room;
  private get room(): Room {
    if (this._room) {
      return this._room;
    }

    this._room = Game.rooms[this.memory.roomName];
    return this._room;
  }

  private _sources?: Source[];
  private get sources(): Source[] {
    if (this._sources) {
      return this._sources;
    }

    this._sources = [];

    if (this.memory.sourceIDs.length > 0) {
      for (const sourceID of this.memory.sourceIDs) {
        const source = Game.getObjectById(sourceID as Id<Source>);

        if (!source) {
          const index = this.memory.sourceIDs.indexOf(sourceID);
          this.memory.sourceIDs.splice(index);
          continue;
        }

        this._sources.push(source);
      }

      return this._sources;
    }

    this._sources = this.room.find(FIND_SOURCES);
    this.memory.sourceIDs = _.map(this.sources, _ => _.id);
    return this._sources;
  }

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
