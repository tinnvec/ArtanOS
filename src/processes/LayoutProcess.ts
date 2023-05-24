import { Process, registerProcess } from 'Kernel';

type STRUCTURE_NONE = 'none';

type LayoutProcessMemory = {
  baseRoom: string;
};

type TileStructure = {
  structure: BuildableStructureConstant;
  x: number;
  y: number;
}

type ValidStructure = STRUCTURE_NONE | STRUCTURE_EXTENSION | STRUCTURE_FACTORY
| STRUCTURE_LAB | STRUCTURE_LINK | STRUCTURE_NUKER | STRUCTURE_OBSERVER
| STRUCTURE_POWER_SPAWN | STRUCTURE_SPAWN | STRUCTURE_STORAGE | STRUCTURE_TERMINAL
| STRUCTURE_TOWER

declare const STRUCTURE_NONE: STRUCTURE_NONE;

const ROOM_SIZE = 50;

const VALID_NEIGHBORS = {
  'none': [
    STRUCTURE_NONE, STRUCTURE_EXTENSION, STRUCTURE_FACTORY, STRUCTURE_LAB,
    STRUCTURE_LINK, STRUCTURE_NUKER, STRUCTURE_OBSERVER, STRUCTURE_POWER_SPAWN,
    STRUCTURE_SPAWN, STRUCTURE_STORAGE, STRUCTURE_TERMINAL, STRUCTURE_TOWER
  ],

  'container': [
    STRUCTURE_NONE, STRUCTURE_ROAD
  ],

  'extension': [
    STRUCTURE_NONE, STRUCTURE_EXTENSION, STRUCTURE_FACTORY, STRUCTURE_LAB,
    STRUCTURE_LINK, STRUCTURE_NUKER, STRUCTURE_OBSERVER, STRUCTURE_POWER_SPAWN,
    STRUCTURE_SPAWN, STRUCTURE_STORAGE, STRUCTURE_TERMINAL, STRUCTURE_TOWER
  ],

  'factory': [
    STRUCTURE_NONE, STRUCTURE_EXTENSION, STRUCTURE_LAB, STRUCTURE_NUKER,
    STRUCTURE_OBSERVER, STRUCTURE_POWER_SPAWN, STRUCTURE_SPAWN, STRUCTURE_STORAGE,
    STRUCTURE_TERMINAL, STRUCTURE_TOWER
  ],

  'lab': [
    STRUCTURE_NONE, STRUCTURE_EXTENSION, STRUCTURE_FACTORY, STRUCTURE_LAB,
    STRUCTURE_NUKER, STRUCTURE_OBSERVER, STRUCTURE_POWER_SPAWN, STRUCTURE_SPAWN,
    STRUCTURE_STORAGE, STRUCTURE_TERMINAL, STRUCTURE_TOWER
  ],

  'link': [
    STRUCTURE_NONE, STRUCTURE_EXTENSION, STRUCTURE_LINK, STRUCTURE_NUKER,
    STRUCTURE_POWER_SPAWN, STRUCTURE_SPAWN, STRUCTURE_TERMINAL, STRUCTURE_TOWER
  ],

  'nuker': [
    STRUCTURE_NONE, STRUCTURE_EXTENSION, STRUCTURE_FACTORY, STRUCTURE_LAB,
    STRUCTURE_OBSERVER, STRUCTURE_POWER_SPAWN, STRUCTURE_SPAWN, STRUCTURE_STORAGE,
    STRUCTURE_TERMINAL, STRUCTURE_TOWER
  ],

  'observer': [
    STRUCTURE_NONE, STRUCTURE_EXTENSION, STRUCTURE_FACTORY, STRUCTURE_LAB,
    STRUCTURE_NUKER, STRUCTURE_POWER_SPAWN, STRUCTURE_SPAWN, STRUCTURE_STORAGE,
    STRUCTURE_TERMINAL, STRUCTURE_TOWER
  ],

  'powerSpawn': [
    STRUCTURE_NONE, STRUCTURE_EXTENSION, STRUCTURE_LINK, STRUCTURE_SPAWN,
    STRUCTURE_STORAGE, STRUCTURE_TERMINAL, STRUCTURE_TOWER
  ],

  'road': [
    STRUCTURE_NONE, STRUCTURE_EXTENSION, STRUCTURE_FACTORY, STRUCTURE_LAB,
    STRUCTURE_LINK, STRUCTURE_NUKER, STRUCTURE_OBSERVER, STRUCTURE_POWER_SPAWN,
    STRUCTURE_SPAWN, STRUCTURE_STORAGE, STRUCTURE_TERMINAL, STRUCTURE_TOWER
  ],

  'spawn': [
    STRUCTURE_NONE, STRUCTURE_EXTENSION, STRUCTURE_LINK, STRUCTURE_POWER_SPAWN,
    STRUCTURE_SPAWN, STRUCTURE_STORAGE, STRUCTURE_TERMINAL, STRUCTURE_TOWER
  ],

  'storage': [
    STRUCTURE_NONE, STRUCTURE_EXTENSION, STRUCTURE_FACTORY, STRUCTURE_LAB,
    STRUCTURE_LINK, STRUCTURE_NUKER, STRUCTURE_POWER_SPAWN, STRUCTURE_SPAWN,
    STRUCTURE_TERMINAL, STRUCTURE_TOWER
  ],

  'terminal': [
    STRUCTURE_NONE, STRUCTURE_EXTENSION, STRUCTURE_FACTORY, STRUCTURE_LAB,
    STRUCTURE_LINK, STRUCTURE_NUKER, STRUCTURE_POWER_SPAWN, STRUCTURE_SPAWN,
    STRUCTURE_TERMINAL, STRUCTURE_TOWER
  ],

  'tower': [
    STRUCTURE_NONE, STRUCTURE_EXTENSION, STRUCTURE_LINK, STRUCTURE_SPAWN,
    STRUCTURE_STORAGE, STRUCTURE_TERMINAL, STRUCTURE_TOWER
  ],

  'constructedWall': [
    STRUCTURE_NONE, STRUCTURE_EXTENSION, STRUCTURE_FACTORY, STRUCTURE_LAB,
    STRUCTURE_LINK, STRUCTURE_NUKER, STRUCTURE_OBSERVER, STRUCTURE_POWER_SPAWN,
    STRUCTURE_SPAWN, STRUCTURE_STORAGE, STRUCTURE_TERMINAL, STRUCTURE_TOWER
  ]
}

