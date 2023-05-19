import { Logger } from 'utils/Logger';
import { GraphicsDisplay } from './GraphicsDisplay';

type LayoutTemplate = ((BuildableStructureConstant | undefined)[])[];

interface StructurePosition {
  structureType: BuildableStructureConstant,
  pos: RoomPosition
};

export class Layout {
  public roomBuildCM: CostMatrix;
  public roomWalkCM: CostMatrix;

  public mineralHarvestPositions: {
    sourceId: string;
    pos: RoomPosition;
  }[];
  public pylonFillPositions: RoomPosition[];
  public sourceHarvestPositions: {
    sourceId: string;
    pos: RoomPosition;
  }[];
  public upgradePosition?: RoomPosition;

  public structurePositions: StructurePosition[];

  constructor() {
    this.roomBuildCM = new PathFinder.CostMatrix();
    this.roomWalkCM = new PathFinder.CostMatrix();
    this.mineralHarvestPositions = [];
    this.pylonFillPositions = [];
    this.sourceHarvestPositions = [];
    this.structurePositions = []
  }

  public addStructurePositions(structurePositions: StructurePosition[]) {
    for (const structurePosition of structurePositions) {
      if (this.structurePositions.find(_ => _ === structurePosition)) {
        continue;
      }

      this.structurePositions.push(structurePosition);
      this.roomBuildCM.set(structurePosition.pos.x, structurePosition.pos.y, 0);

      if (structurePosition.structureType !== STRUCTURE_ROAD) {
        this.roomWalkCM.set(structurePosition.pos.x, structurePosition.pos.y, 10);
      }
    }
  }

  // public serialize(): string {
  // }

  // public static deserialize(serializedLayout: string): Layout | undefined {
  // }
}

export class LayoutPlanner {
  private static readonly FORGE_TEMPLATE: LayoutTemplate = [
    [STRUCTURE_ROAD, STRUCTURE_LAB,  STRUCTURE_LAB,  undefined],
    [STRUCTURE_LAB,  STRUCTURE_ROAD, STRUCTURE_LAB,  STRUCTURE_LAB],
    [STRUCTURE_LAB,  STRUCTURE_LAB,  STRUCTURE_ROAD, STRUCTURE_LAB],
    [undefined,      STRUCTURE_LAB,  STRUCTURE_LAB,  STRUCTURE_ROAD]
  ];

  private static readonly NEXUS_TEMPLATE: LayoutTemplate = [
    [STRUCTURE_ROAD, STRUCTURE_ROAD,        STRUCTURE_ROAD,      STRUCTURE_ROAD,    STRUCTURE_ROAD],
    [STRUCTURE_ROAD, STRUCTURE_TERMINAL,    STRUCTURE_NUKER,     STRUCTURE_FACTORY, STRUCTURE_ROAD],
    [STRUCTURE_ROAD, STRUCTURE_STORAGE,     undefined,           STRUCTURE_LINK,    STRUCTURE_ROAD],
    [STRUCTURE_ROAD, STRUCTURE_POWER_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_SPAWN,   STRUCTURE_ROAD],
    [STRUCTURE_ROAD, STRUCTURE_ROAD,        STRUCTURE_ROAD,      STRUCTURE_ROAD,    STRUCTURE_ROAD]
  ];

  private static readonly PHOTON_CANNON_TEMPLATE: LayoutTemplate = [
    [STRUCTURE_LINK,  STRUCTURE_TOWER, STRUCTURE_TOWER],
    [STRUCTURE_TOWER, undefined,       STRUCTURE_TOWER],
    [STRUCTURE_TOWER, STRUCTURE_TOWER, undefined]
  ];

  private static readonly PYLON_TEMPLATE: LayoutTemplate = [
    [undefined,           STRUCTURE_EXTENSION, STRUCTURE_EXTENSION],
    [STRUCTURE_EXTENSION, undefined,           STRUCTURE_EXTENSION],
    [STRUCTURE_EXTENSION, STRUCTURE_EXTENSION, undefined]
  ];

