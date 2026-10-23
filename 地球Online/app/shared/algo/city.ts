/** 城市底板数据（rules/cities/*.json）的运行时封装 */
export interface LandmarkBox { x0: number; y0: number; x1: number; y1: number; z0: number; z1: number; base: [number, number, number]; top: [number, number, number] | null }
export interface Landmark { kind: string; x: number; y: number; name: string; role: "place" | "lodging" | "airport" | null; topz: number; boxes: LandmarkBox[] }
export interface CityJson {
  schemaVersion: string; id: string; name: string; cols: number; rows: number; cellMeters: number; ground: string[];
  hroads: [number, number][]; vroads: [number, number][]; hrails: [number, number][]; vrails: [number, number][]; subway: [number, number][];
  nohouse: [number, number][]; deer: boolean; labels: [number, number, string, [number, number, number]][];
  landmarks: { kind: string; x: number; y: number; name: string; role: Landmark["role"]; topz: number; boxes: (number | number[] | null)[][] }[];
}
export class CityPlate {
  readonly id: string; readonly name: string; readonly cols: number; readonly rows: number; readonly ground: string[];
  readonly hroads: Set<number>; readonly vroads: Set<number>; readonly hrails: Set<number>; readonly vrails: Set<number>; readonly subway: Set<number>; readonly nohouse: Set<number>;
  readonly landmarks: Landmark[]; readonly labels: CityJson["labels"]; readonly deer: boolean;
  readonly walkable: [number, number][]; readonly walkableSet: Set<number>;
  readonly json: CityJson;
  constructor(json: CityJson) {
    this.json = json;
    this.id = json.id; this.name = json.name; this.cols = json.cols; this.rows = json.rows; this.ground = json.ground; this.deer = json.deer; this.labels = json.labels;
    const key = (c: [number, number]) => c[1] * json.cols + c[0];
    this.hroads = new Set(json.hroads.map(key)); this.vroads = new Set(json.vroads.map(key)); this.hrails = new Set(json.hrails.map(key)); this.vrails = new Set(json.vrails.map(key));
    this.subway = new Set(json.subway.map(key)); this.nohouse = new Set(json.nohouse.map(key));
    this.landmarks = json.landmarks.map((l) => ({ kind: l.kind, x: l.x, y: l.y, name: l.name, role: l.role, topz: l.topz,
      boxes: l.boxes.map((b) => ({ x0: b[0] as number, y0: b[1] as number, x1: b[2] as number, y1: b[3] as number, z0: b[4] as number, z1: b[5] as number, base: b[6] as [number, number, number], top: b[7] as [number, number, number] | null })) }));
    const w = new Set<number>([...this.hroads, ...this.vroads, ...this.hrails, ...this.vrails]);
    this.walkableSet = w; this.walkable = [...w].map((k) => [k % json.cols, Math.floor(k / json.cols)] as [number, number]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  }
  cell(x: number, y: number): string { return this.ground[y]?.[x] ?? "U"; }
  isWater(x: number, y: number): boolean { const c = this.cell(x, y); return c === "W" || c === "O"; }
  key(x: number, y: number): number { return y * this.cols + x; }
}
