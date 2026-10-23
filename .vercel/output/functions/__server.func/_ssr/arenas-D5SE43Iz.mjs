//#region node_modules/.nitro/vite/services/ssr/assets/arenas-D5SE43Iz.js
var DIRS = [
	{
		dir: "n",
		dc: 0,
		dr: -1,
		back: "s",
		yaw: 0
	},
	{
		dir: "e",
		dc: 1,
		dr: 0,
		back: "w",
		yaw: -Math.PI / 2
	},
	{
		dir: "s",
		dc: 0,
		dr: 1,
		back: "n",
		yaw: Math.PI
	},
	{
		dir: "w",
		dc: -1,
		dr: 0,
		back: "e",
		yaw: Math.PI / 2
	}
];
function mulberry32$1(seed) {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = a + 1831565813 | 0;
		let t = Math.imul(a ^ a >>> 15, 1 | a);
		t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
function neighbors(cells, c, r) {
	const out = [];
	for (const d of DIRS) {
		if (!cells[r][c][d.dir]) continue;
		out.push({
			c: c + d.dc,
			r: r + d.dr,
			dir: d.dir
		});
	}
	return out;
}
function bfs(cells, cols, rows, sc, sr) {
	const dist = Array.from({ length: rows }, () => Array(cols).fill(-1));
	const q = [{
		c: sc,
		r: sr
	}];
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
function straightRun(cells, c, r, dir) {
	const d = DIRS.find((x) => x.dir === dir);
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
function generateMaze(seed, cols = 11, rows = 11) {
	const rng = mulberry32$1(seed);
	const cells = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({
		n: false,
		e: false,
		s: false,
		w: false
	})));
	const seen = Array.from({ length: rows }, () => Array(cols).fill(false));
	const stack = [{
		c: 0,
		r: 0
	}];
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
		stack.push({
			c: nc,
			r: nr
		});
	}
	const dist = bfs(cells, cols, rows, 0, 0);
	let exit = {
		c: cols - 1,
		r: rows - 1
	};
	let best = -1;
	for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (dist[r][c] > best) {
		best = dist[r][c];
		exit = {
			c,
			r
		};
	}
	const dead = [];
	for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
		if (c === 0 && r === 0 || c === exit.c && r === exit.r) continue;
		if (DIRS.reduce((n, d) => n + (cells[r][c][d.dir] ? 1 : 0), 0) === 1 && dist[r][c] > 2) dead.push({
			c,
			r,
			d: dist[r][c]
		});
	}
	dead.sort((a, b) => b.d - a.d || a.r - b.r || a.c - b.c);
	const gems = [];
	const used = /* @__PURE__ */ new Set();
	for (const spot of dead) {
		if (gems.length >= 7) break;
		const key = `${spot.c},${spot.r}`;
		if (used.has(key)) continue;
		used.add(key);
		gems.push({
			c: spot.c,
			r: spot.r
		});
	}
	if (gems.length < 5) for (let r = 0; r < rows && gems.length < 7; r++) for (let c = 0; c < cols && gems.length < 7; c++) {
		if (dist[r][c] < 3) continue;
		if (c === exit.c && r === exit.r || c === 0 && r === 0) continue;
		const key = `${c},${r}`;
		if (used.has(key)) continue;
		if (rng() > .45) continue;
		used.add(key);
		gems.push({
			c,
			r
		});
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
			if (d.dir === "s") exitYaw = 0;
			else if (d.dir === "n") exitYaw = Math.PI;
			else if (d.dir === "e") exitYaw = Math.PI / 2;
			else exitYaw = -Math.PI / 2;
		}
	}
	return {
		cols,
		rows,
		cells,
		start: {
			c: 0,
			r: 0
		},
		exit,
		gems,
		spawnYaw,
		exitYaw
	};
}
var CELL = 4.6;
var THICK = .55;
var WALL_H = 5.8;
function mulberry32(seed) {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = a + 1831565813 | 0;
		let t = Math.imul(a ^ a >>> 15, 1 | a);
		t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
function center(c, r) {
	return {
		x: (c + .5) * CELL,
		z: (r + .5) * CELL
	};
}
function openings(cell) {
	return Number(cell.n) + Number(cell.e) + Number(cell.s) + Number(cell.w);
}
function wallBoxes(maze) {
	const { cols, rows, cells } = maze;
	const t = THICK / 2;
	const boxes = [];
	const add = (x0, x1, z0, z1) => {
		boxes.push({
			minX: x0,
			maxX: x1,
			minY: 0,
			maxY: WALL_H,
			minZ: z0,
			maxZ: z1
		});
	};
	for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
		if (!cells[r][c].e) {
			const x = (c + 1) * CELL;
			add(x - t, x + t, r * CELL - t, (r + 1) * CELL + t);
		}
		if (!cells[r][c].s) {
			const z = (r + 1) * CELL;
			add(c * CELL - t, (c + 1) * CELL + t, z - t, z + t);
		}
		if (c === 0) add(-.275, t, r * CELL - t, (r + 1) * CELL + t);
		if (r === 0) add(c * CELL - t, (c + 1) * CELL + t, -.275, t);
	}
	return boxes;
}
var THEMES = [
	{
		id: "grass",
		name: "Hedge",
		line: "Tall hedges, pumpkins along the paths.",
		seed: 11031,
		cols: 15,
		rows: 15,
		sky: 3811896,
		fog: 4863020,
		floor: 5925442,
		wall: 2902580,
		trim: 14711336,
		cover: 12868120,
		sun: 16756839
	},
	{
		id: "brick",
		name: "Brick",
		line: "A high brick labyrinth. Barricades stop bullets.",
		seed: 22047,
		cols: 17,
		rows: 15,
		sky: 3811364,
		fog: 4861992,
		floor: 6968132,
		wall: 8011828,
		trim: 14715456,
		cover: 11033128,
		sun: 16760976
	},
	{
		id: "palace",
		name: "Stone",
		line: "A long stone maze. Hide behind the barricades.",
		seed: 33019,
		cols: 15,
		rows: 17,
		sky: 2893880,
		fog: 3814980,
		floor: 7235700,
		wall: 9077910,
		trim: 14066010,
		cover: 6969416,
		sun: 16769200
	}
];
function makeArena(theme) {
	const maze = generateMaze(theme.seed, theme.cols, theme.rows);
	const rng = mulberry32(theme.seed ^ 2654435769);
	const walls = wallBoxes(maze);
	const start = center(maze.start.c, maze.start.r);
	const dist = bfs(maze.cells, theme.cols, theme.rows, maze.start.c, maze.start.r);
	const nearSpots = [];
	const midSpots = [];
	const farSpots = [];
	for (let r = 0; r < theme.rows; r++) for (let c = 0; c < theme.cols; c++) {
		const d = dist[r][c];
		if (d <= 2) continue;
		if (d >= 3 && d <= 5) nearSpots.push({
			c,
			r
		});
		else if (d >= 6 && d <= 11) midSpots.push({
			c,
			r
		});
		else if (d >= 12) farSpots.push({
			c,
			r
		});
	}
	const shuffle = (arr) => {
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
	const foeKeys = /* @__PURE__ */ new Set();
	const foes = [];
	const addFoe = (spot) => {
		const key = `${spot.c},${spot.r}`;
		if (foeKeys.has(key)) return false;
		foeKeys.add(key);
		foes.push(center(spot.c, spot.r));
		return true;
	};
	for (const s of nearSpots) {
		if (foes.length >= 2) break;
		addFoe(s);
	}
	const keySpots = [maze.exit, ...maze.gems];
	shuffle(keySpots);
	for (const s of keySpots) {
		if (foes.length >= Math.floor(targetFoes * .6)) break;
		addFoe(s);
	}
	for (const s of midSpots) {
		if (foes.length >= targetFoes) break;
		addFoe(s);
	}
	for (const s of [...farSpots, ...nearSpots]) {
		if (foes.length >= targetFoes) break;
		addFoe(s);
	}
	const shields = [];
	const boxes = walls.slice();
	for (let r = 0; r < maze.rows; r++) for (let c = 0; c < maze.cols; c++) {
		if (c === 0 && r === 0) continue;
		if (foeKeys.has(`${c},${r}`)) continue;
		const cell = maze.cells[r][c];
		if (openings(cell) < 2 || rng() > .22) continue;
		const at = center(c, r);
		const w = 1.35;
		const d = .7;
		const h = 1.9;
		let x = at.x;
		let z = at.z;
		if (cell.n && cell.s && !cell.e) x = (c + 1) * CELL - THICK / 2 - w / 2 - .05;
		else if (cell.n && cell.s && !cell.w) x = c * CELL + THICK / 2 + w / 2 + .05;
		else if (!cell.n) z = r * CELL + THICK / 2 + d / 2 + .05;
		else z = (r + 1) * CELL - THICK / 2 - d / 2 - .05;
		const shield = {
			x,
			z,
			w: cell.e || cell.w ? d : w,
			d: cell.e || cell.w ? w : d,
			h
		};
		if (Math.hypot(shield.x - start.x, shield.z - start.z) < 2.4) continue;
		shields.push(shield);
		boxes.push({
			minX: shield.x - shield.w / 2,
			maxX: shield.x + shield.w / 2,
			minY: 0,
			maxY: shield.h,
			minZ: shield.z - shield.d / 2,
			maxZ: shield.z + shield.d / 2
		});
	}
	const pumpkins = [];
	for (let r = 0; r < maze.rows; r++) for (let c = 0; c < maze.cols; c++) {
		const count = 1 + (rng() > .45 ? 1 : 0) + (rng() > .82 ? 1 : 0);
		for (let n = 0; n < count; n++) {
			const at = center(c, r);
			const edge = CELL * .36;
			const x = at.x + (rng() * 2 - 1) * edge;
			const z = at.z + (rng() * 2 - 1) * edge;
			if (Math.hypot(x - start.x, z - start.z) < 1.3) continue;
			if (shields.some((s) => Math.abs(x - s.x) < s.w * .7 && Math.abs(z - s.z) < s.d * .7)) continue;
			pumpkins.push({
				x,
				z,
				s: .72 + rng() * .55
			});
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
		floorX: theme.cols * CELL / 2,
		floorZ: theme.rows * CELL / 2,
		spawn: {
			x: start.x,
			z: start.z,
			yaw: maze.spawnYaw
		},
		boxes,
		walls,
		shields,
		pumpkins,
		foes,
		maze
	};
}
var ARENAS = THEMES.map(makeArena);
function findArena(id) {
	return ARENAS.find((arena) => arena.id === id) ?? ARENAS[0];
}
function arenaBoxes(arena) {
	return arena.boxes;
}
function circleHits(x, z, rad, boxes) {
	for (const b of boxes) {
		if (b.maxY < .4) continue;
		const cx = Math.max(b.minX, Math.min(x, b.maxX));
		const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
		const dx = x - cx;
		const dz = z - cz;
		if (dx * dx + dz * dz < rad * rad) return true;
	}
	return false;
}
function resolveMove(x, z, dx, dz, rad, boxes) {
	const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .15));
	const sx = dx / steps;
	const sz = dz / steps;
	for (let i = 0; i < steps; i++) {
		if (!circleHits(x + sx, z, rad, boxes)) x += sx;
		if (!circleHits(x, z + sz, rad, boxes)) z += sz;
	}
	return {
		x,
		z
	};
}
function rayBoxes(ox, oy, oz, dx, dy, dz, maxDist, boxes) {
	let best = maxDist;
	for (const b of boxes) {
		let tmin = 0;
		let tmax = best;
		const slabs = [
			[
				ox,
				dx,
				b.minX,
				b.maxX
			],
			[
				oy,
				dy,
				b.minY,
				b.maxY
			],
			[
				oz,
				dz,
				b.minZ,
				b.maxZ
			]
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
		if (!miss && tmin > .05 && tmin < best) best = tmin;
	}
	return best;
}
//#endregion
export { resolveMove as a, rayBoxes as i, arenaBoxes as n, findArena as r, ARENAS as t };
