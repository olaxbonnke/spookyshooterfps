import { useEffect, useRef, useState, type RefObject } from "react";
import { Check, Copy, Crosshair, Pause, Play, RefreshCw, RotateCcw, Shield, Skull, Sparkles, User, Users, Volume2 } from "lucide-react";
import * as THREE from "three";
import { ARENAS, arenaBoxes, findArena, rayBoxes, resolveMove, type Aabb, type Arena, type MapId } from "@/game/arenas";
import { createSfx } from "@/game/sfx";
import { useP2PRoom } from "@/lib/multiplayer";

type Phase = "menu" | "play" | "paused" | "won" | "lost";

type Hud = {
  hp: number;
  foes: number;
  total: number;
  map: string;
};

type Foe = {
  mesh: THREE.Group;
  light: THREE.PointLight;
  x: number;
  z: number;
  hp: number;
  cool: number;
  alive: boolean;
};

type Remote = {
  id: string;
  name: string;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  at: number;
};

type Net = {
  enabled: boolean;
  selfId: string;
  name: string;
  isHost: boolean;
  remotes: Map<string, Remote>;
  inbox: { from: string; data: unknown }[];
  broadcast: (data: unknown) => void;
  send: (data: unknown, peerId?: string) => void;
};

const EYE = 1.62;
const WALK = 6.4;
const SPRINT = 9.2;
const RADIUS = 0.36;
const FOE_R = 0.42;
const LOOK_SENS = 0.0044;

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

function blankNet(): Net {
  return {
    enabled: false,
    selfId: "",
    name: "Ranger",
    isHost: true,
    remotes: new Map(),
    inbox: [],
    broadcast: () => {},
    send: () => {},
  };
}

type Props = {
  map: MapId;
  name: string;
  room: string | null;
  onLeave: (map: MapId) => void;
};