  private static readonly WARP_GATE_TEMPLATE: LayoutTemplate = [
    [STRUCTURE_ROAD, STRUCTURE_ROAD,      STRUCTURE_ROAD,      STRUCTURE_ROAD,      STRUCTURE_ROAD],
    [STRUCTURE_ROAD, STRUCTURE_EXTENSION, STRUCTURE_EXTENSION, STRUCTURE_EXTENSION, STRUCTURE_ROAD],
    [STRUCTURE_ROAD, STRUCTURE_SPAWN,     undefined,           STRUCTURE_SPAWN,     STRUCTURE_ROAD],
    [STRUCTURE_ROAD, STRUCTURE_EXTENSION, STRUCTURE_LINK,      STRUCTURE_EXTENSION, STRUCTURE_ROAD],
    [STRUCTURE_ROAD, STRUCTURE_ROAD,      STRUCTURE_ROAD,      STRUCTURE_ROAD,      STRUCTURE_ROAD]
  ];

  public static generateLayout(roomName: string): Layout | undefined {
    const room = Game.rooms[roomName];

    if (!room.controller) {
      Logger.error('No room controller, aborting layout generation');
      return;
    }

    // Find desired origin
    const sources = room.find(FIND_SOURCES);
    const minerals = room.find(FIND_MINERALS);
    const desiredOrigin = this.findDesiredOrigin(room.controller.pos, sources, minerals);

    if (!desiredOrigin) {
      Logger.error('Could not find desired origin, aborting layout generation');
      return;
    }

    const layout = new Layout();
    layout.roomBuildCM = this.blockablePixelsForRoom(roomName);
    layout.roomWalkCM = this.walkablePixelsForRoom(roomName);

    // Block controller area from build
    // for (let dx = -2; dx < 3; dx++) {
    //   for (let dy = -2; dy < 3; dy++) {
    //     layout.roomBuildCM.set(room.controller.pos.x + dx, room.controller.pos.y + dy, 0);
    //   }
    // }

    // Wall off controller
    let pos = room.controller.pos;
    for (let dx = -1; dx < 2; dx++) {
      for (let dy = -1; dy < 2; dy ++) {
        const currX = pos.x + dx;
        const currY = pos.y + dy;
        if (layout.roomBuildCM.get(currX, currY) !== 0) {
          const currPos = new RoomPosition(currX, currY, room.name);
          layout.addStructurePositions([{ structureType: STRUCTURE_WALL, pos: currPos }]);
        }
      }
    }

    // [RCL 1]

    // Find best position for Nexus
    let roomDistanceCM = this.bamesDistanceTransform(layout.roomBuildCM.clone());
    const nexusCenter = this.findPositionForTemplate(this.NEXUS_TEMPLATE, desiredOrigin, roomDistanceCM);
    layout.roomBuildCM.set(nexusCenter.x, nexusCenter.y, 0);
    const nexusStructurePositions = this.getStructurePositionsForTemplate(this.NEXUS_TEMPLATE, nexusCenter);
    layout.addStructurePositions(nexusStructurePositions);

    // Find upgrade position
    const pathResult = PathFinder.search(
      nexusCenter,
      { pos: room.controller.pos, range: 2 },
      { maxRooms: 1, roomCallback: () => layout.roomWalkCM }
    );

    if (!pathResult.incomplete) {
      const pos = pathResult.path.pop();

      if (pos) {
        layout.upgradePosition = pos;
        layout.addStructurePositions([{ structureType: STRUCTURE_CONTAINER, pos }]);
        for (let dx = -1; dx < 2; dx++) {
          for (let dy = -1; dy < 2; dy ++) {
            layout.roomBuildCM.set(pos.x + dx, pos.y + dy, 0);
          }
        }
      }
    }

    // Find harvest positions
    for (const source of sources) {
      const pathResult = PathFinder.search(
        source.pos,
        { pos: nexusCenter, range: this.getTemplateMaxRadius(this.NEXUS_TEMPLATE) },
        { maxRooms: 1, roomCallback: () => layout.roomWalkCM }
      );

      if (pathResult.incomplete) {
        continue;
      }

      const pos = pathResult.path.shift();

      if (!pos) {
        continue;
      }

      layout.sourceHarvestPositions.push({ sourceId: source.id, pos });
      layout.structurePositions.push({ structureType: STRUCTURE_CONTAINER, pos });
      layout.roomBuildCM.set(pos.x, pos.y, 0);
      layout.roomWalkCM.set(pos.x, pos.y, 0);
    }

    for (const mineral of minerals) {
      const pathResult = PathFinder.search(
        mineral.pos,
        { pos: nexusCenter, range: this.getTemplateMaxRadius(this.NEXUS_TEMPLATE) },
        { maxRooms: 1, roomCallback: () => layout.roomWalkCM }
      );

      if (pathResult.incomplete) {
        continue;
      }

      const pos = pathResult.path.shift();

      if (!pos) {
        continue;
      }

      layout.mineralHarvestPositions.push({ sourceId: mineral.id, pos });
      layout.structurePositions.push({ structureType: STRUCTURE_CONTAINER, pos });
      layout.roomBuildCM.set(pos.x, pos.y, 0);
      layout.roomWalkCM.set(pos.x, pos.y, 0);
    }

    // [RCL 2 - 5 extensions]

    // 1 Pylon [7 total extensions]
    this.addPylonToLayout(nexusCenter, layout);

    // [RCL 3 - 10 extensions]

    // Find best position for Photon Cannon
    roomDistanceCM = this.bamesDistanceTransform(layout.roomBuildCM.clone());
    const cannonCenter = this.findPositionForTemplate(this.PHOTON_CANNON_TEMPLATE, nexusCenter, roomDistanceCM);
    let orientedTemplate = this.PHOTON_CANNON_TEMPLATE.slice();
    let directionToNexus = cannonCenter.getDirectionTo(nexusCenter);

    if (([TOP_LEFT, TOP, TOP_RIGHT] as DirectionConstant[]).includes(directionToNexus)) {
      orientedTemplate = this.getTemplateMirrorVertical(orientedTemplate);
    }

    if (([TOP_LEFT, LEFT, BOTTOM_LEFT] as DirectionConstant[]).includes(directionToNexus)) {
      orientedTemplate = this.getTemplateMirrorHorizontal(orientedTemplate);
    }

    const cannonStructurePositions = this.getStructurePositionsForTemplate(orientedTemplate, cannonCenter);
    layout.addStructurePositions(cannonStructurePositions);
    let roadStructurePositions = this.getRoadStructurePositions(cannonCenter, nexusCenter, layout, this.getTemplateMaxRadius(this.NEXUS_TEMPLATE));

    if (roadStructurePositions) {
      layout.addStructurePositions(roadStructurePositions);
    }

    // 1 Pylon [13 total extensions]
    this.addPylonToLayout(nexusCenter, layout);

    // [RCL 4 - 20 extensions]

    // 2 Pylons [25 total extensions]
    this.addPylonToLayout(nexusCenter, layout);
    this.addPylonToLayout(nexusCenter, layout);

    // [RCL 5 - 30 extensions]

    // 1 Pylon [31 total extensions]
    this.addPylonToLayout(nexusCenter, layout);

    // [RCL 6 - 40 extensions]

    // Find best position for Forge
    roomDistanceCM = this.bamesDistanceTransform(layout.roomBuildCM.clone());
    const forgeCenter = this.findPositionForTemplate(this.FORGE_TEMPLATE, nexusCenter, roomDistanceCM);
    orientedTemplate = this.FORGE_TEMPLATE.slice();
    directionToNexus = forgeCenter.getDirectionTo(nexusCenter);

    if (([TOP_RIGHT, BOTTOM_LEFT] as DirectionConstant[]).includes(directionToNexus)) {
      orientedTemplate = this.getTemplateMirrorVertical(orientedTemplate);
    }

    const forgeStructurePositions = this.getStructurePositionsForTemplate(orientedTemplate, forgeCenter);
    layout.addStructurePositions(forgeStructurePositions);

    roadStructurePositions = this.getRoadStructurePositions(forgeCenter, nexusCenter, layout, this.getTemplateMaxRadius(this.NEXUS_TEMPLATE));

    if (roadStructurePositions) {
      layout.addStructurePositions(roadStructurePositions);
    }

    // 2 Pylons [43 total extensions]
    this.addPylonToLayout(nexusCenter, layout);
    this.addPylonToLayout(nexusCenter, layout);

    // [RCL 7 - 50 extensions]

    // Find best position for Warp Gate

    roomDistanceCM = this.bamesDistanceTransform(layout.roomBuildCM.clone());
    const gateCenter = this.findPositionForTemplate(this.WARP_GATE_TEMPLATE, nexusCenter, roomDistanceCM);
    layout.roomBuildCM.set(gateCenter.x, gateCenter.y, 0);
    const gateStructurePositions = this.getStructurePositionsForTemplate(this.WARP_GATE_TEMPLATE, gateCenter);
    layout.addStructurePositions(gateStructurePositions);
    roadStructurePositions = this.getRoadStructurePositions(gateCenter, nexusCenter, layout, this.getTemplateMaxRadius(this.NEXUS_TEMPLATE), false);

    if (roadStructurePositions) {
      layout.addStructurePositions(roadStructurePositions);
    }

    // 1 Pylon [54 total extensions]
    this.addPylonToLayout(nexusCenter, layout);

    // [RCL 8 - 60 extensions]

    // Find best position for observer
    roomDistanceCM = this.bamesDistanceTransform(layout.roomBuildCM.clone());
    const observerCenter = this.findPositionForTemplate([[STRUCTURE_OBSERVER]] as LayoutTemplate, nexusCenter, roomDistanceCM);
    const observerStructurePositions: StructurePosition[] = [{ structureType: STRUCTURE_OBSERVER, pos: observerCenter }];
    layout.addStructurePositions(observerStructurePositions);
    roadStructurePositions = this.getRoadStructurePositions(observerCenter, nexusCenter, layout, this.getTemplateMaxRadius(this.NEXUS_TEMPLATE), false);

    if (roadStructurePositions) {
      layout.addStructurePositions(roadStructurePositions);
    }

    // 1 Pylon [60 total extensions]
    this.addPylonToLayout(nexusCenter, layout);

    // Upgrade position path
    if (layout.upgradePosition) {
      roadStructurePositions = this.getRoadStructurePositions(layout.upgradePosition, nexusCenter, layout, this.getTemplateMaxRadius(this.NEXUS_TEMPLATE), false);

      if (roadStructurePositions) {
        layout.addStructurePositions(roadStructurePositions);
      }
    }

    // Source harvest position path(s)
    for (const sourceHarvestPosition of layout.sourceHarvestPositions) {
      roadStructurePositions = this.getRoadStructurePositions(sourceHarvestPosition.pos, nexusCenter, layout, this.getTemplateMaxRadius(this.NEXUS_TEMPLATE), false);

      if (roadStructurePositions) {
        layout.addStructurePositions(roadStructurePositions);
      }
    }

    // Mineral harvest position path(s)
    for (const mineralHarvestPosition of layout.mineralHarvestPositions) {
      roadStructurePositions = this.getRoadStructurePositions(mineralHarvestPosition.pos, nexusCenter, layout, this.getTemplateMaxRadius(this.NEXUS_TEMPLATE), false);

      if (roadStructurePositions) {
        layout.addStructurePositions(roadStructurePositions);
      }
    }


    // Draw
    roomDistanceCM = this.bamesDistanceTransform(layout.roomBuildCM.clone());
    GraphicsDisplay.drawCostMatrix(roomDistanceCM, roomName);

    for (const structurePosition of layout.structurePositions) {
      room.visual.structure(structurePosition.pos.x, structurePosition.pos.y, structurePosition.structureType);
    }

    room.visual.connectRoads();

    room.visual.circle(desiredOrigin, { fill: 'blue' });
    room.visual.circle(layout.upgradePosition!, { fill: 'red' });

    return;
  }

