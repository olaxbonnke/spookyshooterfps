import { bfs, generateMaze, type Cell, type MazeData } from "./maze";

export type MapId = "grass" | "brick" | "palace";

export type Aabb = { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };

export type Cover = { x: number; z: number; w: number; d: number; h: number };

export type Pumpkin = { x: number; z: number; s: number };

export type Arena = {
  id: MapId;
  name: string;
  line: string;
  sky: number;
  fog: number;
  fogNear: number;
  fogFar: number;
  floor: number;
  wall: number;
  trim: number;
  cover: number;
  sun: number;
  floorW: number;
  floorD: number;
  floorX: number;
  floorZ: number;
  spawn: { x: number; z: number; yaw: number };
  boxes: Aabb[];
  walls: Aabb[];
  shields: Cover[];
  pumpkins: Pumpkin[];
  foes: { x: number; z: number }[];
  maze: MazeData;
};

const CELL = 4.6;
const THICK = 0.55;
const WALL_H = 5.8;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function center(c: number, r: number) {
  return { x: (c + 0.5) * CELL, z: (r + 0.5) * CELL };
}

function openings(cell: Cell) {
  return Number(cell.n) + Number(cell.e) + Number(cell.s) + Number(cell.w);
}

function wallBoxes(maze: MazeData): Aabb[] {
  const { cols, rows, cells } = maze;
  const t = THICK / 2;
  const boxes: Aabb[] = [];
  const add = (x0: number, x1: number, z0: number, z1: number) => {
    boxes.push({ minX: x0, maxX: x1, minY: 0, maxY: WALL_H, minZ: z0, maxZ: z1 });
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!cells[r][c].e) {
        const x = (c + 1) * CELL;
        add(x - t, x + t, r * CELL - t, (r + 1) * CELL + t);
      }
      if (!cells[r][c].s) {
        const z = (r + 1) * CELL;
        add(c * CELL - t, (c + 1) * CELL + t, z - t, z + t);
      }
      if (c === 0) add(-t, t, r * CELL - t, (r + 1) * CELL + t);
      if (r === 0) add(c * CELL - t, (c + 1) * CELL + t, -t, t);
    }
  }
  return boxes;
}

type Theme = {
  id: MapId;
  name: string;
  line: string;
  seed: number;
  cols: number;
  rows: number;
  sky: number;
  fog: number;
  floor: number;
  wall: number;
  trim: number;
  cover: number;
  sun: number;
};

const THEMES: Theme[] = [
  {
    id: "grass",
    name: "Hedge",
    line: "Tall hedges, pumpkins along the paths.",
    seed: 11031,
    cols: 15,
    rows: 15,
    sky: 0x3a2a38,
    fog: 0x4a342c,
    floor: 0x5a6a42,
    wall: 0x2c4a34,
    trim: 0xe07a28,
    cover: 0xc45a18,
    sun: 0xffb067,
  },
  {
    id: "brick",
    name: "Brick",
    line: "A high brick labyrinth. Barricades stop bullets.",
    seed: 22047,
    cols: 17,
    rows: 15,
    sky: 0x3a2824,
    fog: 0x4a3028,
    floor: 0x6a5344,
    wall: 0x7a4034,
    trim: 0xe08a40,
    cover: 0xa85a28,
    sun: 0xffc090,
  },
  {
    id: "palace",
    name: "Stone",
    line: "A long stone maze. Hide behind the barricades.",
    seed: 33019,
    cols: 15,
    rows: 17,
    sky: 0x2c2838,
    fog: 0x3a3644,
    floor: 0x6e6874,
    wall: 0x8a8496,
    trim: 0xd6a15a,
    cover: 0x6a5848,
    sun: 0xffe0b0,
  },
];

