export class GraphicsDisplay {
  public static drawCostMatrix(costMatrix: CostMatrix, roomName: string, color = '#666666'): void {
    const vis = new RoomVisual(roomName)
    let v: number;
    let max = 1;

    for (let y = 0; y < 50; ++y) {
      for (let x = 0; x < 50; ++x) {
        v = costMatrix.get(x, y);
        max = Math.max(max, v);
      }
    }

    for (let y = 0; y < 50; ++y) {
      for (let x = 0; x < 50; ++x) {
        v = costMatrix.get(x, y);

        if (v > 0) {
          const radius = (v / max) / 2;
          vis.circle(x, y, {
            fill: 'transparent',
            opacity: 1,
            radius,
            stroke: color,
            strokeWidth: 0.05
          });
          vis.text(v.toString(), x, y + ((radius * 1.75) / 3), { color, font: radius * 1.75 });
        }
      }
    }
  }
}