  /**
   * Sets the non-zero positions in the input CostMatrix to the distance* to the nearest zero valued
   * position.
   *
   * *distance is chessboard distance.
   *
   * The `oob` parameter is used so that if an object pixel is at the image boundary you can avoid
   * having that reduce the pixel's value in the final output. Set it to a high value (e.g., 255) for
   * this. Set `oob` to 0 to treat out of bounds as background pixels.
   *
   * @param foregroundPixels - Object pixels. Modified on output
   * @param oob - Value used for pixels outside image bounds
   * @returns
   */
  public static bamesDistanceTransform(foregroundPixels: CostMatrix, oob: number = 255): CostMatrix {
    const dist = foregroundPixels // not a copy. We're modifying the input
    // Variables to represent the 3x3 neighborhood of a pixel.
    // A, B, C
    // D, E, F
    // G, H, I
    let A: number;
    let B: number;
    let C: number;
    let D: number;
    let E: number;
    let F: number;
    let G: number;
    let H: number;
    let I: number;

    for (let y = 0; y < 50; ++y) {
      for (let x = 0; x < 50; ++x) {
        if (foregroundPixels.get(x, y) !== 0) {
          A = dist.get(x - 1, y - 1);
          B = dist.get(x, y - 1);
          C = dist.get(x + 1, y - 1);
          D = dist.get(x - 1, y);

          if (y === 0) {
            A = oob;
            B = oob;
            C = oob;
          }

          if (x === 0) {
            A = oob;
            D = oob;
          }

          if (x === 49) {
            C = oob;
          }

          dist.set(x, y, Math.min(A, B, C, D) + 1);
        }
      }
    }

    for (let y = 49; y >= 0; --y) {
      for (let x = 49; x >= 0; --x) {
        E = dist.get(x, y);
        F = dist.get(x + 1, y);
        G = dist.get(x - 1, y + 1);
        H = dist.get(x, y + 1);
        I = dist.get(x + 1, y + 1);

        if (y === 49) {
          G = oob;
          H = oob;
          I = oob;
        }

        if (x === 49) {
          F = oob;
          I = oob;
        }

        if (x === 0) {
          G = oob;
        }

        dist.set(x, y, Math.min(E, F + 1, G + 1, H + 1, I + 1));
      }
    }

    return dist;
  }