function makeArena(theme: Theme): Arena {
  const maze = generateMaze(theme.seed, theme.cols, theme.rows);
  const rng = mulberry32(theme.seed ^ 0x9e3779b9);
  const walls = wallBoxes(maze);
  const start = center(maze.start.c, maze.start.r);

  // Distribute enemies across near, mid, and far sectors using BFS distance from spawn
  const dist = bfs(maze.cells, theme.cols, theme.rows, maze.start.c, maze.start.r);
  const nearSpots: { c: number; r: number }[] = [];
  const midSpots: { c: number; r: number }[] = [];
  const farSpots: { c: number; r: number }[] = [];

  for (let r = 0; r < theme.rows; r++) {
    for (let c = 0; c < theme.cols; c++) {
      const d = dist[r][c];
      if (d <= 2) continue; // Keep immediate spawn clear so player isn't instantly ambushed
      if (d >= 3 && d <= 5) nearSpots.push({ c, r });
      else if (d >= 6 && d <= 11) midSpots.push({ c, r });
      else if (d >= 12) farSpots.push({ c, r });
    }
  }

  const shuffle = <T>(arr: T[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  shuffle(nearSpots);
  shuffle(midSpots);
  shuffle(farSpots);

  const targetFoes = theme.id === "grass" ? 8 : theme.id === "brick" ? 10 : 12;
  const foeKeys = new Set<string>();
  const foes: { x: number; z: number }[] = [];
  const addFoe = (spot: { c: number; r: number }) => {
    const key = `${spot.c},${spot.r}`;
    if (foeKeys.has(key)) return false;
    foeKeys.add(key);
    foes.push(center(spot.c, spot.r));
    return true;
  };

  // 1. Guaranteed near encounters (2 foes within 3-5 steps from start for early action)
  for (const s of nearSpots) {
    if (foes.length >= 2) break;
    addFoe(s);
  }

  // 2. Guaranteed far/objective encounters (exit + gems)
  const keySpots = [maze.exit, ...maze.gems];
  shuffle(keySpots);
  for (const s of keySpots) {
    if (foes.length >= Math.floor(targetFoes * 0.6)) break;
    addFoe(s);
  }

  // 3. Mid-range corridor / intersection encounters
  for (const s of midSpots) {
    if (foes.length >= targetFoes) break;
    addFoe(s);
  }

  // 4. Fill any remaining quota from farSpots or nearSpots
  for (const s of [...farSpots, ...nearSpots]) {
    if (foes.length >= targetFoes) break;
    addFoe(s);
  }

  const shields: Cover[] = [];
  const boxes: Aabb[] = walls.slice();
  for (let r = 0; r < maze.rows; r++) {
    for (let c = 0; c < maze.cols; c++) {
      if (c === 0 && r === 0) continue;
      if (foeKeys.has(`${c},${r}`)) continue;
      const cell = maze.cells[r][c];
      const open = openings(cell);
      if (open < 2 || rng() > 0.22) continue;
      const at = center(c, r);
      const w = 1.35;
      const d = 0.7;
      const h = 1.9;
      let x = at.x;
      let z = at.z;
      if (cell.n && cell.s && !cell.e) x = (c + 1) * CELL - THICK / 2 - w / 2 - 0.05;
      else if (cell.n && cell.s && !cell.w) x = c * CELL + THICK / 2 + w / 2 + 0.05;
      else if (!cell.n) z = r * CELL + THICK / 2 + d / 2 + 0.05;
      else z = (r + 1) * CELL - THICK / 2 - d / 2 - 0.05;
      const shield: Cover = { x, z, w: cell.e || cell.w ? d : w, d: cell.e || cell.w ? w : d, h };
      if (Math.hypot(shield.x - start.x, shield.z - start.z) < 2.4) continue;
      shields.push(shield);
      boxes.push({
        minX: shield.x - shield.w / 2,
        maxX: shield.x + shield.w / 2,
        minY: 0,
        maxY: shield.h,
        minZ: shield.z - shield.d / 2,
        maxZ: shield.z + shield.d / 2,
      });
    }
  }

  const pumpkins: Pumpkin[] = [];
  for (let r = 0; r < maze.rows; r++) {
    for (let c = 0; c < maze.cols; c++) {
      const count = 1 + (rng() > 0.45 ? 1 : 0) + (rng() > 0.82 ? 1 : 0);
      for (let n = 0; n < count; n++) {
        const at = center(c, r);
        const edge = CELL * 0.36;
        const x = at.x + (rng() * 2 - 1) * edge;
        const z = at.z + (rng() * 2 - 1) * edge;
        if (Math.hypot(x - start.x, z - start.z) < 1.3) continue;
        const blocked = shields.some((s) => Math.abs(x - s.x) < s.w * 0.7 && Math.abs(z - s.z) < s.d * 0.7);
        if (blocked) continue;
        pumpkins.push({ x, z, s: 0.72 + rng() * 0.55 });
      }
    }
  }

  return {
    id: theme.id,
    name: theme.name,
    line: theme.line,
    sky: theme.sky,
    fog: theme.fog,
    fogNear: 10,
    fogFar: 46,
    floor: theme.floor,
    wall: theme.wall,
    trim: theme.trim,
    cover: theme.cover,
    sun: theme.sun,
    floorW: theme.cols * CELL + 2,
    floorD: theme.rows * CELL + 2,
    floorX: (theme.cols * CELL) / 2,
    floorZ: (theme.rows * CELL) / 2,
    spawn: { x: start.x, z: start.z, yaw: maze.spawnYaw },
    boxes,
    walls,
    shields,
    pumpkins,
    foes,
    maze,
  };
}

export const ARENAS: Arena[] = THEMES.map(makeArena);

export function findArena(id: MapId) {
  return ARENAS.find((arena) => arena.id === id) ?? ARENAS[0];
}

export function arenaBoxes(arena: Arena) {
  return arena.boxes;
}

export function circleHits(x: number, z: number, rad: number, boxes: Aabb[]) {
  for (const b of boxes) {
    if (b.maxY < 0.4) continue;
    const cx = Math.max(b.minX, Math.min(x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < rad * rad) return true;
  }
  return false;
}

export function resolveMove(x: number, z: number, dx: number, dz: number, rad: number, boxes: Aabb[]) {
  const dist = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(dist / 0.15));
  const sx = dx / steps;
  const sz = dz / steps;
  for (let i = 0; i < steps; i++) {
    if (!circleHits(x + sx, z, rad, boxes)) x += sx;
    if (!circleHits(x, z + sz, rad, boxes)) z += sz;
  }
  return { x, z };
}

export function rayBoxes(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
  boxes: Aabb[],
) {
  let best = maxDist;
  for (const b of boxes) {
    let tmin = 0;
    let tmax = best;
    const slabs: [number, number, number, number][] = [
      [ox, dx, b.minX, b.maxX],
      [oy, dy, b.minY, b.maxY],
      [oz, dz, b.minZ, b.maxZ],
    ];
    let miss = false;
    for (const [o, d, min, max] of slabs) {
      if (Math.abs(d) < 1e-8) {
        if (o < min || o > max) miss = true;
        continue;
      }
      let t1 = (min - o) / d;
      let t2 = (max - o) / d;
      if (t1 > t2) {
        const s = t1;
        t1 = t2;
        t2 = s;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmax < tmin) miss = true;
    }
    if (!miss && tmin > 0.05 && tmin < best) best = tmin;
  }
  return best;
}
