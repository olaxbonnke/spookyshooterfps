export const CELL = 3.6;
export const WALL_T = 0.32;
export const PLAYER_RADIUS = 0.32;

export type Dir = "n" | "e" | "s" | "w";
export type Cell = Record<Dir, boolean>;

export type GridPoint = { c: number; r: number };

export type MazeData = {
  cols: number;
  rows: number;
  cells: Cell[][];
  start: GridPoint;
  exit: GridPoint;
  gems: GridPoint[];
  spawnYaw: number;
  exitYaw: number;
};

export type Aabb = { minX: number; maxX: number; minZ: number; maxZ: number };

const DIRS: { dir: Dir; dc: number; dr: number; back: Dir; yaw: number }[] = [
  { dir: "n", dc: 0, dr: -1, back: "s", yaw: 0 },
  { dir: "e", dc: 1, dr: 0, back: "w", yaw: -Math.PI / 2 },
  { dir: "s", dc: 0, dr: 1, back: "n", yaw: Math.PI },
  { dir: "w", dc: -1, dr: 0, back: "e", yaw: Math.PI / 2 },
];

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

export function cellCenter(c: number, r: number) {
  return { x: (c + 0.5) * CELL, z: (r + 0.5) * CELL };
}

export function worldToCell(x: number, z: number, cols: number, rows: number) {
  const c = Math.min(cols - 1, Math.max(0, Math.floor(x / CELL)));
  const r = Math.min(rows - 1, Math.max(0, Math.floor(z / CELL)));
  return { c, r };
}

function neighbors(cells: Cell[][], c: number, r: number) {
  const out: { c: number; r: number; dir: Dir }[] = [];
  for (const d of DIRS) {
    if (!cells[r][c][d.dir]) continue;
    out.push({ c: c + d.dc, r: r + d.dr, dir: d.dir });
  }
  return out;
}

function bfs(cells: Cell[][], cols: number, rows: number, sc: number, sr: number) {
  const dist = Array.from({ length: rows }, () => Array<number>(cols).fill(-1));
  const q: { c: number; r: number }[] = [{ c: sc, r: sr }];
  dist[sr][sc] = 0;
  let qi = 0;
  while (qi < q.length) {
    const { c, r } = q[qi++];
    for (const n of neighbors(cells, c, r)) {
      if (dist[n.r][n.c] >= 0) continue;
      dist[n.r][n.c] = dist[r][c] + 1;
      q.push(n);
    }
  }
  return dist;
}

function straightRun(cells: Cell[][], c: number, r: number, dir: Dir) {
  const d = DIRS.find((x) => x.dir === dir)!;
  let n = 0;
  let cc = c;
  let rr = r;
  while (cells[rr][cc][dir]) {
    n += 1;
    cc += d.dc;
    rr += d.dr;
    if (n > 64) break;
  }
  return n;
}

export function generateMaze(seed: number, cols = 11, rows = 11): MazeData {
  const rng = mulberry32(seed);
  const cells: Cell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ n: false, e: false, s: false, w: false })),
  );
  const seen = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
  const stack: GridPoint[] = [{ c: 0, r: 0 }];
  seen[0][0] = true;

  while (stack.length) {
    const cur = stack[stack.length - 1];
    const options = DIRS.filter((d) => {
      const nc = cur.c + d.dc;
      const nr = cur.r + d.dr;
      return nc >= 0 && nr >= 0 && nc < cols && nr < rows && !seen[nr][nc];
    });
    if (!options.length) {
      stack.pop();
      continue;
    }
    const pick = options[Math.floor(rng() * options.length)];
    const nc = cur.c + pick.dc;
    const nr = cur.r + pick.dr;
    cells[cur.r][cur.c][pick.dir] = true;
    cells[nr][nc][pick.back] = true;
    seen[nr][nc] = true;
    stack.push({ c: nc, r: nr });
  }

  const dist = bfs(cells, cols, rows, 0, 0);
  let exit: GridPoint = { c: cols - 1, r: rows - 1 };
  let best = -1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (dist[r][c] > best) {
        best = dist[r][c];
        exit = { c, r };
      }
    }
  }

  const dead: { c: number; r: number; d: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((c === 0 && r === 0) || (c === exit.c && r === exit.r)) continue;
      const openings = DIRS.reduce((n, d) => n + (cells[r][c][d.dir] ? 1 : 0), 0);
      if (openings === 1 && dist[r][c] > 2) dead.push({ c, r, d: dist[r][c] });
    }
  }
  dead.sort((a, b) => b.d - a.d || a.r - b.r || a.c - b.c);
  const gems: GridPoint[] = [];
  const used = new Set<string>();
  for (const spot of dead) {
    if (gems.length >= 7) break;
    const key = `${spot.c},${spot.r}`;
    if (used.has(key)) continue;
    used.add(key);
    gems.push({ c: spot.c, r: spot.r });
  }
  if (gems.length < 5) {
    for (let r = 0; r < rows && gems.length < 7; r++) {
      for (let c = 0; c < cols && gems.length < 7; c++) {
        if (dist[r][c] < 3) continue;
        if ((c === exit.c && r === exit.r) || (c === 0 && r === 0)) continue;
        const key = `${c},${r}`;
        if (used.has(key)) continue;
        if (rng() > 0.45) continue;
        used.add(key);
        gems.push({ c, r });
      }
    }
  }

  let spawnYaw = 0;
  let run = -1;
  for (const d of DIRS) {
    if (!cells[0][0][d.dir]) continue;
    const len = straightRun(cells, 0, 0, d.dir);
    if (len > run) {
      run = len;
      spawnYaw = d.yaw;
    }
  }

  const exitCell = cells[exit.r][exit.c];
  let exitYaw = 0;
  let entrance = Infinity;
  for (const d of DIRS) {
    if (!exitCell[d.dir]) continue;
    const nr = exit.r + d.dr;
    const nc = exit.c + d.dc;
    if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
    const dd = dist[nr][nc];
    if (dd >= 0 && dd < entrance) {
      entrance = dd;
      // Plane local +Z should face the neighbor the player arrives from.
      if (d.dir === "s") exitYaw = 0;
      else if (d.dir === "n") exitYaw = Math.PI;
      else if (d.dir === "e") exitYaw = Math.PI / 2;
      else exitYaw = -Math.PI / 2;
    }
  }

  return { cols, rows, cells, start: { c: 0, r: 0 }, exit, gems, spawnYaw, exitYaw };
}