  /**
   * positions on which you can build blocking structures, such as walls.
   */
  public static blockablePixelsForRoom(roomName: string): CostMatrix {
    const costMatrix = new PathFinder.CostMatrix()

    for (let y = 0; y < 50; ++y) {
      for (let x = 0; x < 50; ++x) {
        if (!this.wallOrAdjacentToExit(x, y, roomName)) {
          costMatrix.set(x, y, 1);
        }
      }
    }

    return costMatrix;
  }

  public static walkablePixelsForRoom(roomName: string): CostMatrix {
    const costMatrix = new PathFinder.CostMatrix();
    const roomTerrain = Game.map.getRoomTerrain(roomName);

    for (let y = 0; y < 50; ++y) {
      for (let x = 0; x < 50; ++x) {
        if (roomTerrain.get(x, y) !== TERRAIN_MASK_WALL) {
          costMatrix.set(x, y, 1);
        }
      }
    }

    return costMatrix;
  }

  //#region Private Methods

  private static addPylonToLayout(nexusCenter: RoomPosition, layout: Layout) {
    const roomDistanceCM = this.bamesDistanceTransform(layout.roomBuildCM.clone());
    const pylonCenter = this.findPositionForTemplate(this.PYLON_TEMPLATE, nexusCenter, roomDistanceCM);
    layout.pylonFillPositions.push(pylonCenter);
    let orientedTemplate = this.PYLON_TEMPLATE.slice();
    const directionToNexus = pylonCenter.getDirectionTo(nexusCenter);

    if (([TOP_RIGHT, BOTTOM_LEFT] as DirectionConstant[]).includes(directionToNexus)) {
      orientedTemplate = this.getTemplateMirrorVertical(orientedTemplate);
    }

    const pylonStructurePositions = this.getStructurePositionsForTemplate(orientedTemplate, pylonCenter);
    layout.addStructurePositions(pylonStructurePositions);
    const roadStructurePositions = this.getRoadStructurePositions(pylonCenter, nexusCenter, layout, this.getTemplateMaxRadius(this.NEXUS_TEMPLATE));

    if (roadStructurePositions) {
      layout.addStructurePositions(roadStructurePositions);
    }
  }

