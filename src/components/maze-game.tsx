import { useEffect, useRef, useState, type RefObject } from "react";
import { Gem, Ghost, Pause, Timer } from "lucide-react";
import * as THREE from "three";
import {
  CELL,
  PLAYER_RADIUS,
  cellCenter,
  circleHits,
  generateMaze,
  resolveMove,
  visibleCells,
  wallAabbs,
  worldToCell,
  type Aabb,
  type MazeData,
} from "@/game/maze";
import { findScene, SCENES, type SceneId } from "@/game/scenes";
import { createSfx } from "@/game/sfx";

type Phase = "menu" | "play" | "paused" | "won" | "lost";

type Hud = {
  time: number;
  gems: number;
  total: number;
  haunts: number;
  best: number | null;
  freshBest: boolean;
  ready: boolean;
};

const BEST_KEY = "paper-hollow-best";
const EYE = 1.58;
const WALK = 3.9;
const SPRINT = 6.4;
const LOOK_SENS = 0.0042;
const ROUND_TIME = 90;
const GEM_TIME = 10;
const HIT_TIME = 16;

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getPos: () => { x: number; y: number; z: number };
      setKeys: (codes: string[]) => void;
      isInsideWall: () => boolean;
    };
  }
}

function formatTime(s: number) {
  const safe = Math.max(0, s);
  const m = Math.floor(safe / 60);
  const sec = safe - m * 60;
  const whole = Math.floor(sec);
  const frac = Math.floor((sec - whole) * 10);
  return `${m}:${whole.toString().padStart(2, "0")}.${frac}`;
}