function drawMinimap(
  ctx: CanvasRenderingContext2D,
  px: number,
  pz: number,
  yaw: number,
  arena: Arena,
  foes: Foe[],
  remotes: Remote[],
) {
  const size = 180;
  const half = size / 2;
  const radius = half - 6;
  const scale = 3.4; // 3.4 px per meter => ~25m radius

  ctx.clearRect(0, 0, size, size);

  // Circular radar frame
  ctx.save();
  ctx.beginPath();
  ctx.arc(half, half, radius, 0, Math.PI * 2);
  ctx.clip();

  // Radar dark background
  ctx.fillStyle = "rgba(8, 10, 16, 0.88)";
  ctx.fill();

  // Range rings
  ctx.strokeStyle = "rgba(0, 210, 255, 0.14)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(half, half, radius * 0.45, 0, Math.PI * 2);
  ctx.arc(half, half, radius * 0.82, 0, Math.PI * 2);
  ctx.stroke();

  // Crosshairs
  ctx.beginPath();
  ctx.moveTo(half, 0); ctx.lineTo(half, size);
  ctx.moveTo(0, half); ctx.lineTo(size, half);
  ctx.stroke();

  // Rotate world around player position so forward is UP
  ctx.translate(half, half);
  ctx.rotate(-yaw);

  // Draw maze walls
  ctx.fillStyle = "rgba(90, 120, 150, 0.55)";
  ctx.strokeStyle = "rgba(140, 180, 220, 0.75)";
  ctx.lineWidth = 1;

  for (const b of arena.walls) {
    const bx = (b.minX + b.maxX) / 2;
    const bz = (b.minZ + b.maxZ) / 2;
    if (Math.hypot(bx - px, bz - pz) > 28) continue;
    const x0 = (b.minX - px) * scale;
    const z0 = (b.minZ - pz) * scale;
    const w = (b.maxX - b.minX) * scale;
    const h = (b.maxZ - b.minZ) * scale;
    ctx.fillRect(x0, z0, w, h);
    ctx.strokeRect(x0, z0, w, h);
  }

  // Draw barricades / shields
  ctx.fillStyle = "rgba(224, 122, 40, 0.75)";
  for (const s of arena.shields) {
    if (Math.hypot(s.x - px, s.z - pz) > 26) continue;
    const x0 = (s.x - s.w / 2 - px) * scale;
    const z0 = (s.z - s.d / 2 - pz) * scale;
    ctx.fillRect(x0, z0, s.w * scale, s.d * scale);
  }

  // Draw pumpkins
  ctx.fillStyle = "rgba(255, 140, 20, 0.85)";
  for (const p of arena.pumpkins) {
    if (Math.hypot(p.x - px, p.z - pz) > 22) continue;
    ctx.beginPath();
    ctx.arc((p.x - px) * scale, (p.z - pz) * scale, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw living foes (pulsing red dots)
  const pulse = 1 + Math.sin(performance.now() * 0.009) * 0.3;
  for (const f of foes) {
    if (!f.alive) continue;
    const d = Math.hypot(f.x - px, f.z - pz);
    if (d > 26) continue;
    const fx = (f.x - px) * scale;
    const fz = (f.z - pz) * scale;

    ctx.fillStyle = "rgba(255, 30, 50, 0.3)";
    ctx.beginPath();
    ctx.arc(fx, fz, 6.5 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ff1e38";
    ctx.beginPath();
    ctx.arc(fx, fz, 3.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw squadmates (cyan dots)
  ctx.fillStyle = "#00d2ff";
  for (const r of remotes) {
    const rx = (r.x - px) * scale;
    const rz = (r.z - pz) * scale;
    ctx.beginPath();
    ctx.arc(rx, rz, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // Player tactical arrow in center (pointing UP)
  ctx.save();
  ctx.translate(half, half);
  ctx.fillStyle = "#10f08c";
  ctx.shadowColor = "rgba(16, 240, 140, 0.85)";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(5.5, 6);
  ctx.lineTo(0, 2.5);
  ctx.lineTo(-5.5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Outer border & compass markers
  ctx.save();
  ctx.strokeStyle = "rgba(0, 210, 255, 0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(half, half, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Compass North marker
  ctx.font = "bold 10px 'Rajdhani', monospace";
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const nAngle = -yaw - Math.PI / 2;
  const nDist = radius - 8;
  ctx.fillText("N", half + Math.cos(nAngle) * nDist, half + Math.sin(nAngle) * nDist);
  ctx.restore();
}

export function ShooterGame(props: Props) {
  return <Match {...props} />;
}

function Match({ map, name, room, onLeave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapCanvasRef = useRef<HTMLCanvasElement>(null);
  const stickRef = useRef({ x: 0, y: 0 });
  const knobRef = useRef<HTMLDivElement>(null);
  const netRef = useRef<Net>(blankNet());
  const onLeaveRef = useRef(onLeave);
  onLeaveRef.current = onLeave;
  const p2p = useP2PRoom({ room: room ?? "solo", name, enabled: !!room });
  const api = useRef({
    enter: () => {},
    resume: () => {},
    pause: () => {},
    again: () => {},
    menu: () => {},
    fire: () => {},
    setMap: (_id: MapId) => {},
    next: () => {},
  });
  const [phase, setPhase] = useState<Phase>("play");
  const [mapId, setMapId] = useState<MapId>(map);
  const [hurt, setHurt] = useState(false);
  const [hitMarker, setHitMarker] = useState(false);
  const [hud, setHud] = useState<Hud>({ hp: 100, foes: 6, total: 6, map: "Hedge" });
  const [lookHint, setLookHint] = useState(true);
  const [copied, setCopied] = useState(false);

  const onHitRef = useRef<() => void>(() => {});
  onHitRef.current = () => {
    setHitMarker(true);
    setTimeout(() => setHitMarker(false), 90);
  };

  const connected = p2p.peers.filter((peer) => peer.connectionState === "connected");
  netRef.current.enabled = !!room;
  netRef.current.selfId = p2p.selfId;
  netRef.current.name = name;
  netRef.current.broadcast = p2p.broadcast;
  netRef.current.send = p2p.send;
  const ids = [p2p.selfId, ...connected.map((peer) => peer.id)];
  netRef.current.isHost = ids.reduce((best, id) => (id < best ? id : best)) === p2p.selfId;

  useEffect(() => p2p.onMessage((from, data) => {
    netRef.current.inbox.push({ from, data });
  }), [p2p.onMessage]);

  const copyInvite = () => {
    if (!room) return;
    const url = new URL(window.location.href);
    url.pathname = url.pathname.replace(/\/play\/?$/, "/") || "/";
    url.search = "";
    url.searchParams.set("map", mapId);
    url.searchParams.set("room", room);
    void navigator.clipboard
      ?.writeText(url.toString())
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2400);
      })
      .catch(() => setCopied(false));
  };

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const canvas: HTMLCanvasElement = canvasEl;
    let dead = false;
    const sfx = createSfx();
    const held = new Set<string>();
    const phaseRef = { current: "play" as Phase };
    const stick = stickRef.current;
    const mapPick = { current: map };

    const setPhaseBoth = (p: Phase) => {
      phaseRef.current = p;
      if (!dead) setPhase(p);
    };

    const renderer = (() => {
      try {
        return new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
      } catch {
        return null;
      }
    })();
    if (!renderer) {
      sfx.dispose();
      return;
    }
    const gl = renderer;
    gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.3;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 200);
    camera.rotation.order = "YXZ";
    scene.add(camera);

    // Ambient fill light: guarantees geometry is never pitch-black void
    const ambient = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambient);

    // Atmospheric sky & ground hemisphere light
    const hemi = new THREE.HemisphereLight(0xffeedd, 0x3d3028, 2.0);
    scene.add(hemi);

    // Directional sunlight
    const sun = new THREE.DirectionalLight(0xffd8aa, 2.4);
    sun.position.set(-18, 28, 12);
    scene.add(sun);

    // Tactical Player Flashlight / Lantern: moves with camera, casts dynamic light ahead in corridors
    const lantern = new THREE.PointLight(0xffecd0, 42, 28, 1.8);
    lantern.position.set(0, 0, 0);
    camera.add(lantern);

    // Muzzle flash point light
    const flash = new THREE.PointLight(0xffaa44, 0, 14, 2);
    camera.add(flash);

    // Tactical Shotgun / Rifle Model
    const gun = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x1c2026, roughness: 0.35, metalness: 0.85 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a341e, roughness: 0.65, metalness: 0.08 });
    const sleeve = new THREE.MeshStandardMaterial({ color: 0x242832, roughness: 0.85 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.78), metal);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.62), metal);
    barrel.position.set(0, 0.055, -0.52);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.3), metal);
    guard.position.set(0, -0.01, -0.2);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.16, 0.07), wood);
    grip.position.set(0, -0.12, 0.16);
    grip.rotation.x = 0.45;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.32), wood);
    stock.position.set(0, 0.01, 0.42);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.42), sleeve);
    arm.position.set(0.04, -0.16, 0.28);
    arm.rotation.x = 0.55;
    gun.add(body, barrel, guard, grip, stock, arm);
    gun.position.set(0.16, -0.26, -0.48);
    gun.rotation.y = -0.12;
    gun.rotation.x = -0.04;
    gun.traverse((child) => {
      child.renderOrder = 10;
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.material && !Array.isArray(mesh.material)) {
        mesh.material.depthTest = false;
        mesh.material.depthWrite = false;
      }
    });
    camera.add(gun);

    // Upgraded Materials using MeshStandardMaterial with atmospheric emissive highlights
    const foeMat = new THREE.MeshStandardMaterial({ color: 0x7a2228, roughness: 0.55, emissive: 0x440810, emissiveIntensity: 0.45 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xd8c5b2, roughness: 0.65 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff1133, emissive: 0xff0022, emissiveIntensity: 2.2 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x5a6a42, roughness: 0.85, metalness: 0.08 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x2c4a34, roughness: 0.78, metalness: 0.12 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xe07a28, roughness: 0.45, emissive: 0x773300, emissiveIntensity: 0.4 });
    const coverMat = new THREE.MeshStandardMaterial({ color: 0xc45a18, roughness: 0.75 });
    const pumpMat = new THREE.MeshStandardMaterial({ color: 0xff6611, roughness: 0.45, emissive: 0xb53c00, emissiveIntensity: 0.75 });
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x3d5a32, roughness: 0.9 });
    const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe7a8, linewidth: 2 });
    const materials = [metal, wood, sleeve, foeMat, headMat, eyeMat, floorMat, wallMat, trimMat, coverMat, pumpMat, stemMat, tracerMat];

    const world = new THREE.Group();
    scene.add(world);
    const geos: THREE.BufferGeometry[] = [body.geometry, barrel.geometry, guard.geometry, grip.geometry, stock.geometry, arm.geometry];

    let arena: Arena = findArena("grass");
    let boxes: Aabb[] = [];
    let foes: Foe[] = [];
    let px = 0;
    let pz = 0;
    let yaw = 0;
    let pitch = 0;
    const vel = { x: 0, z: 0 };
    let hp = 100;
    let aliveFoes = 0;
    let flashT = 0;
    let kick = 0;
    let recoil = 0;
    let swayX = 0;
    let swayY = 0;
    let prevYaw = 0;
    let prevPitch = 0;
    let hurtUntil = 0;
    let boo = 0;
    const wantFire = { current: false };

    const tracers: { line: THREE.Line; life: number }[] = [];
    for (let i = 0; i < 10; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(geo, tracerMat);
      line.visible = false;
      line.frustumCulled = false;
      scene.add(line);
      geos.push(geo);
      tracers.push({ line, life: 0 });
    }

    let hudAt = 0;
    function pushHud(force = false) {
      if (dead) return;
      const now = performance.now();
      if (!force && now - hudAt < 80) return;
      hudAt = now;
      setHud({
        hp: Math.max(0, Math.round(hp)),
        foes: aliveFoes,
        total: foes.length,
        map: arena.name,
      });
    }

    function lookDir() {
      const cp = Math.cos(pitch);
      return {
        x: -Math.sin(yaw) * cp,
        y: -Math.sin(pitch),
        z: -Math.cos(yaw) * cp,
      };
    }

    function trace(ax: number, ay: number, az: number, bx: number, by: number, bz: number, enemy: boolean) {
      const slot = tracers.find((t) => t.life <= 0) ?? tracers[0];
      const attr = slot.line.geometry.getAttribute("position") as THREE.BufferAttribute;
      attr.setXYZ(0, ax, ay, az);
      attr.setXYZ(1, bx, by, bz);
      attr.needsUpdate = true;
      slot.line.visible = true;
      slot.life = enemy ? 0.08 : 0.05;
      tracerMat.color.setHex(enemy ? 0xff4433 : 0xffe6a8);
    }

    function clearWorld() {
      for (const child of [...world.children]) world.remove(child);
      foes = [];
    }

    function build() {
      clearWorld();
      arena = findArena(mapPick.current);
      boxes = arenaBoxes(arena);
      hp = 100;
      kick = 0;
      recoil = 0;
      boo = 0;
      px = arena.spawn.x;
      pz = arena.spawn.z;
      yaw = arena.spawn.yaw;
      pitch = 0;
      vel.x = 0;
      vel.z = 0;
      scene.background = new THREE.Color(arena.sky);
      scene.fog = new THREE.Fog(arena.fog, 6, 52);
      gl.setClearColor(arena.sky, 1);
      floorMat.color.setHex(arena.floor);
      wallMat.color.setHex(arena.wall);
      trimMat.color.setHex(arena.trim);
      coverMat.color.setHex(arena.cover);
      sun.color.setHex(arena.sun);
      lantern.color.setHex(0xffedd0);

      // Floor plane
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(arena.floorW, arena.floorD, 4, 4), floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(arena.floorX, 0, arena.floorZ);
      floor.frustumCulled = false;
      world.add(floor);
      geos.push(floor.geometry);

      // Maze walls
      const dummy = new THREE.Object3D();
      const wallGeo = new THREE.BoxGeometry(1, 1, 1);
      geos.push(wallGeo);
      const walls = new THREE.InstancedMesh(wallGeo, wallMat, arena.walls.length);
      arena.walls.forEach((b, i) => {
        dummy.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);
        dummy.scale.set(Math.max(0.05, b.maxX - b.minX), b.maxY - b.minY, Math.max(0.05, b.maxZ - b.minZ));
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        walls.setMatrixAt(i, dummy.matrix);
      });
      walls.instanceMatrix.needsUpdate = true;
      walls.frustumCulled = false;
      world.add(walls);

      // Tactical cover / barricades
      const shieldGeo = new THREE.BoxGeometry(1, 1, 1);
      geos.push(shieldGeo);
      if (arena.shields.length) {
        const shields = new THREE.InstancedMesh(shieldGeo, coverMat, arena.shields.length);
        arena.shields.forEach((s, i) => {
          dummy.position.set(s.x, s.h / 2, s.z);
          dummy.scale.set(s.w, s.h, s.d);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          shields.setMatrixAt(i, dummy.matrix);
        });
        shields.instanceMatrix.needsUpdate = true;
        shields.frustumCulled = false;
        world.add(shields);

        const caps = new THREE.InstancedMesh(shieldGeo, trimMat, arena.shields.length);
        arena.shields.forEach((s, i) => {
          dummy.position.set(s.x, s.h + 0.08, s.z);
          dummy.scale.set(s.w + 0.08, 0.16, s.d + 0.08);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          caps.setMatrixAt(i, dummy.matrix);
        });
        caps.instanceMatrix.needsUpdate = true;
        caps.frustumCulled = false;
        world.add(caps);
      }

      // Glowing Jack-o'-lantern pumpkins
      if (arena.pumpkins.length) {
        const pumpGeo = new THREE.SphereGeometry(0.42, 8, 7);
        const stemGeo = new THREE.CylinderGeometry(0.045, 0.06, 0.18, 5);
        geos.push(pumpGeo, stemGeo);
        const pumps = new THREE.InstancedMesh(pumpGeo, pumpMat, arena.pumpkins.length);
        const stems = new THREE.InstancedMesh(stemGeo, stemMat, arena.pumpkins.length);
        arena.pumpkins.forEach((p, i) => {
          dummy.position.set(p.x, 0.3 * p.s, p.z);
          dummy.scale.set(p.s, p.s * 0.78, p.s);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          pumps.setMatrixAt(i, dummy.matrix);
          dummy.position.set(p.x, 0.58 * p.s, p.z);
          dummy.scale.set(p.s, p.s, p.s);
          dummy.updateMatrix();
          stems.setMatrixAt(i, dummy.matrix);
        });
        pumps.instanceMatrix.needsUpdate = true;
        stems.instanceMatrix.needsUpdate = true;
        pumps.frustumCulled = false;
        stems.frustumCulled = false;
        world.add(pumps, stems);
      }

      // Foes with glowing red eyes
      const bodyGeo = new THREE.BoxGeometry(0.62, 1.05, 0.4);
      const headGeo = new THREE.SphereGeometry(0.24, 8, 6);
      const eyeGeo = new THREE.SphereGeometry(0.05, 6, 4);
      geos.push(bodyGeo, headGeo, eyeGeo);
      foes = arena.foes.map((spot) => {
        const group = new THREE.Group();
        const torso = new THREE.Mesh(bodyGeo, foeMat);
        torso.position.y = 0.85;
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.58;
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.08, 1.62, -0.22);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.08, 1.62, -0.22);
        const eyeLight = new THREE.PointLight(0xff1122, 14, 12, 1.8);
        eyeLight.position.set(0, 1.5, -0.2);
        group.add(torso, head, eyeL, eyeR, eyeLight);
        group.position.set(spot.x, 0, spot.z);
        group.frustumCulled = false;
        world.add(group);
        return { mesh: group, light: eyeLight, x: spot.x, z: spot.z, hp: 100, cool: 0.6 + Math.random() * 0.8, alive: true };
      });
      aliveFoes = foes.length;
      pushHud(true);
      const net = netRef.current;
      if (net.enabled && net.isHost) net.send({ k: "map", id: arena.id });
    }

    function resize() {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      const aspect = w / Math.max(1, h);
      gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 900 ? 1 : 1.5));
      gl.setSize(w, h, false);
      const horizontal = 90 * (Math.PI / 180);
      let vertical = (2 * Math.atan(Math.tan(horizontal / 2) / Math.max(aspect, 0.35)) * 180) / Math.PI;
      vertical = Math.max(54, Math.min(vertical, aspect < 1 ? 96 : 74));
      camera.aspect = aspect;
      camera.fov = vertical;
      camera.updateProjectionMatrix();
    }

    function tryLock() {
      const coarse = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 860;
      if (coarse) return;
      try {
        canvas.requestPointerLock();
      } catch {
        /* still playable without a lock */
      }
    }

    function shoot() {
      if (phaseRef.current !== "play" || hp <= 0) return;
      wantFire.current = true;
    }

    const resetInput = () => {
      held.clear();
      stick.x = 0;
      stick.y = 0;
      vel.x = 0;
      vel.z = 0;
    };

    function enter() {
      if (dead) return;
      resetInput();
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
      resetInput();
      setPhaseBoth("paused");
      try {
        document.exitPointerLock();
      } catch {
        /* ignore */
      }
    }

    function again() {
      try {
        sfx.unlock();
      } catch {
        /* ignore */
      }
      const net = netRef.current;
      if (net.enabled && !net.isHost) {
        net.send({ k: "reset" });
        return;
      }
      build();
      tryLock();
      setPhaseBoth("play");
    }

    function leave() {
      try {
        document.exitPointerLock();
      } catch {
        /* ignore */
      }
      onLeaveRef.current(mapPick.current);
    }

    function setMap(id: MapId) {
      mapPick.current = id;
      if (!dead) setMapId(id);
      if (phaseRef.current === "menu") build();
    }

    function next() {
      const i = ARENAS.findIndex((a) => a.id === mapPick.current);
      const id = ARENAS[(i + 1) % ARENAS.length].id;
      const net = netRef.current;
      if (net.enabled && !net.isHost) {
        net.send({ k: "reset", map: id });
        return;
      }
      setMap(id);
      again();
    }

    api.current = { enter, resume: enter, pause, again, menu: leave, fire: shoot, setMap, next };

    const onKeyDown = (e: KeyboardEvent) => {
      held.add(e.code);
      if (e.key) held.add(e.key.toLowerCase());
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
      if (e.code === "Escape") pause();
      if ((e.code === "KeyF" || e.code === "Space") && phaseRef.current === "play") shoot();
      if ((e.code === "Enter" || e.code === "Space") && (phaseRef.current === "menu" || phaseRef.current === "paused")) {
        enter();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      held.delete(e.code);
      if (e.key) held.delete(e.key.toLowerCase());
    };
    const onBlur = () => {
      resetInput();
    };
    const onFocus = () => {
      resetInput();
    };
    const onMouse = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas || phaseRef.current !== "play") return;
      yaw -= e.movementX * LOOK_SENS;
      pitch -= e.movementY * LOOK_SENS;
      pitch = Math.max(-1.15, Math.min(1.15, pitch));
    };
    let sawLock = false;
    const onLock = () => {
      const locked = document.pointerLockElement === canvas;
      resetInput();
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
      if (e.pointerType === "mouse" && document.pointerLockElement !== canvas) {
        tryLock();
        return;
      }
      if (document.pointerLockElement === canvas) return;
      lookId = e.pointerId;
      lookX = e.clientX;
      lookY = e.clientY;
      edge = 0;
      lookTravel = 0;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* drag still works */
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== lookId || phaseRef.current !== "play") return;
      const dx = e.clientX - lookX;
      const dy = e.clientY - lookY;
      lookX = e.clientX;
      lookY = e.clientY;
      lookTravel += Math.hypot(dx, dy);
      const sens = e.pointerType === "mouse" ? 0.0058 : 0.014;
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
      const tap = lookTravel < 16;
      lookId = null;
      edge = 0;
      if (tap) shoot();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (document.pointerLockElement === canvas) shoot();
    };

    const onVisibility = () => {
      if (document.hidden) resetInput();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
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

    build();
    resize();
    window.__controlsTest = {
      getYaw: () => yaw,
      getSpeed: () => Math.hypot(vel.x, vel.z),
      getPos: () => ({ x: px, y: EYE, z: pz }),
      setKeys: (codes: string[]) => {
        held.clear();
        for (const code of codes) held.add(code);
        if (phaseRef.current === "menu" || phaseRef.current === "paused") setPhaseBoth("play");
      },
      isInsideWall: () => false,
    };

    const friendMat = new THREE.MeshStandardMaterial({ color: 0x2b82ba, roughness: 0.5, emissive: 0x0f4066, emissiveIntensity: 0.5 });
    materials.push(friendMat);
    const friendBody = new THREE.BoxGeometry(0.62, 1.05, 0.4);
    const friendHead = new THREE.SphereGeometry(0.22, 8, 6);
    geos.push(friendBody, friendHead);
    const friends = new Map<string, THREE.Group>();
    const ensureFriend = (id: string) => {
      const existing = friends.get(id);
      if (existing) return existing;
      const group = new THREE.Group();
      const torso = new THREE.Mesh(friendBody, friendMat);
      torso.position.y = 0.85;
      const head = new THREE.Mesh(friendHead, headMat);
      head.position.y = 1.58;
      group.add(torso, head);
      scene.add(group);
      friends.set(id, group);
      return group;
    };

    function strike(foe: Foe) {
      foe.hp -= 40;
      sfx.hit();
      onHitRef.current();
      if (foe.hp <= 0) {
        foe.alive = false;
        foe.mesh.visible = false;
        foe.light.intensity = 0;
        aliveFoes = foes.filter((f) => f.alive).length;
        pushHud(true);
      }
    }

    function sting(amount: number) {
      if (amount <= 0 || phaseRef.current !== "play") return;
      hp -= amount;
      hurtUntil = performance.now() + 260;
      if (!dead) setHurt(true);
      sfx.hurt();
      pushHud(true);
    }

    function applyMap(id: string) {
      if (id !== "grass" && id !== "brick" && id !== "palace") return;
      if (id === arena.id) return;
      mapPick.current = id;
      if (!dead) setMapId(id);
      build();
    }

    function drain() {
      const net = netRef.current;
      const batch = net.inbox.splice(0, 40);
      for (const msg of batch) {
        const data = msg.data;
        if (!data || typeof data !== "object") continue;
        const packet = data as Record<string, unknown>;
        if (packet.k === "me") {
          const x = Number(packet.x);
          const z = Number(packet.z);
          if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
          let remote = net.remotes.get(msg.from);
          if (!remote) {
            remote = { id: msg.from, name: "Friend", x, z, yaw: 0, hp: 100, at: 0 };
            net.remotes.set(msg.from, remote);
          }
          remote.x = x;
          remote.z = z;
          remote.yaw = Number(packet.yaw) || 0;
          remote.hp = Number(packet.hp) || remote.hp;
          remote.name = String(packet.name || remote.name).slice(0, 16);
          remote.at = performance.now();
        } else if (packet.k === "foes" && !net.isHost && Array.isArray(packet.foes)) {
          if (typeof packet.map === "string") applyMap(packet.map);
          const rows = packet.foes as { x: number; z: number; hp: number; alive: boolean }[];
          rows.forEach((row, i) => {
            const foe = foes[i];
            if (!foe || !row) return;
            foe.x = Number(row.x) || foe.x;
            foe.z = Number(row.z) || foe.z;
            foe.hp = Number(row.hp);
            foe.alive = !!row.alive;
            foe.mesh.visible = foe.alive;
            foe.mesh.position.set(foe.x, 0, foe.z);
          });
          aliveFoes = foes.filter((foe) => foe.alive).length;
          if (aliveFoes > 0 && (phaseRef.current === "won" || phaseRef.current === "lost")) setPhaseBoth("play");
        } else if (packet.k === "shot" && net.isHost) {
          const foe = foes[Number(packet.i)];
          if (foe?.alive) strike(foe);
        } else if (packet.k === "ouch") {
          sting(Math.min(20, Number(packet.dmg) || 0));
        } else if (packet.k === "map" && !net.isHost && typeof packet.id === "string") {
          applyMap(packet.id);
        } else if (packet.k === "reset" && net.isHost) {
          if (typeof packet.map === "string") {
            if (packet.map === "grass" || packet.map === "brick" || packet.map === "palace") {
              mapPick.current = packet.map;
              if (!dead) setMapId(packet.map);
            }
          }
          build();
          tryLock();
          setPhaseBoth("play");
        }
      }
    }

    let last = performance.now();
    let fireCool = 0;
    let lastMe = 0;
    let lastFoeSend = 0;
    const frame = (now: number) => {
      if (dead) return;
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.05) dt = 0.05;
      if (dt < 0) dt = 0;
      drain();
      const playing = phaseRef.current === "play";
      fireCool = Math.max(0, fireCool - dt);
      flashT = Math.max(0, flashT - dt);
      flash.intensity = flashT > 0 ? 12 : 0;

      if (playing) {
        const turn = (held.has("KeyQ") || held.has("q") ? 1 : 0) - (held.has("KeyE") || held.has("e") ? 1 : 0);
        yaw += turn * 2.4 * dt;
        if (lookId !== null && edge !== 0) yaw -= edge * 2.6 * dt;

        const fx = -Math.sin(yaw);
        const fz = -Math.cos(yaw);
        const rx = Math.cos(yaw);
        const rz = -Math.sin(yaw);
        let wx = 0;
        let wz = 0;
        if (held.has("KeyW") || held.has("ArrowUp") || held.has("w")) {
          wx += fx;
          wz += fz;
        }
        if (held.has("KeyS") || held.has("ArrowDown") || held.has("s")) {
          wx -= fx;
          wz -= fz;
        }
        if (held.has("KeyD") || held.has("ArrowRight") || held.has("d")) {
          wx += rx;
          wz += rz;
        }
        if (held.has("KeyA") || held.has("ArrowLeft") || held.has("a")) {
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
        if (mag === 0) {
          vel.x *= Math.exp(-26 * dt);
          vel.z *= Math.exp(-26 * dt);
          if (Math.abs(vel.x) < 0.02) vel.x = 0;
          if (Math.abs(vel.z) < 0.02) vel.z = 0;
        } else {
          const k = 1 - Math.exp(-18 * dt);
          vel.x += (wishX - vel.x) * k;
          vel.z += (wishZ - vel.z) * k;
        }
        const moved = resolveMove(px, pz, vel.x * dt, vel.z * dt, RADIUS, boxes);
        if (Math.abs(moved.x - px) < 1e-4 && Math.abs(vel.x) > 0.01) {
          vel.x = 0;
        }
        if (Math.abs(moved.z - pz) < 1e-4 && Math.abs(vel.z) > 0.01) {
          vel.z = 0;
        }
        px = moved.x;
        pz = moved.z;

        const dir = lookDir();
        if (wantFire.current && fireCool <= 0) {
          wantFire.current = false;
          fireCool = 0.2;
          kick = 1;
          recoil = Math.min(0.07, recoil + 0.02);
          flashT = 0.045;
          sfx.shot();
          const wallT = rayBoxes(px, EYE, pz, dir.x, dir.y, dir.z, 60, boxes);
          let best = wallT;
          let foe: Foe | null = null;
          for (const f of foes) {
            if (!f.alive) continue;
            const vx = f.x - px;
            const vy = 1.15 - EYE;
            const vz = f.z - pz;
            const t = vx * dir.x + vy * dir.y + vz * dir.z;
            if (t < 0.6 || t > best) continue;
            const hx = px + dir.x * t;
            const hy = EYE + dir.y * t;
            const hz = pz + dir.z * t;
            const miss = (hx - f.x) ** 2 + (hz - f.z) ** 2;
            if (miss < 0.55 * 0.55 && hy > 0.2 && hy < 1.9) {
              best = t;
              foe = f;
            }
          }
          const hx = px + dir.x * best;
          const hy = EYE + dir.y * best;
          const hz = pz + dir.z * best;
          trace(px + dir.x * 0.4, EYE - 0.15, pz + dir.z * 0.4, hx, hy, hz, !!foe);
          if (foe) {
            const net = netRef.current;
            if (!net.enabled || net.isHost) strike(foe);
            else net.send({ k: "shot", i: foes.indexOf(foe) });
          }
        }

        const simulate = !netRef.current.enabled || netRef.current.isHost;
        if (simulate) {
          const squad: { id: string; x: number; z: number }[] = [{ id: "self", x: px, z: pz }];
          if (netRef.current.enabled) {
            for (const remote of netRef.current.remotes.values()) {
              if (now - remote.at < 2000) squad.push({ id: remote.id, x: remote.x, z: remote.z });
            }
          }
          for (const f of foes) {
            if (!f.alive) continue;
            f.cool = Math.max(0, f.cool - dt);
            let target = squad[0];
            let bestD = Infinity;
            for (const player of squad) {
              const d = (player.x - f.x) ** 2 + (player.z - f.z) ** 2;
              if (d < bestD) {
                bestD = d;
                target = player;
              }
            }
            const toX = target.x - f.x;
            const toZ = target.z - f.z;
            const dist = Math.hypot(toX, toZ) || 1;
            const ndx = toX / dist;
            const ndz = toZ / dist;
            const see = rayBoxes(f.x, 1.4, f.z, ndx, 0, ndz, dist, boxes) >= dist - 0.3;
            if (dist > 1.1) {
              const speed = 3.2;
              let step = resolveMove(f.x, f.z, ndx * speed * dt, ndz * speed * dt, FOE_R, boxes);
              if (Math.hypot(step.x - f.x, step.z - f.z) < 0.001) {
                // Try X axis slide along corridor
                const stepX = resolveMove(f.x, f.z, ndx * speed * dt, 0, FOE_R, boxes);
                if (Math.hypot(stepX.x - f.x, stepX.z - f.z) > 0.001) {
                  step = stepX;
                } else {
                  // Try Z axis slide along corridor
                  const stepZ = resolveMove(f.x, f.z, 0, ndz * speed * dt, FOE_R, boxes);
                  if (Math.hypot(stepZ.x - f.x, stepZ.z - f.z) > 0.001) {
                    step = stepZ;
                  } else {
                    // Try perpendicular corridor turn
                    const perpA = resolveMove(f.x, f.z, -ndz * speed * dt, ndx * speed * dt, FOE_R, boxes);
                    if (Math.hypot(perpA.x - f.x, perpA.z - f.z) > 0.001) {
                      step = perpA;
                    } else {
                      const perpB = resolveMove(f.x, f.z, ndz * speed * dt, -ndx * speed * dt, FOE_R, boxes);
                      if (Math.hypot(perpB.x - f.x, perpB.z - f.z) > 0.001) {
                        step = perpB;
                      }
                    }
                  }
                }
              }
              f.x = step.x;
              f.z = step.z;
            }
            if (target.id === "self") {
              const gapX = px - f.x;
              const gapZ = pz - f.z;
              const gap = Math.hypot(gapX, gapZ);
              if (gap < 0.95 && gap > 0.001) {
                const push = (0.95 - gap) / gap;
                const away = resolveMove(px, pz, gapX * push, gapZ * push, RADIUS, boxes);
                px = away.x;
                pz = away.z;
                const back = resolveMove(f.x, f.z, -gapX * push, -gapZ * push, FOE_R, boxes);
                f.x = back.x;
                f.z = back.z;
                if (boo <= 0) {
                  boo = 0.7;
                  sting(8);
                }
              }
            } else if (dist < 0.95 && f.cool <= 0) {
              f.cool = 0.7;
              netRef.current.send({ k: "ouch", dmg: 8 }, target.id);
            }
            f.mesh.position.set(f.x, 0, f.z);
            f.mesh.lookAt(target.x, 0, target.z);
            if (see && dist < 22 && f.cool <= 0) {
              f.cool = 1.45;
              const spread = (Math.random() - 0.5) * 0.22;
              const syaw = Math.atan2(ndx, ndz) + spread;
              const sdx = Math.sin(syaw);
              const sdz = Math.cos(syaw);
              const blocked = rayBoxes(f.x, 1.4, f.z, sdx, 0, sdz, dist, boxes);
              trace(f.x, 1.4, f.z, f.x + sdx * Math.min(dist, blocked), 1.45, f.z + sdz * Math.min(dist, blocked), true);
              if (blocked >= dist - 0.4 && Math.abs(spread) < 0.09) {
                if (target.id === "self") sting(12);
                else netRef.current.send({ k: "ouch", dmg: 12 }, target.id);
              }
            }
          }
        } else {
          for (const f of foes) {
            if (!f.alive) continue;
            f.mesh.position.set(f.x, 0, f.z);
          }
        }
        boo = Math.max(0, boo - dt);

        if (aliveFoes <= 0 && phaseRef.current === "play") {
          setPhaseBoth("won");
          sfx.win();
          try {
            document.exitPointerLock();
          } catch {
            /* ignore */
          }
        } else if (hp <= 0 && phaseRef.current === "play") {
          hp = 0;
          setPhaseBoth("lost");
          sfx.lose();
          pushHud(true);
          try {
            document.exitPointerLock();
          } catch {
            /* ignore */
          }
        }
      } else {
        vel.x *= Math.exp(-10 * dt);
        vel.z *= Math.exp(-10 * dt);
      }

      kick = Math.max(0, kick - dt * 6);
      recoil = Math.max(0, recoil - dt * 0.55);
      const net = netRef.current;
      if (net.enabled && (playing || phaseRef.current === "paused")) {
        if (now - lastMe > 50) {
          lastMe = now;
          net.broadcast({ k: "me", x: px, z: pz, yaw, pitch, hp, name: net.name });
        }
        if (net.isHost && now - lastFoeSend > 100) {
          lastFoeSend = now;
          net.broadcast({
            k: "foes",
            map: arena.id,
            foes: foes.map((foe) => ({ x: foe.x, z: foe.z, hp: foe.hp, alive: foe.alive })),
          });
        }
      }
      const seen = new Set<string>();
      for (const remote of net.remotes.values()) {
        seen.add(remote.id);
        const group = ensureFriend(remote.id);
        const fresh = now - remote.at < 2500;
        group.visible = fresh;
        if (!fresh) continue;
        group.position.set(remote.x, 0, remote.z);
        group.rotation.y = remote.yaw;
      }
      for (const [id, group] of friends) {
        if (!seen.has(id)) group.visible = false;
      }
      const lookDx = yaw - prevYaw;
      const lookDy = pitch - prevPitch;
      prevYaw = yaw;
      prevPitch = pitch;
      swayX += (-lookDx * 0.55 - swayX) * Math.min(1, dt * 8);
      swayY += (lookDy * 0.35 - swayY) * Math.min(1, dt * 8);
      const moving = Math.hypot(vel.x, vel.z);
      const bob = Math.sin(now * 0.012) * Math.min(0.025, moving * 0.0035);
      gun.position.set(0.16 + swayX * 0.4, -0.26 + swayY * 0.4 + bob, -0.48 + kick * 0.08);
      gun.rotation.y = -0.12 - swayX * 0.35;
      gun.rotation.z = -swayX * 0.25;
      gun.rotation.x = -0.04 - kick * 0.4;
      camera.position.set(px, EYE, pz);
      if (phaseRef.current === "menu") {
        yaw = arena.spawn.yaw + Math.sin(now * 0.0004) * 0.18;
        pitch = -0.06;
      }
      camera.rotation.y = yaw;
      camera.rotation.x = pitch + recoil;
      camera.rotation.z = 0;

      for (const t of tracers) {
        if (t.life <= 0) continue;
        t.life -= dt;
        if (t.life <= 0) t.line.visible = false;
      }
      if (hurtUntil && performance.now() > hurtUntil) {
        hurtUntil = 0;
        if (!dead) setHurt(false);
      }
      gl.render(scene, camera);

      if (mapCanvasRef.current && arena) {
        const mctx = mapCanvasRef.current.getContext("2d");
        if (mctx) {
          drawMinimap(mctx, px, pz, yaw, arena, foes, Array.from(net.remotes.values()));
        }
      }
    };
    gl.setAnimationLoop(frame);

    return () => {
      dead = true;
      gl.setAnimationLoop(null);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
      ro.disconnect();
      document.removeEventListener("mousemove", onMouse);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("pointerlockchange", onLock);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      if (window.__controlsTest) delete window.__controlsTest;
      for (const g of geos) g.dispose();
      for (const m of materials) m.dispose();
      gl.dispose();
      sfx.dispose();
    };
  }, []);

  const showHud = phase === "play" || phase === "paused" || phase === "won" || phase === "lost";
  const hpPercent = Math.max(0, Math.min(100, hud.hp));
  const isCriticalHp = hud.hp < 30;

  return (
    <div className={phase === "play" ? "game-root is-play" : "game-root"}>
      <canvas ref={canvasRef} className="view" />
      <div className={hurt ? "vignette on" : "vignette"} aria-hidden="true" />
      
      {/* Modern esports-grade crosshair with hitmarker */}
      {phase === "play" ? (
        <div className="crosshair" aria-hidden="true">
          <div className="crosshair-dot" />
          <div className="crosshair-line crosshair-t" />
          <div className="crosshair-line crosshair-b" />
          <div className="crosshair-line crosshair-l" />
          <div className="crosshair-line crosshair-r" />
          <div className={hitMarker ? "hitmarker active" : "hitmarker"} />
        </div>
      ) : null}

      {/* Modern Tactical Glassmorphic HUD */}
      <div className={showHud ? "hud" : "hud hud-quiet"}>
        <div className="hud-top">
          <div className="stack">
            <div className="stack-row">
              {/* Hostile Threat Counter */}
              <div className="chip chip-hot">
                <Skull aria-hidden="true" />
                <span>
                  {hud.foes} / {hud.total} HOSTILES
                </span>
              </div>

              {/* Multiplayer Frequency Badge */}
              {room ? (
                <div className="chip chip-neon">
                  <Users className="w-4 h-4 text-[var(--color-neon-blue)]" aria-hidden="true" />
                  <span className="font-mono">{room}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-white/10">{connected.length + 1} SQUAD</span>
                </div>
              ) : null}

              {/* Health integrity chip */}
              <div className={`chip hp-chip ${isCriticalHp ? "border-red-500/50" : ""}`}>
                <Shield className={`w-4 h-4 ${isCriticalHp ? "text-red-500 animate-pulse" : "text-emerald-400"}`} />
                <div className={`hp ${isCriticalHp ? "hp-critical" : ""}`} aria-label={`Health ${hud.hp}`}>
                  <span style={{ width: `${hpPercent}%` }} />
                </div>
                <span className={isCriticalHp ? "text-red-400 font-bold" : ""}>{hud.hp}</span>
              </div>
            </div>

            {/* Tactical Objective Callout */}
            {phase === "play" ? (
              <div className="objective">
                <span className="objective-tag">{hud.map}</span>
                <span>Purge all hostiles from the labyrinth corridors.</span>
              </div>
            ) : null}
          </div>

          <div className="stack stack-end">
            {phase === "play" ? (
              <div className="minimap-wrap">
                <canvas ref={mapCanvasRef} width={180} height={180} className="minimap-canvas" />
                <div className="minimap-badge">TACTICAL RADAR</div>
              </div>
            ) : null}
            {phase === "play" ? (
              <button type="button" className="icon-btn" onClick={() => api.current.pause()} aria-label="Pause Mission">
                <Pause />
              </button>
            ) : null}
          </div>
        </div>

        {phase === "play" && lookHint ? (
          <p className="look-hint touch-only">Drag right side to aim • Tap Fire to shoot</p>
        ) : (
          <span />
        )}
      </div>

      {/* Overlays: Paused / Victory / Defeat */}
      {phase === "paused" || phase === "won" || phase === "lost" ? (
        <div className="scrim">
          {phase === "paused" ? (
            <section className="card">
              <p className="kicker">Tactical Hold</p>
              <h1>Mission Paused</h1>
              {room ? (
                <p className="code-line">
                  Squad Frequency: <strong>{room}</strong>
                </p>
              ) : null}
              <p>The labyrinth figures remain frozen while in tactical hold.</p>
              <div className="actions">
                <button type="button" className="btn" onClick={() => api.current.resume()}>
                  <Play className="w-5 h-5 fill-current" />
                  Resume Mission
                </button>
                {room ? (
                  <button type="button" className="btn btn-ghost" onClick={copyInvite}>
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" /> Link Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" /> Copy Squad Invite Link
                      </>
                    )}
                  </button>
                ) : null}
                <button type="button" className="btn btn-ghost" onClick={() => api.current.menu()}>
                  Abort to Headquarters
                </button>
              </div>
            </section>
          ) : null}

          {phase === "won" ? (
            <section className="card card-won">
              <p className="kicker text-emerald-400">// MISSION SUCCESSFUL</p>
              <h1 className="text-emerald-300">Sector Purged</h1>
              <p>
                Outstanding work, Operative. All hostile entities in the {hud.map} labyrinth have been neutralized.
              </p>
              <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10 flex justify-between items-center text-sm">
                <div>
                  <div className="text-[var(--color-muted)] text-xs uppercase font-mono">Hostiles Eliminated</div>
                  <div className="text-xl font-bold text-emerald-400 mt-1">{hud.total} / {hud.total}</div>
                </div>
                <div>
                  <div className="text-[var(--color-muted)] text-xs uppercase font-mono">Health Integrity</div>
                  <div className="text-xl font-bold text-white mt-1">{hud.hp}%</div>
                </div>
              </div>
              <div className="actions">
                <button type="button" className="btn" onClick={() => api.current.next()}>
                  <Sparkles className="w-5 h-5" />
                  Advance to Next Sector
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => api.current.again()}>
                  <RotateCcw className="w-4 h-4" />
                  Replay Sector
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => api.current.menu()}>
                  Headquarters
                </button>
              </div>
            </section>
          ) : null}

          {phase === "lost" ? (
            <section className="card card-lost">
              <p className="kicker text-red-400">// OPERATIVE DOWN</p>
              <h1 className="text-red-400">Critical Failure</h1>
              <p>
                The hostiles overwhelmed your defenses. Use barricades for cover and keep moving to avoid line of sight.
              </p>
              <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10 flex justify-between items-center text-sm">
                <div>
                  <div className="text-[var(--color-muted)] text-xs uppercase font-mono">Hostiles Remaining</div>
                  <div className="text-xl font-bold text-red-400 mt-1">{hud.foes}</div>
                </div>
                <div>
                  <div className="text-[var(--color-muted)] text-xs uppercase font-mono">Sector</div>
                  <div className="text-xl font-bold text-white mt-1">{hud.map}</div>
                </div>
              </div>
              <div className="actions">
                <button type="button" className="btn" onClick={() => api.current.again()}>
                  <RotateCcw className="w-4 h-4" />
                  Redeploy & Try Again
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => api.current.menu()}>
                  Headquarters
                </button>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {/* Mobile Touch Controls */}
      <button type="button" className="swing" onClick={() => api.current.fire()}>
        Fire
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
      knob.style.transform = `translate(${x * 40}px, ${y * 40}px)`;
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
      const mag = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, mag / 46);
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