  private static determineTemplateTopLeftPosition(template: LayoutTemplate, templateCenter: RoomPosition): RoomPosition {
    const radius = this.getTemplateMaxRadius(template);
    return new RoomPosition(templateCenter.x - radius, templateCenter.y - radius, templateCenter.roomName);
  }

  private static drawPath(path: RoomPosition[], room: Room): void {
    for (const pos of path) {
      room.visual.circle(pos, { fill: 'green' });
    }
  }

  private static findDesiredOrigin(controllerPosition: RoomPosition, sources: Source[], minerals: Mineral[]) {
    let desiredX = controllerPosition.x;
    let desiredY = controllerPosition.y;
    let points = 1;

    for (const source of sources) {
      desiredX += source.pos.x;
      desiredY += source.pos.y;
      points++;
    }

    for (const mineral of minerals) {
      desiredX += mineral.pos.x;
      desiredY += mineral.pos.y;
      points++;
    }

    desiredX = Math.round(desiredX / points);
    desiredY = Math.round(desiredY / points);

    return new RoomPosition(desiredX, desiredY, controllerPosition.roomName);
  }

  private static findPositionForTemplate(template: LayoutTemplate, desiredOrigin: RoomPosition, distanceCostMatrix: CostMatrix): RoomPosition {
    const radius = this.getTemplateMaxRadius(template);
    let bestDistance: number = Number.MAX_SAFE_INTEGER;
    let bestTemplateLocation: { x: number, y: number } = { x: 0, y: 0 };

    for (let x = 0; x < 50; x++) {
      for (let y = 0; y < 50; y++) {
        const space = (distanceCostMatrix.get(x, y) - 1);

        if (space < radius) {
          continue;
        }

        const distance = desiredOrigin.getRangeTo(x, y);

        if (distance >= bestDistance) {
          continue;
        }

        bestDistance = distance;
        bestTemplateLocation = { x, y };
      }
    }

    return new RoomPosition(bestTemplateLocation.x, bestTemplateLocation.y, desiredOrigin.roomName);
  }