function readBest() {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeBest(n: number) {
  try {
    localStorage.setItem(BEST_KEY, String(n));
  } catch {
    /* private mode */
  }
}

export function MazeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const stickRef = useRef({ x: 0, y: 0 });
  const knobRef = useRef<HTMLDivElement>(null);
  const api = useRef({
    enter: () => {},
    resume: () => {},
    pause: () => {},
    again: () => {},
    menu: () => {},
    swing: () => {},
    setScene: (_id: SceneId) => {},
  });
  const wantEnter = useRef(false);

  const [phase, setPhase] = useState<Phase>("menu");
  const [sceneId, setSceneId] = useState<SceneId>("grass");
  const [hurt, setHurt] = useState(false);
  const [hud, setHud] = useState<Hud>({
    time: ROUND_TIME,
    gems: 0,
    total: 7,
    haunts: 6,
    best: null,
    freshBest: false,
    ready: false,
  });
  const [lookHint, setLookHint] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    const miniEl = miniRef.current;
    if (!canvasEl || !miniEl) return;
    const canvas: HTMLCanvasElement = canvasEl;
    const mini: HTMLCanvasElement = miniEl;

    let dead = false;
    const sfx = createSfx();
    const held = new Set<string>();
    const phaseRef = { current: "menu" as Phase };
    const bestRef = { current: readBest() };
    const stick = stickRef.current;

    const setPhaseBoth = (p: Phase) => {
      phaseRef.current = p;
      if (!dead) setPhase(p);
    };

    const renderer = (() => {
      try {
        return new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
      } catch (err) {
        if (!dead) {
          setBootError(err instanceof Error ? err.message : "The maze could not start.");
        }
        return null;
      }
    })();
    if (!renderer) {
      sfx.dispose();
      return;
    }
    const gl = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x070b09, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b09);
    scene.fog = new THREE.Fog(0x0b120e, 2.2, 13);

    const camera = new THREE.PerspectiveCamera(75, 1, 0.08, 80);
    camera.rotation.order = "YXZ";
    scene.add(camera);

    const hemi = new THREE.HemisphereLight(0x24362c, 0x0c100c, 0.32);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0x9eb896, 0.08);
    sun.position.set(-8, 14, 6);
    scene.add(sun);
    const lantern = new THREE.PointLight(0xffb15a, 36, 11, 2);
    lantern.position.set(0.2, 1.35, 0.2);
    scene.add(lantern);

    const sword = new THREE.Group();
    const bladeMat = new THREE.MeshLambertMaterial({
      color: 0xd7dde4,
      emissive: 0x8e99a6,
      emissiveIntensity: 0.35,
    });
    const guardMat = new THREE.MeshLambertMaterial({ color: 0xc6a15a, emissive: 0x6a4a16, emissiveIntensity: 0.3 });
    const gripMat = new THREE.MeshLambertMaterial({ color: 0x3a2418 });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.72, 0.018), bladeMat);
    blade.position.y = 0.46;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.045, 0.05), guardMat);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.22, 0.045), gripMat);
    grip.position.y = -0.12;
    sword.add(blade, guard, grip);
    sword.position.set(0.36, -0.34, -0.58);
    sword.rotation.set(0.3, 0.15, -0.55);
    camera.add(sword);

    const world = new THREE.Group();
    scene.add(world);

    const clay = new THREE.MeshLambertMaterial({ color: 0xb08968 });
    const sage = new THREE.MeshLambertMaterial({ color: 0x8aa892 });
    const capMat = new THREE.MeshLambertMaterial({ color: 0xf3ecdf });
    const floorA = new THREE.MeshLambertMaterial({ color: 0xefe4d2 });
    const floorB = new THREE.MeshLambertMaterial({ color: 0xe4d5be });
    const groundMat = new THREE.MeshLambertMaterial({ color: 0xcfd8d2 });
    const stoneMat = new THREE.MeshLambertMaterial({
      color: 0xffc56a,
      emissive: 0xff8a1a,
      emissiveIntensity: 0.85,
    });
    const discMat = new THREE.MeshBasicMaterial({
      color: 0xff8a1a,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const postMat = new THREE.MeshLambertMaterial({ color: 0xf4f1ea });
    const lintelMat = new THREE.MeshLambertMaterial({ color: 0x8aa4b0 });
    const veilMat = new THREE.MeshBasicMaterial({
      color: 0xc5dbe3,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const sheetMat = new THREE.MeshLambertMaterial({
      color: 0xf4f1ea,
      emissive: 0xb7b2a8,
      emissiveIntensity: 0.65,
    });
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0x16120f });
    const goblinMat = new THREE.MeshLambertMaterial({
      color: 0x3d7a3a,
      emissive: 0x163016,
      emissiveIntensity: 0.4,
    });
    const pumpkinMat = new THREE.MeshLambertMaterial({
      color: 0xe25a12,
      emissive: 0xff5a00,
      emissiveIntensity: 0.35,
    });
    const stemMat = new THREE.MeshLambertMaterial({ color: 0x23401c });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x101610 });

    const materials = [
      clay,
      sage,
      capMat,
      floorA,
      floorB,
      groundMat,
      stoneMat,
      discMat,
      postMat,
      lintelMat,
      veilMat,
      sheetMat,
      eyeMat,
      goblinMat,
      pumpkinMat,
      stemMat,
      roofMat,
      bladeMat,
      guardMat,
      gripMat,
    ];
    const geometries = new Set<THREE.BufferGeometry>();
    const remember = (g: THREE.BufferGeometry) => {
      geometries.add(g);
      return g;
    };

    let maze: MazeData = generateMaze((Math.random() * 0x7fffffff) >>> 0);
    let boxes: Aabb[] = [];
    let gems: { c: number; r: number; mesh: THREE.Object3D; taken: boolean }[] = [];
    const explored = new Set<string>();
    let px = 0;
    let pz = 0;
    let yaw = 0;
    let pitch = 0;
    const vel = { x: 0, z: 0 };
    let elapsed = 0;
    let timeLeft = ROUND_TIME;
    let bobT = 0;
    let prevBob = 0;
    let freshBest = false;
    let gemCount = 0;
    let spawnYaw = 0;
    let iframe = 0;
    let booShake = 0;
    let hurtUntil = 0;
    let swing = 0;
    let swingHit = false;
    let moanAt = 0;
    let pathTick = 0;
    let playerDist: number[][] = [];
    const scenePick = { current: "grass" as SceneId };
    type Haunt = {
      kind: "ghost" | "goblin";
      mesh: THREE.Group;
      x: number;
      z: number;
      goalC: number;
      goalR: number;
      alive: boolean;
    };
    let haunts: Haunt[] = [];

    const openNeighbors = (c: number, r: number) => {
      const cell = maze.cells[r][c];
      const steps = [
        { dir: "n" as const, c, r: r - 1 },
        { dir: "e" as const, c: c + 1, r },
        { dir: "s" as const, c, r: r + 1 },
        { dir: "w" as const, c: c - 1, r },
      ];
      return steps.filter((s) => cell[s.dir] && s.c >= 0 && s.r >= 0 && s.c < maze.cols && s.r < maze.rows);
    };

    function gridDist(sc: number, sr: number) {
      const dist = Array.from({ length: maze.rows }, () => Array<number>(maze.cols).fill(-1));
      const q = [{ c: sc, r: sr }];
      dist[sr][sc] = 0;
      for (let i = 0; i < q.length; i++) {
        const cur = q[i];
        for (const n of openNeighbors(cur.c, cur.r)) {
          if (dist[n.r][n.c] >= 0) continue;
          dist[n.r][n.c] = dist[cur.r][cur.c] + 1;
          q.push(n);
        }
      }
      return dist;
    }

    function applyTheme(id: SceneId) {
      const theme = findScene(id);
      const fog = scene.fog as THREE.Fog;
      fog.color.setHex(theme.fog);
      fog.near = 3.2;
      fog.far = 16;
      (scene.background as THREE.Color).setHex(theme.background);
      gl.setClearColor(theme.background, 1);
      hemi.color.setHex(theme.hemiSky);
      hemi.groundColor.setHex(theme.hemiGround);
      hemi.intensity = theme.hemi;
      sun.color.setHex(theme.sun);
      sun.intensity = theme.sunLevel;
      lantern.color.setHex(theme.lantern);
      clay.color.setHex(theme.wallA);
      sage.color.setHex(theme.wallB);
      capMat.color.setHex(theme.cap);
      floorA.color.setHex(theme.floorA);
      floorB.color.setHex(theme.floorB);
      groundMat.color.setHex(theme.ground);
      roofMat.color.setHex(theme.roof);
      veilMat.color.setHex(theme.veil);
      postMat.color.setHex(0xf4f1ea);
      lintelMat.color.setHex(theme.cap);
    }

    const ground = new THREE.Mesh(remember(new THREE.PlaneGeometry(80, 80)), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.12;
    scene.add(ground);

    let lastPush = 0;
    function pushHud(force = false) {
      if (dead) return;
      const now = performance.now();
      if (!force && now - lastPush < 100) return;
      lastPush = now;
      setHud({
        time: timeLeft,
        gems: gemCount,
        total: maze.gems.length,
        haunts: haunts.filter((h) => h.alive).length,
        best: bestRef.current,
        freshBest,
        ready: true,
      });
    }

    function revealAround(c: number, r: number) {
      let added = false;
      for (const cell of visibleCells(maze, c, r, 4)) {
        const key = `${cell.c},${cell.r}`;
        if (!explored.has(key)) {
          explored.add(key);
          added = true;
        }
      }
      if (added) pushHud(true);
    }

    function clearWorld() {
      for (const child of [...world.children]) {
        world.remove(child);
      }
      for (const g of geometries) {
        if (g !== ground.geometry) g.dispose();
      }
      geometries.clear();
      geometries.add(ground.geometry);
    }

    function build(seed?: number) {
      clearWorld();
      maze = generateMaze(seed ?? ((Math.random() * 0x7fffffff) >>> 0));
      boxes = wallAabbs(maze);
      gems = [];
      haunts = [];
      explored.clear();
      gemCount = 0;
      freshBest = false;
      elapsed = 0;
      timeLeft = ROUND_TIME;
      iframe = 0;
      booShake = 0;
      swing = 0;
      swingHit = false;
      vel.x = 0;
      vel.z = 0;
      bobT = 0;
      pitch = 0;
      applyTheme(scenePick.current);
      const start = cellCenter(maze.start.c, maze.start.r);
      px = start.x;
      pz = start.z;
      spawnYaw = maze.spawnYaw;
      yaw = spawnYaw;
      revealAround(maze.start.c, maze.start.r);

      const wallSpots: { x: number; y: number; z: number; sx: number; sy: number; sz: number; sage: boolean }[] = [];
      const t = 0.32;
      const pushWall = (x: number, z: number, sx: number, sz: number, sageWall: boolean) => {
        const h = 2.35;
        wallSpots.push({ x, y: h / 2, z, sx, sy: h, sz, sage: sageWall });
      };
      for (let r = 0; r < maze.rows; r++) {
        for (let c = 0; c < maze.cols; c++) {
          const sageWall = (c * 3 + r) % 5 === 0;
          if (!maze.cells[r][c].e) {
            pushWall((c + 1) * CELL, (r + 0.5) * CELL, t, CELL + t, sageWall);
          }
          if (!maze.cells[r][c].s) {
            pushWall((c + 0.5) * CELL, (r + 1) * CELL, CELL + t, t, sageWall);
          }
          if (c === 0) {
            pushWall(0, (r + 0.5) * CELL, t, CELL + t, sageWall);
          }
          if (r === 0) {
            pushWall((c + 0.5) * CELL, 0, CELL + t, t, sageWall);
          }
        }
      }

      const clayWalls = wallSpots.filter((w) => !w.sage);
      const sageWalls = wallSpots.filter((w) => w.sage);
      const box = remember(new THREE.BoxGeometry(1, 1, 1));

      const paint = (list: typeof wallSpots, mat: THREE.Material) => {
        if (!list.length) return;
        const mesh = new THREE.InstancedMesh(box, mat, list.length);
        const dummy = new THREE.Object3D();
        list.forEach((w, i) => {
          dummy.position.set(w.x, w.y, w.z);
          dummy.scale.set(w.sx, w.sy, w.sz);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        world.add(mesh);
        const caps = new THREE.InstancedMesh(box, capMat, list.length);
        list.forEach((w, i) => {
          dummy.position.set(w.x, w.sy + 0.07, w.z);
          dummy.scale.set(w.sx + 0.08, 0.14, w.sz + 0.08);
          dummy.updateMatrix();
          caps.setMatrixAt(i, dummy.matrix);
        });
        caps.instanceMatrix.needsUpdate = true;
        world.add(caps);
      };
      paint(clayWalls, clay);
      paint(sageWalls, sage);

      const tilesA: number[] = [];
      const tilesB: number[] = [];
      for (let r = 0; r < maze.rows; r++) {
        for (let c = 0; c < maze.cols; c++) {
          ((c + r) % 2 === 0 ? tilesA : tilesB).push(c, r);
        }
      }
      const tileGeo = remember(new THREE.BoxGeometry(CELL * 0.96, 0.12, CELL * 0.96));
      const layTiles = (list: number[], mat: THREE.Material) => {
        const n = list.length / 2;
        if (!n) return;
        const mesh = new THREE.InstancedMesh(tileGeo, mat, n);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < n; i++) {
          const c = list[i * 2];
          const r = list[i * 2 + 1];
          dummy.position.set((c + 0.5) * CELL, -0.06, (r + 0.5) * CELL);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        world.add(mesh);
      };
      layTiles(tilesA, floorA);
      layTiles(tilesB, floorB);

      const gemGeo = remember(new THREE.OctahedronGeometry(0.22, 0));
      const discGeo = remember(new THREE.CircleGeometry(0.28, 6));
      maze.gems.forEach((g, i) => {
        const at = cellCenter(g.c, g.r);
        const group = new THREE.Group();
        const stone = new THREE.Mesh(gemGeo, stoneMat);
        stone.position.y = 0.62;
        const disc = new THREE.Mesh(discGeo, discMat);
        disc.rotation.x = -Math.PI / 2;
        disc.position.y = 0.02;
        group.add(stone, disc);
        group.position.set(at.x, 0, at.z);
        group.userData.phase = i * 0.7;
        world.add(group);
        gems.push({ c: g.c, r: g.r, mesh: group, taken: false });
      });

      const exitAt = cellCenter(maze.exit.c, maze.exit.r);
      const gate = new THREE.Group();
      const postGeo = remember(new THREE.BoxGeometry(0.22, 2.15, 0.22));
      const left = new THREE.Mesh(postGeo, postMat);
      left.position.set(-0.62, 1.075, 0);
      const right = new THREE.Mesh(postGeo, postMat);
      right.position.set(0.62, 1.075, 0);
      const lintel = new THREE.Mesh(remember(new THREE.BoxGeometry(1.52, 0.16, 0.28)), lintelMat);
      lintel.position.y = 2.18;
      const veil = new THREE.Mesh(remember(new THREE.PlaneGeometry(1.12, 1.9)), veilMat);
      veil.position.y = 1.12;
      veil.name = "veil";
      const lamp = new THREE.PointLight(0xff6a1a, 10, 8, 2);
      lamp.position.set(0, 1.4, 0);
      gate.add(left, right, lintel, veil, lamp);
      gate.position.set(exitAt.x, 0, exitAt.z);
      gate.rotation.y = maze.exitYaw;
      world.add(gate);

      const roof = new THREE.InstancedMesh(box, roofMat, maze.cols * maze.rows);
      const roofDummy = new THREE.Object3D();
      let roofIndex = 0;
      for (let r = 0; r < maze.rows; r++) {
        for (let c = 0; c < maze.cols; c++) {
          roofDummy.position.set((c + 0.5) * CELL, 2.62, (r + 0.5) * CELL);
          roofDummy.scale.set(CELL + 0.4, 0.22, CELL + 0.4);
          roofDummy.updateMatrix();
          roof.setMatrixAt(roofIndex, roofDummy.matrix);
          roofIndex += 1;
        }
      }
      roof.instanceMatrix.needsUpdate = true;
      world.add(roof);

      const fromStart = gridDist(maze.start.c, maze.start.r);
      const gemKeys = new Set(maze.gems.map((g) => `${g.c},${g.r}`));
      const farCells: { c: number; r: number }[] = [];
      for (let r = 0; r < maze.rows; r++) {
        for (let c = 0; c < maze.cols; c++) {
          if (fromStart[r][c] < 5) continue;
          if (c === maze.exit.c && r === maze.exit.r) continue;
          if (gemKeys.has(`${c},${r}`)) continue;
          farCells.push({ c, r });
        }
      }
      for (let i = farCells.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        const swap = farCells[i];
        farCells[i] = farCells[j];
        farCells[j] = swap;
      }

      const pumpkinGeo = remember(new THREE.SphereGeometry(0.28, 7, 6));
      const stemGeo = remember(new THREE.CylinderGeometry(0.04, 0.05, 0.16, 5));
      const faceGeo = remember(new THREE.SphereGeometry(0.06, 5, 4));
      for (let i = 0; i < Math.min(4, farCells.length); i++) {
        const spot = farCells[i];
        const at = cellCenter(spot.c, spot.r);
        const pumpkin = new THREE.Group();
        const body = new THREE.Mesh(pumpkinGeo, pumpkinMat);
        body.scale.set(1.15, 0.9, 1.15);
        body.position.y = 0.28;
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.position.y = 0.52;
        const eyeL = new THREE.Mesh(faceGeo, eyeMat);
        const eyeR = new THREE.Mesh(faceGeo, eyeMat);
        const smile = new THREE.Mesh(faceGeo, eyeMat);
        eyeL.position.set(-0.1, 0.32, 0.22);
        eyeR.position.set(0.1, 0.32, 0.22);
        smile.position.set(0, 0.18, 0.24);
        smile.scale.set(1.4, 0.7, 0.6);
        const glow = new THREE.PointLight(0xff6a18, 8, 6.5, 2);
        glow.position.y = 0.4;
        pumpkin.add(body, stem, eyeL, eyeR, smile, glow);
        pumpkin.position.set(at.x, 0, at.z + 0.7);
        world.add(pumpkin);
      }

      const bodyGeo = remember(new THREE.SphereGeometry(0.48, 8, 6));
      const lobeGeo = remember(new THREE.SphereGeometry(0.2, 6, 5));
      const eyeGeo = remember(new THREE.SphereGeometry(0.09, 6, 5));
      const mouthGeo = remember(new THREE.SphereGeometry(0.07, 6, 5));
      const goblinBody = remember(new THREE.SphereGeometry(0.28, 6, 5));
      const goblinHead = remember(new THREE.SphereGeometry(0.2, 6, 5));
      const earGeo = remember(new THREE.ConeGeometry(0.07, 0.22, 4));

      const makeGhost = () => {
        const group = new THREE.Group();
        const body = new THREE.Mesh(bodyGeo, sheetMat);
        body.scale.set(1.05, 1.28, 0.92);
        body.position.y = 1.02;
        for (let i = 0; i < 3; i++) {
          const lobe = new THREE.Mesh(lobeGeo, sheetMat);
          lobe.position.set((i - 1) * 0.28, 0.42, 0);
          lobe.scale.set(1, 1.25, 0.85);
          group.add(lobe);
        }
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        const mouth = new THREE.Mesh(mouthGeo, eyeMat);
        eyeL.scale.set(0.7, 1.7, 0.45);
        eyeR.scale.set(0.7, 1.7, 0.45);
        mouth.scale.set(1.15, 1.35, 0.4);
        eyeL.position.set(-0.16, 1.12, -0.36);
        eyeR.position.set(0.16, 1.12, -0.36);
        mouth.position.set(0, 0.78, -0.38);
        group.add(body, eyeL, eyeR, mouth);
        return group;
      };

      const makeGoblin = () => {
        const group = new THREE.Group();
        const body = new THREE.Mesh(goblinBody, goblinMat);
        body.scale.set(1, 1.25, 0.8);
        body.position.y = 0.48;
        const head = new THREE.Mesh(goblinHead, goblinMat);
        head.position.y = 0.98;
        const earL = new THREE.Mesh(earGeo, goblinMat);
        const earR = new THREE.Mesh(earGeo, goblinMat);
        earL.position.set(-0.2, 1.12, 0);
        earR.position.set(0.2, 1.12, 0);
        earL.rotation.z = 0.5;
        earR.rotation.z = -0.5;
        const eyeL = new THREE.Mesh(eyeGeo, guardMat);
        const eyeR = new THREE.Mesh(eyeGeo, guardMat);
        eyeL.position.set(-0.07, 1.02, -0.14);
        eyeR.position.set(0.07, 1.02, -0.14);
        eyeL.scale.set(0.7, 0.7, 0.5);
        eyeR.scale.set(0.7, 0.7, 0.5);
        group.add(body, head, earL, earR, eyeL, eyeR);
        return group;
      };

      const hauntSpots = farCells.slice(4, 10);
      while (hauntSpots.length < 6) {
        hauntSpots.push({
          c: 1 + (hauntSpots.length % Math.max(1, maze.cols - 2)),
          r: maze.rows - 1,
        });
      }
      hauntSpots.slice(0, 6).forEach((spot, i) => {
        const at = cellCenter(spot.c, spot.r);
        const kind = i < 4 ? "ghost" : "goblin";
        const mesh = kind === "ghost" ? makeGhost() : makeGoblin();
        mesh.position.set(at.x, 0, at.z);
        world.add(mesh);
        haunts.push({ kind, mesh, x: at.x, z: at.z, goalC: spot.c, goalR: spot.r, alive: true });
      });

      pushHud(true);
    }

    function resize() {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      gl.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    }

    function tryLock() {
      const coarse = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 860;
      if (coarse) return;
      try {
        canvas.requestPointerLock();
      } catch {
        /* the maze still plays without a locked pointer */
      }
    }

    function enter() {
      if (dead) return;
      try {
        sfx.unlock();
      } catch {
        /* audio is optional */
      }
      if (phaseRef.current === "won" || phaseRef.current === "lost") return;
      tryLock();
      setPhaseBoth("play");
      pushHud(true);
    }

    function pause() {
      if (phaseRef.current !== "play") return;
      setPhaseBoth("paused");
      try {
        document.exitPointerLock();
      } catch {
        /* ignore */
      }
    }

    function again() {
      sfx.unlock();
      build();
      if (!dead) setLookHint(true);
      tryLock();
      setPhaseBoth("play");
    }

    function menu() {
      build();
      setPhaseBoth("menu");
      try {
        document.exitPointerLock();
      } catch {
        /* ignore */
      }
    }

    function swingSword() {
      if (dead || phaseRef.current !== "play") return;
      if (swing > 0) return;
      swing = 0.001;
      swingHit = false;
      sfx.slash();
    }

    function setScene(id: SceneId) {
      scenePick.current = id;
      if (!dead) setSceneId(id);
      if (phaseRef.current === "menu") build();
    }

    api.current = { enter, resume: enter, pause, again, menu, swing: swingSword, setScene };

    function drawMini() {
      const css = mini.clientWidth || 148;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const size = Math.round(css * dpr);
      if (mini.width !== size) {
        mini.width = size;
        mini.height = size;
      }
      const ctx = mini.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, css, css);
      const pad = 8;
      const inner = css - pad * 2;
      const cw = inner / maze.cols;
      const ch = inner / maze.rows;
      ctx.fillStyle = "#2a2118";
      ctx.strokeStyle = "#e6d3b0";
      ctx.lineWidth = 1.5;
      for (let r = 0; r < maze.rows; r++) {
        for (let c = 0; c < maze.cols; c++) {
          if (!explored.has(`${c},${r}`)) continue;
          const x = pad + c * cw;
          const y = pad + r * ch;
          ctx.fillRect(x, y, cw, ch);
          const cell = maze.cells[r][c];
          ctx.beginPath();
          if (!cell.n) {
            ctx.moveTo(x, y);
            ctx.lineTo(x + cw, y);
          }
          if (!cell.e) {
            ctx.moveTo(x + cw, y);
            ctx.lineTo(x + cw, y + ch);
          }
          if (!cell.s) {
            ctx.moveTo(x, y + ch);
            ctx.lineTo(x + cw, y + ch);
          }
          if (!cell.w) {
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + ch);
          }
          ctx.stroke();
        }
      }
      ctx.fillStyle = "#ffb15a";
      for (const g of gems) {
        if (g.taken || !explored.has(`${g.c},${g.r}`)) continue;
        const at = cellCenter(g.c, g.r);
        ctx.beginPath();
        ctx.arc(pad + (at.x / CELL) * cw, pad + (at.z / CELL) * ch, Math.max(2.5, cw * 0.12), 0, Math.PI * 2);
        ctx.fill();
      }
      const ppx = pad + (px / CELL) * cw;
      const ppy = pad + (pz / CELL) * ch;
      ctx.save();
      ctx.translate(ppx, ppy);
      ctx.rotate(-yaw);
      ctx.fillStyle = "#f3f1ec";
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(4.5, 5);
      ctx.lineTo(-4.5, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      held.add(e.code);
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
      if (e.code === "Escape") pause();
      if (e.code === "KeyF" && phaseRef.current === "play") swingSword();
      if ((e.code === "Enter" || e.code === "Space") && (phaseRef.current === "menu" || phaseRef.current === "paused")) {
        enter();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      held.delete(e.code);
    };
    const onBlur = () => {
      held.clear();
      stick.x = 0;
      stick.y = 0;
    };
    const onMouse = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      if (phaseRef.current !== "play") return;
      yaw -= e.movementX * LOOK_SENS;
      pitch -= e.movementY * LOOK_SENS;
      pitch = Math.max(-1.35, Math.min(1.35, pitch));
    };
    let sawLock = false;
    const onLock = () => {
      const locked = document.pointerLockElement === canvas;
      if (locked) sawLock = true;
      else if (sawLock && phaseRef.current === "play") {
        sawLock = false;
        setPhaseBoth("paused");
      }
    };

    let lookId: number | null = null;
    let lookX = 0;
    let lookY = 0;
    let edge = 0;
    let lookTravel = 0;
    const onPointerDown = (e: PointerEvent) => {
      if (phaseRef.current !== "play") return;
      if (document.pointerLockElement === canvas) return;
      lookId = e.pointerId;
      lookX = e.clientX;
      lookY = e.clientY;
      edge = 0;
      lookTravel = 0;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* drag still works inside the canvas */
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== lookId || phaseRef.current !== "play") return;
      const dx = e.clientX - lookX;
      const dy = e.clientY - lookY;
      lookX = e.clientX;
      lookY = e.clientY;
      lookTravel += Math.hypot(dx, dy);
      const sens = e.pointerType === "mouse" ? 0.006 : 0.015;
      if (dx * dx + dy * dy > 4 && !dead) setLookHint(false);
      yaw -= dx * sens;
      pitch -= dy * sens * 0.8;
      pitch = Math.max(-1.15, Math.min(1.15, pitch));
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const margin = Math.min(120, rect.width * 0.24);
      if (x >= rect.width - margin) edge = (x - (rect.width - margin)) / margin;
      else if (x <= margin) edge = -((margin - x) / margin);
      else edge = 0;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== lookId) return;
      const tap = lookTravel < 18;
      lookId = null;
      edge = 0;
      if (tap) swingSword();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (document.pointerLockElement === canvas) swingSword();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("resize", resize);
    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas);
    document.addEventListener("mousemove", onMouse);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("pointerlockchange", onLock);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    const blockTouch = (e: TouchEvent) => {
      if (phaseRef.current === "play") e.preventDefault();
    };
    canvas.parentElement?.addEventListener("touchmove", blockTouch, { passive: false });

    build();
    resize();
    window.__controlsTest = {
      getYaw: () => yaw,
      getSpeed: () => Math.hypot(vel.x, vel.z),
      getPos: () => ({ x: px, y: EYE, z: pz }),
      setKeys: (codes: string[]) => {
        held.clear();
        for (const code of codes) held.add(code);
        if (phaseRef.current === "menu" || phaseRef.current === "paused") {
          setPhaseBoth("play");
        }
      },
      isInsideWall: () => circleHits(px, pz, PLAYER_RADIUS * 0.92, boxes),
    };

    let last = performance.now();
    const clock = { t: 0 };

    const frame = (now: number) => {
      if (dead) return;
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.05) dt = 0.05;
      if (dt < 0) dt = 0;
      clock.t += dt;

      const playing = phaseRef.current === "play";
      if (playing) {
        iframe = Math.max(0, iframe - dt);
        const turn = (held.has("KeyQ") ? 1 : 0) - (held.has("KeyE") ? 1 : 0);
        yaw += turn * 2.6 * dt;
        if (lookId !== null && edge !== 0) yaw -= edge * 2.8 * dt;

        const fx = -Math.sin(yaw);
        const fz = -Math.cos(yaw);
        const rx = Math.cos(yaw);
        const rz = -Math.sin(yaw);
        let wx = 0;
        let wz = 0;
        if (held.has("KeyW") || held.has("ArrowUp")) {
          wx += fx;
          wz += fz;
        }
        if (held.has("KeyS") || held.has("ArrowDown")) {
          wx -= fx;
          wz -= fz;
        }
        if (held.has("KeyD") || held.has("ArrowRight")) {
          wx += rx;
          wz += rz;
        }
        if (held.has("KeyA") || held.has("ArrowLeft")) {
          wx -= rx;
          wz -= rz;
        }
        let sx = stick.x;
        let sy = stick.y;
        if (sx * sx + sy * sy < 0.02) {
          sx = 0;
          sy = 0;
        }
        wx += rx * sx + fx * sy;
        wz += rz * sx + fz * sy;
        const mag = Math.hypot(wx, wz);
        const sprint = held.has("ShiftLeft") || held.has("ShiftRight");
        const clipped = mag > 1 ? 1 : mag;
        const target = (sprint ? SPRINT : WALK) * clipped;
        const wishX = mag > 0 ? (wx / mag) * target : 0;
        const wishZ = mag > 0 ? (wz / mag) * target : 0;
        const rate = mag > 0.04 ? 14 : 10;
        const k = 1 - Math.exp(-rate * dt);
        vel.x += (wishX - vel.x) * k;
        vel.z += (wishZ - vel.z) * k;

        const next = resolveMove(px, pz, vel.x * dt, vel.z * dt, PLAYER_RADIUS, boxes, vel);
        px = next.x;
        pz = next.z;

        const speed = Math.hypot(vel.x, vel.z);
        prevBob = Math.sin(bobT);
        if (speed > 0.8) bobT += dt * speed * 1.7;
        const bobNow = Math.sin(bobT);
        if (speed > 1.3 && prevBob * bobNow < 0) sfx.step();

        elapsed += dt;
        const here = worldToCell(px, pz, maze.cols, maze.rows);
        revealAround(here.c, here.r);

        for (const g of gems) {
          if (g.taken) continue;
          const at = cellCenter(g.c, g.r);
          const dx = px - at.x;
          const dz = pz - at.z;
          if (dx * dx + dz * dz < 0.72 * 0.72) {
            g.taken = true;
            g.mesh.visible = false;
            gemCount += 1;
            timeLeft += GEM_TIME;
            sfx.pickup();
            pushHud(true);
          }
        }

        pathTick -= dt;
        if (pathTick <= 0) {
          pathTick = 0.22;
          const pc = worldToCell(px, pz, maze.cols, maze.rows);
          playerDist = gridDist(pc.c, pc.r);
        }
        const slide = { x: 0, z: 0 };
        let moaned = false;
        for (const h of haunts) {
          if (!h.alive) continue;
          const cell = worldToCell(h.x, h.z, maze.cols, maze.rows);
          const distCells = playerDist[cell.r]?.[cell.c] ?? 99;
          const chasing = distCells <= 8;
          if (chasing || Math.hypot(cellCenter(h.goalC, h.goalR).x - h.x, cellCenter(h.goalC, h.goalR).z - h.z) < 0.35) {
            if (chasing) {
              let bestC = cell.c;
              let bestR = cell.r;
              let bestD = distCells;
              for (const n of openNeighbors(cell.c, cell.r)) {
                const d = playerDist[n.r][n.c];
                if (d >= 0 && d < bestD) {
                  bestD = d;
                  bestC = n.c;
                  bestR = n.r;
                }
              }
              h.goalC = bestC;
              h.goalR = bestR;
            } else {
              const opts = openNeighbors(cell.c, cell.r);
              const pick = opts[(Math.random() * opts.length) | 0];
              if (pick) {
                h.goalC = pick.c;
                h.goalR = pick.r;
              }
            }
          }
          const goal = cellCenter(h.goalC, h.goalR);
          const gx = goal.x - h.x;
          const gz = goal.z - h.z;
          const gd = Math.hypot(gx, gz);
          const speed = chasing ? (h.kind === "goblin" ? 5.25 : 4.7) : h.kind === "goblin" ? 2.05 : 1.65;
          const step = resolveMove(
            h.x,
            h.z,
            gd > 0.04 ? (gx / gd) * speed * dt : 0,
            gd > 0.04 ? (gz / gd) * speed * dt : 0,
            0.34,
            boxes,
            slide,
          );
          h.x = step.x;
          h.z = step.z;
          const bob = Math.sin(clock.t * 3.2 + h.x) * 0.08;
          h.mesh.position.set(h.x, h.kind === "ghost" ? bob : 0, h.z);
          h.mesh.lookAt(px, h.mesh.position.y + 0.4, pz);
          if (chasing && distCells <= 5 && !moaned && clock.t > moanAt) {
            moaned = true;
            moanAt = clock.t + 2.4;
            sfx.moan();
          }
          const dx = px - h.x;
          const dz = pz - h.z;
          const touch = Math.hypot(dx, dz);
          if (touch < 0.88 && touch > 0.001) {
            const push = (0.88 - touch) / touch;
            const away = resolveMove(px, pz, dx * push, dz * push, PLAYER_RADIUS, boxes, slide);
            px = away.x;
            pz = away.z;
            const back = resolveMove(h.x, h.z, -dx * push * 1.5, -dz * push * 1.5, 0.34, boxes, slide);
            h.x = back.x;
            h.z = back.z;
            h.mesh.position.x = h.x;
            h.mesh.position.z = h.z;
            if (iframe <= 0) {
              iframe = 1.3;
              timeLeft = Math.max(0, timeLeft - HIT_TIME);
              booShake = 0.85;
              sfx.boo();
              sfx.hurt();
              hurtUntil = performance.now() + 480;
              if (!dead) setHurt(true);
              pushHud(true);
            }
          }
        }

        if (swing > 0) {
          swing += dt / 0.28;
          const p = Math.sin(Math.min(1, swing) * Math.PI);
          sword.rotation.z = -0.55 - p * 1.55;
          sword.rotation.x = 0.3 + p * 0.75;
          sword.position.z = -0.58 - p * 0.2;
          if (!swingHit && swing > 0.2 && swing < 0.7) {
            swingHit = true;
            const fx = -Math.sin(yaw);
            const fz = -Math.cos(yaw);
            let hit = false;
            for (const h of haunts) {
              if (!h.alive) continue;
              const dx = h.x - px;
              const dz = h.z - pz;
              const dist = Math.hypot(dx, dz);
              const dot = dist > 0.001 ? (dx * fx + dz * fz) / dist : 1;
              if (dist < 1.2 || (dist < 2 && dot > 0.2)) {
                h.alive = false;
                h.mesh.visible = false;
                hit = true;
              }
            }
            if (hit) {
              sfx.cut();
              pushHud(true);
            }
          }
          if (swing >= 1) {
            swing = 0;
            sword.rotation.set(0.3, 0.15, -0.55);
            sword.position.z = -0.58;
          }
        }

        const exitAt = cellCenter(maze.exit.c, maze.exit.r);
        const ex = px - exitAt.x;
        const ez = pz - exitAt.z;
        if (ex * ex + ez * ez < 1.05 * 1.05 && timeLeft > 0) {
          freshBest = bestRef.current == null || elapsed < bestRef.current;
          if (freshBest) {
            bestRef.current = elapsed;
            writeBest(elapsed);
          }
          setPhaseBoth("won");
          sfx.win();
          pushHud(true);
          try {
            document.exitPointerLock();
          } catch {
            /* ignore */
          }
        } else {
          timeLeft -= dt;
          if (timeLeft <= 0) {
            timeLeft = 0;
            setPhaseBoth("lost");
            sfx.lose();
            pushHud(true);
            try {
              document.exitPointerLock();
            } catch {
              /* ignore */
            }
          } else {
            pushHud(false);
          }
        }
      } else {
        const damp = Math.exp(-10 * dt);
        vel.x *= damp;
        vel.z *= damp;
      }

      const speed = Math.hypot(vel.x, vel.z);
      const bob = playing ? Math.sin(bobT) * 0.04 * Math.min(1, speed / 3) : 0;
      const rx = Math.cos(yaw);
      const rz = -Math.sin(yaw);
      const strafe = vel.x * rx + vel.z * rz;
      camera.position.set(px, EYE + bob, pz);
      lantern.position.set(px, 1.45, pz);
      if (playing) {
        camera.rotation.y = yaw;
        camera.rotation.x = pitch;
        const lean = -strafe * 0.012;
        const shiver = booShake > 0 ? Math.sin(clock.t * 46) * 0.055 * Math.min(1, booShake * 2) : 0;
        camera.rotation.z += (lean + shiver - camera.rotation.z) * Math.min(1, dt * 8);
        if (booShake > 0) booShake = Math.max(0, booShake - dt);
      } else if (phaseRef.current === "menu") {
        camera.rotation.y = spawnYaw + Math.sin(clock.t * 0.35) * 0.12;
        camera.rotation.x = -0.06;
        camera.rotation.z = 0;
      } else {
        camera.rotation.y = yaw;
        camera.rotation.x = pitch;
        camera.rotation.z = 0;
      }

      for (const g of gems) {
        if (g.taken) continue;
        const stone = g.mesh.children[0];
        stone.rotation.y += dt * 0.9;
        stone.position.y = 0.62 + Math.sin(clock.t * 2 + (g.mesh.userData.phase as number)) * 0.07;
      }
      const veil = world.getObjectByName("veil");
      if (veil && veil instanceof THREE.Mesh && veil.material instanceof THREE.MeshBasicMaterial) {
        veil.material.opacity = 0.62 + Math.sin(clock.t * 2.2) * 0.16;
      }

      if (hurtUntil && performance.now() > hurtUntil) {
        hurtUntil = 0;
        if (!dead) setHurt(false);
      }

      if (phaseRef.current !== "menu") drawMini();
      gl.render(scene, camera);
    };

    gl.setAnimationLoop(frame);
    if (wantEnter.current) enter();

    return () => {
      dead = true;
      gl.setAnimationLoop(null);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", resize);
      ro.disconnect();
      document.removeEventListener("mousemove", onMouse);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("pointerlockchange", onLock);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.parentElement?.removeEventListener("touchmove", blockTouch);
      if (window.__controlsTest) delete window.__controlsTest;
      sword.traverse((obj) => {
        if (obj instanceof THREE.Mesh) obj.geometry.dispose();
      });
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      gl.dispose();
      sfx.dispose();
    };
  }, []);

  const showPlayHud = phase === "play" || phase === "paused" || phase === "won";

  return (
    <div className={phase === "play" ? "game-root is-play" : "game-root"}>
      <canvas ref={canvasRef} className="view" />
      <div className={hurt ? "vignette on" : "vignette"} aria-hidden="true" />
      {phase === "play" ? <div className="crosshair" aria-hidden="true" /> : null}
      <div className={showPlayHud ? "hud" : "hud hud-quiet"}>
        <div className="hud-top">
          <div className="stack">
            <div className={hud.time < 20 ? "chip chip-hot" : "chip"}>
              <Timer aria-hidden="true" />
              <span>{formatTime(hud.time)}</span>
            </div>
            <div className="chip">
              <Gem aria-hidden="true" />
              <span>
                {hud.gems}/{hud.total}
              </span>
            </div>
            <div className="chip">
              <Ghost aria-hidden="true" />
              <span>{hud.haunts}</span>
            </div>
            {phase === "play" ? (
              <p className="objective">Find the gate. It is not on the map. Gems add time.</p>
            ) : null}
          </div>
          <div className="stack stack-end">
            <canvas ref={miniRef} className="mini" aria-label="Explored map" />
            {phase === "play" ? (
              <button type="button" className="icon-btn" onClick={() => api.current.pause()} aria-label="Pause">
                <Pause />
              </button>
            ) : null}
          </div>
        </div>
        {phase === "play" && lookHint ? <p className="look-hint touch-only">Drag to turn. Tap to swing.</p> : <span />}
      </div>

      {phase !== "play" ? (
        <div
          className="scrim"
          onPointerDown={(e) => {
            const el = e.target as HTMLElement;
            if (el.closest(".btn-ghost, .icon-btn, .scene")) return;
            if (phase === "menu" || phase === "paused") {
              wantEnter.current = true;
              api.current.enter();
            }
          }}
        >
          {phase === "menu" ? (
            <section className="card" aria-labelledby="title">
              <p className="kicker">Halloween maze</p>
              <h1 id="title">Paper Hollow</h1>
              <p>The clock counts down under a roof. Pocket gems to buy time. Cut the ghosts and goblins with your sword.</p>
              <p>The gate is real, but it stays off the map.</p>
              <div className="scenes">
                {SCENES.map((scene) => (
                  <button
                    key={scene.id}
                    type="button"
                    className={sceneId === scene.id ? "scene on" : "scene"}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => api.current.setScene(scene.id)}
                  >
                    {scene.name}
                  </button>
                ))}
              </div>
              <ul className="keys hint-keys">
                <li>
                  <span>WASD</span> Walk
                </li>
                <li>
                  <span>Mouse</span> Look
                </li>
                <li>
                  <span>Click</span> Swing
                </li>
                <li>
                  <span>Shift</span> Run
                </li>
              </ul>
              <p className="hint-touch">
                The lower-left circle walks. Drag to turn. The sword button, or a short tap, cuts.
              </p>
              {hud.best != null ? <p className="best-line">Best {formatTime(hud.best)}</p> : null}
              {bootError ? <p className="best-line">{bootError}</p> : null}
              <div className="actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    wantEnter.current = true;
                    api.current.enter();
                  }}
                >
                  Enter
                </button>
              </div>
            </section>
          ) : null}

          {phase === "paused" ? (
            <section className="card" aria-labelledby="paused-title">
              <p className="kicker">Holding</p>
              <h1 id="paused-title">Paused</h1>
              <p>The clock waits with you.</p>
              <div className="actions">
                <button type="button" className="btn" onClick={() => api.current.resume()}>
                  Resume
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => api.current.menu()}>
                  New maze
                </button>
              </div>
            </section>
          ) : null}

          {phase === "won" ? (
            <section className="card" aria-labelledby="won-title">
              <p className="kicker">{hud.freshBest ? "New best" : "Through"}</p>
              <h1 id="won-title">Gate found</h1>
              <p>You got out before the clock died.</p>
              <div className="stat-row">
                <div className="stat">
                  <b>{formatTime(hud.time)}</b>
                  <small>Time left</small>
                </div>
                <div className="stat">
                  <b>
                    {hud.gems}/{hud.total}
                  </b>
                  <small>Gems</small>
                </div>
                <div className="stat">
                  <b>{6 - hud.haunts}</b>
                  <small>Cut</small>
                </div>
              </div>
              {hud.best != null ? <p className="best-line">Best escape {formatTime(hud.best)}</p> : null}
              <div className="actions">
                <button type="button" className="btn" onClick={() => api.current.again()}>
                  Walk again
                </button>
              </div>
            </section>
          ) : null}

          {phase === "lost" ? (
            <section className="card" aria-labelledby="lost-title">
              <p className="kicker">Out of time</p>
              <h1 id="lost-title">The dark caught you</h1>
              <p>The clock hit zero. Gems buy time. The sword is how they fall.</p>
              <div className="actions">
                <button type="button" className="btn" onClick={() => api.current.again()}>
                  Try again
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => api.current.menu()}>
                  Menu
                </button>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      <button type="button" className="swing" onClick={() => api.current.swing()}>
        Swing
      </button>
      <Joystick
        knobRef={knobRef}
        onChange={(x, y) => {
          stickRef.current.x = x;
          stickRef.current.y = y;
        }}
      />
    </div>
  );
}

function Joystick({
  knobRef,
  onChange,
}: {
  knobRef: RefObject<HTMLDivElement | null>;
  onChange: (x: number, y: number) => void;
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const el = baseRef.current;
    const knob = knobRef.current;
    if (!el || !knob) return;
    let id: number | null = null;
    const origin = { x: 0, y: 0 };

    const place = (x: number, y: number) => {
      const max = 40;
      knob.style.transform = `translate(${x * max}px, ${y * max}px)`;
    };

    const down = (e: PointerEvent) => {
      id = e.pointerId;
      el.setPointerCapture(e.pointerId);
      const r = el.getBoundingClientRect();
      origin.x = r.left + r.width / 2;
      origin.y = r.top + r.height / 2;
      move(e);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - origin.x;
      const dy = e.clientY - origin.y;
      const max = 46;
      const mag = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, mag / max);
      const nx = (dx / mag) * k;
      const ny = (-dy / mag) * k;
      place(nx, -ny);
      onChangeRef.current(nx, ny);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = null;
      place(0, 0);
      onChangeRef.current(0, 0);
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [knobRef]);

  return (
    <div ref={baseRef} className="stick touch-only" aria-label="Move">
      <div ref={knobRef} className="stick-knob" />
    </div>
  );
}
