import { Process, registerProcess } from 'Kernel';
import { SimpleRoomPosition } from 'shared/Types';
import { Logger } from 'utils/Logger';

//#region Types

type MainBaseProcessMemory = {
  harvesterPositions: {
    local: SimpleRoomPosition[]
  };
  roomName: string;
  sourceIDs: {
    local: string[]
  };
  spawnIDs: string[];
}

//#endregion

@registerProcess
export class MainBaseProcess extends Process {
  public memory: MainBaseProcessMemory = {
    harvesterPositions: {
      local: []
    },
    roomName: '',
    sourceIDs: {
      local: []
    },
    spawnIDs: []
  };

  private _localHarvesterPositions?: RoomPosition[];
  private get localHarvesterPositions(): RoomPosition[] {
    if (this._localHarvesterPositions) {
      return this.localHarvesterPositions;
    }

    this._localHarvesterPositions = [];

    if (this.memory.harvesterPositions.local.length > 0) {
      for (const position of this.memory.harvesterPositions.local) {
        const roomPosition = new RoomPosition(position.x, position.y, position.roomName);
        this._localHarvesterPositions.push(roomPosition);
      }

      return this.localHarvesterPositions;
    }

    //

    return this._localHarvesterPositions;
  }

  private _localSources?: Source[];
  private get localSources(): Source[] {
    if (this._localSources) {
      return this._localSources;
    }

    this._localSources = [];

    if (this.memory.sourceIDs.local.length > 0) {
      for (const sourceID of this.memory.sourceIDs.local) {
        const source = Game.getObjectById(sourceID as Id<Source>);

        if (!source) {
          const index = this.memory.sourceIDs.local.indexOf(sourceID);
          this.memory.sourceIDs.local.splice(index);
          continue;
        }

        this._localSources.push(source);
      }

      return this._localSources;
    }

    this._localSources = this.room.find(FIND_SOURCES);
    this.memory.sourceIDs.local = this._localSources.map(_ => _.id);

    return this._localSources;
  }

  private _room?: Room;
  private get room(): Room {
    if (this._room) {
      return this._room;
    }

    this._room = Game.rooms[this.memory.roomName];
    return this._room;
  }

  private _spawns?: StructureSpawn[];
  private get spawns(): StructureSpawn[] {
    if (this._spawns) {
      return this._spawns;
    }

    this._spawns = [];

    if (this.memory.spawnIDs.length > 0) {
      for (const spawnID of this.memory.spawnIDs) {
        const spawn = Game.getObjectById(spawnID as Id<StructureSpawn>);

        if (!spawn) {
          const index = this.memory.spawnIDs.indexOf(spawnID);
          this.memory.spawnIDs.splice(index);
          continue;
        }

        this._spawns.push(spawn);
      }

      return this._spawns;
    }

    this._spawns = this.room.find(FIND_MY_SPAWNS);
    this.memory.spawnIDs = this._spawns.map(_ => _.id);

    return this._spawns;
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