  private static getRoadStructurePositions(start: RoomPosition, end: RoomPosition, layout: Layout, endRange: number = 0, startRoad: boolean = true): StructurePosition[] | undefined {
    const pathResult = PathFinder.search(
      start,
      { pos: end, range: endRange },
      { maxRooms: 1, roomCallback: () => layout.roomWalkCM }
    );

    if (pathResult.incomplete) {
      return;
    }

    const result: StructurePosition[] = [];

    if (startRoad && layout.roomBuildCM.get(start.x, start.y) !== 0) {
      result.push({ structureType: STRUCTURE_ROAD, pos: start });
    }

    for (const pos of pathResult.path) {
      if (layout.roomBuildCM.get(pos.x, pos.y) !== 1) {
        continue;
      }

      result.push({ structureType: STRUCTURE_ROAD, pos });
    }

    return result;
  }

  private static getStructurePositionsForTemplate(template: LayoutTemplate, templateCenter: RoomPosition): StructurePosition[] {
    const structures: StructurePosition[] = [];
    const startPos = this.determineTemplateTopLeftPosition(template, templateCenter);

    for (let i = 0; i < template.length; i++) {
      for (let j = 0; j < template[i].length; j++) {
        const structureType = template[i][j];

        if (structureType === undefined) {
          continue;
        }

        structures.push({ structureType, pos: new RoomPosition(startPos.x + j, startPos.y + i, startPos.roomName) })
      }
    }

    return structures;
  }

  private static getTemplateMaxHorizontalSpaceFromCenter(template: LayoutTemplate): number {
    let max = 0;

    for (const row of template) {
      if (row.length > max) {
        max = row.length;
      }
    }

    return Math.floor(max / 2);
  }

  private static getTemplateMaxRadius(template: LayoutTemplate): number {
    const templateSpaceX = this.getTemplateMaxHorizontalSpaceFromCenter(template);
    const templateSpaceY = this.getTemplateMaxVerticalSpaceFromCenter(template);
    return Math.max(templateSpaceX, templateSpaceY);
  }

  private static getTemplateMaxVerticalSpaceFromCenter(template: LayoutTemplate): number {
    return Math.floor((template.length) / 2);
  }

  private static getTemplateMirrorHorizontal(template: LayoutTemplate): LayoutTemplate {
    for (let i = 0; i < template.length; i++) {
      template[i].reverse();
    }

    return template;
  }

  private static getTemplateMirrorVertical(template: LayoutTemplate): LayoutTemplate {
    return template.reverse();
  }

  private static wallOrAdjacentToExit(x: number, y: number, roomName: string): boolean {
    const roomTerrain = Game.map.getRoomTerrain(roomName);

    if (x > 1 && x < 48 && y > 1 && y < 48) {
      return roomTerrain.get(x, y) === TERRAIN_MASK_WALL;
    }

    if (x === 0 || y === 0 || x === 49 || y === 49) {
      return true;
    }

    if (roomTerrain.get(x, y) === TERRAIN_MASK_WALL) {
      return true;
    }

    let A;
    let B;
    let C;

    if (x === 1) {
      A = roomTerrain.get(0, y - 1);
      B = roomTerrain.get(0, y);
      C = roomTerrain.get(0, y + 1);
    }

    if (x === 48) {
      A = roomTerrain.get(49, y - 1);
      B = roomTerrain.get(49, y);
      C = roomTerrain.get(49, y + 1);
    }

    if (y === 1) {
      A = roomTerrain.get(x - 1, 0);
      B = roomTerrain.get(x, 0);
      C = roomTerrain.get(x + 1, 0);
    }

    if (y === 48) {
      A = roomTerrain.get(x - 1, 49);
      B = roomTerrain.get(x, 49);
      C = roomTerrain.get(x + 1, 49);
    }

    return !(A === TERRAIN_MASK_WALL && B === TERRAIN_MASK_WALL && C === TERRAIN_MASK_WALL);
  }

  //#endregion

}