export function wallAabbs(maze: MazeData): Aabb[] {
  const { cols, rows, cells } = maze;
  const t = WALL_T / 2;
  const boxes: Aabb[] = [];
  const add = (x0: number, x1: number, z0: number, z1: number) => {
    boxes.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1 });
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
      if (c === 0) {
        add(-t, t, r * CELL - t, (r + 1) * CELL + t);
      }
      if (r === 0) {
        add(c * CELL - t, (c + 1) * CELL + t, -t, t);
      }
    }
  }
  return boxes;
}

export function circleHits(x: number, z: number, rad: number, boxes: Aabb[]) {
  const r2 = rad * rad;
  for (const b of boxes) {
    const cx = Math.max(b.minX, Math.min(x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < r2) return true;
  }
  return false;
}

export function resolveMove(
  x: number,
  z: number,
  dx: number,
  dz: number,
  rad: number,
  boxes: Aabb[],
  vel: { x: number; z: number },
) {
  const dist = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(dist / 0.12));
  const sx = dx / steps;
  const sz = dz / steps;
  for (let i = 0; i < steps; i++) {
    const nx = x + sx;
    if (circleHits(nx, z, rad, boxes)) vel.x = 0;
    else x = nx;
    const nz = z + sz;
    if (circleHits(x, nz, rad, boxes)) vel.z = 0;
    else z = nz;
  }
  if (circleHits(x, z, rad, boxes)) {
    const pushed = depenetrate(x, z, rad, boxes);
    x = pushed.x;
    z = pushed.z;
  }
  return { x, z };
}

function depenetrate(x: number, z: number, rad: number, boxes: Aabb[]) {
  for (let iter = 0; iter < 6 && circleHits(x, z, rad, boxes); iter++) {
    let best = Infinity;
    let px = x;
    let pz = z;
    let found = false;
    for (const b of boxes) {
      const cx = Math.max(b.minX, Math.min(x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      let dx = x - cx;
      let dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= rad * rad) continue;
      found = true;
      if (d2 < 1e-8) {
        const left = x - b.minX;
        const right = b.maxX - x;
        const north = z - b.minZ;
        const south = b.maxZ - z;
        const m = Math.min(left, right, north, south);
        const skin = rad + 0.002;
        if (m === left) return { x: b.minX - skin, z };
        if (m === right) return { x: b.maxX + skin, z };
        if (m === north) return { x, z: b.minZ - skin };
        return { x, z: b.maxZ + skin };
      }
      const d = Math.sqrt(d2);
      const push = rad - d + 0.002;
      if (push < best) {
        best = push;
        px = x + (dx / d) * push;
        pz = z + (dz / d) * push;
      }
    }
    if (!found) break;
    x = px;
    z = pz;
  }
  return { x, z };
}

/** Cells visible from (c, r) through open passages, within `reach` steps. */
export function visibleCells(maze: MazeData, c: number, r: number, reach = 4) {
  const out: GridPoint[] = [];
  const seen = new Set<string>();
  const q: { c: number; r: number; d: number }[] = [{ c, r, d: 0 }];
  seen.add(`${c},${r}`);
  let qi = 0;
  while (qi < q.length) {
    const cur = q[qi++];
    out.push({ c: cur.c, r: cur.r });
    if (cur.d >= reach) continue;
    for (const n of neighbors(maze.cells, cur.c, cur.r)) {
      const key = `${n.c},${n.r}`;
      if (seen.has(key)) continue;
      seen.add(key);
      q.push({ c: n.c, r: n.r, d: cur.d + 1 });
    }
  }
  return out;
}