class Layout {
  complete: boolean;
  roomName: string;
  structures: TileStructure[];

  constructor(roomName: string) {
    this.complete = false;
    this.roomName = roomName;
    this.structures = [];
  }
}

class TilePossibility {
  public collapsed: boolean;
  public validStructures: ValidStructure[];
  public x: number;
  public y: number;

  public get entropy(): number {
    return this.validStructures.length;
  }

  constructor(x: number, y: number) {
    this.collapsed = false;
    this.validStructures = [
      STRUCTURE_NONE, STRUCTURE_EXTENSION, STRUCTURE_FACTORY,
      STRUCTURE_LAB, STRUCTURE_LINK, STRUCTURE_NUKER, STRUCTURE_OBSERVER,
      STRUCTURE_POWER_SPAWN, STRUCTURE_SPAWN, STRUCTURE_STORAGE, STRUCTURE_TERMINAL,
      STRUCTURE_TOWER
    ];
    this.x = x;
    this.y = y;
  }
}

@registerProcess
export class LayoutProcess extends Process {
  public memory: LayoutProcessMemory = {
    baseRoom: ''
  };

  private _baseRoom?: Room;
  private get baseRoom(): Room {
    if (this._baseRoom) {
      return this._baseRoom;
    }

    this._baseRoom = Game.rooms[this.memory.baseRoom];

    return this._baseRoom;
  }

  private roomField: TilePossibility[] = [];

  public run(): void {
    // TODO: consider CPU usage and suspending between ticks

    // load data:
      // structures with valid neighbors (weights?)
      // include blanks

    const finalLayout = new Layout(this.baseRoom.name);

    this.initializeRoomField();

    // iterate until all cells collapsed
    while(!this.roomFieldIsCollapsed) {
      // find lowest entropy cell
      const tile = this.roomField.reduce((previous, current) => !current.collapsed && (current.entropy < previous.entropy) ? current: previous);

      if (tile.entropy > 1) {
        // collapse cell, randomly for now (TODO: improve with weights or similar)
        const index = Math.round(Math.random() * tile.entropy);
        tile.validStructures = [tile.validStructures[index]];
      }

      tile.collapsed = true;

      if (tile.validStructures[0] !== STRUCTURE_NONE) {
        finalLayout.structures.push({ structure: tile.validStructures[0], x: tile.x, y: tile.y });
      }

      const propagationStack: TilePossibility[] = [];
      let currentTile: TilePossibility | undefined = tile;

      // propagate changes
      // loop until stack empty
      while (currentTile !== undefined) {
        // get neighbors
        const neighborXOptions = [currentTile.x + 1, currentTile.x - 1];
        const neighborYOptions = [currentTile.y + 1, currentTile.y - 1];
        const neighborTiles = this.roomField.filter(_ => !_.collapsed && neighborXOptions.includes(_.x) && neighborYOptions.includes(_.y));

        for (const neighborTile of neighborTiles) {
          // remove impossible options
          for (const neighborPossibility of neighborTile.validStructures) {
            let changed = false


            // TODO: make this better, maybe with comparison functions?
            // compare current tile allowed structures to neighbor possibilities
            if (!(VALID_NEIGHBORS[currentTile.validStructures[0]] as string[]).includes(neighborPossibility.toString())) {
              neighborTile.validStructures = neighborTile.validStructures.filter(_ => _ !== neighborPossibility);
              changed = true;
            }

            if (changed) {
              // add modified tiles to stack
              propagationStack.push(neighborTile);
            }
          }
        }

        currentTile = propagationStack.pop();
      }
    }

    finalLayout.complete = true;
  }

  //#region Private Methods

  private initializeRoomField() {
    const roomTerrain = this.baseRoom.getTerrain();

    for(let x = 1; x < ROOM_SIZE - 1; x++) {
      for(let y = 1; y < ROOM_SIZE - 1; y++) {
        const tileTerrain = roomTerrain.get(x, y);

        if (tileTerrain !== TERRAIN_MASK_WALL) {
          this.roomField.push(new TilePossibility(x, y));
        }
      }
    }

    // TODO: The following -
    // find existing spawn and collapse that tile
    // find sources
      // find link locations with roads, collapse those tiles
    // find mineral, add extractor (should be wall, collapse tile?)
      // find container location with roads, collapse those tiles
    // find controlle
      // find link and container positions with roads, collapse those tiles
  }

  private roomFieldIsCollapsed() {
    return this.roomField.every(_ => _.collapsed);
  }

  //#endregion
}
