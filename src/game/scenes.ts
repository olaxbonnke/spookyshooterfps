export type SceneId = "grass" | "brick" | "palace" | "cellar";

export type SceneTheme = {
  id: SceneId;
  name: string;
  fog: number;
  background: number;
  hemiSky: number;
  hemiGround: number;
  hemi: number;
  sun: number;
  sunLevel: number;
  wallA: number;
  wallB: number;
  cap: number;
  floorA: number;
  floorB: number;
  ground: number;
  roof: number;
  veil: number;
  lantern: number;
};

export const SCENES: SceneTheme[] = [
  {
    id: "grass",
    name: "Grass",
    fog: 0x15201a,
    background: 0x101812,
    hemiSky: 0x8fb59a,
    hemiGround: 0x1c2a20,
    hemi: 1.05,
    sun: 0xd5e6c8,
    sunLevel: 0.42,
    wallA: 0x3f6a48,
    wallB: 0x527a52,
    cap: 0x24382a,
    floorA: 0x2d5a38,
    floorB: 0x245032,
    ground: 0x16301c,
    roof: 0x18241c,
    veil: 0xff9a3c,
    lantern: 0xffb15a,
  },
  {
    id: "brick",
    name: "Brick",
    fog: 0x241614,
    background: 0x1a100e,
    hemiSky: 0xc49a8c,
    hemiGround: 0x2a1614,
    hemi: 1.05,
    sun: 0xf0c2ae,
    sunLevel: 0.4,
    wallA: 0x8d4638,
    wallB: 0x6e342c,
    cap: 0x3a201c,
    floorA: 0x4a342c,
    floorB: 0x3e2c26,
    ground: 0x2a1814,
    roof: 0x2a1614,
    veil: 0xff6a2a,
    lantern: 0xff8a3a,
  },
  {
    id: "palace",
    name: "Palace",
    fog: 0x1a1624,
    background: 0x14121c,
    hemiSky: 0xb7b0d4,
    hemiGround: 0x221c2e,
    hemi: 1.05,
    sun: 0xf0e2c4,
    sunLevel: 0.4,
    wallA: 0x534c78,
    wallB: 0x3e3a58,
    cap: 0xd4b36a,
    floorA: 0x3a3648,
    floorB: 0x312e40,
    ground: 0x221c2c,
    roof: 0x1c1826,
    veil: 0xd2c2ff,
    lantern: 0xffc27a,
  },
  {
    id: "cellar",
    name: "Cellar",
    fog: 0x24180f,
    background: 0x1a120c,
    hemiSky: 0xd2a070,
    hemiGround: 0x2a1a10,
    hemi: 1,
    sun: 0xf0c090,
    sunLevel: 0.36,
    wallA: 0x7a5432,
    wallB: 0x5c3e24,
    cap: 0x3a2416,
    floorA: 0x4a321f,
    floorB: 0x3c2818,
    ground: 0x2a1a10,
    roof: 0x2a1c12,
    veil: 0xff7a18,
    lantern: 0xff6a1a,
  },
];

export function findScene(id: SceneId) {
  return SCENES.find((scene) => scene.id === id) ?? SCENES[0];
}
