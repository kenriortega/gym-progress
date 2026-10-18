import {
  corners,
  cylinder,
  haloOf,
  insetPlan,
  planOutline,
  pointsAt,
  ring,
  segment,
  sideRing,
  sideSeam,
  slabOf,
  type Flat,
  type Plan,
  type Point3,
  type SolidPaths,
} from "@/components/iso/iso-kit";
import { circleSection, prismAlong, runOf, sectionArc } from "./prism";
import {
  BAR_HALF,
  BAR_R,
  BAR_X,
  BAR_Z,
  BASE,
  BASE_H,
  BLOCK,
  BLOCK_H,
  BLOCK_TOP,
  BLOCK_Z,
  BOOM,
  BOOM_H,
  BOOM_Z,
  BORE_R,
  CABLE_TOP,
  CHEEK_HALF,
  CLEVIS_TOP,
  FOOT_H,
  FOOT_R,
  FRONT,
  GRIP_R,
  HEAD,
  HEAD_H,
  HEAD_TOP,
  HEAD_Z,
  P,
  PITCH,
  PLATE,
  PLATES,
  PLATE_H,
  PLATE_Z0,
  REAR,
  RISER,
  ROD_R,
  ROD_Y,
  ROD_Z0,
  SEAT_PAD,
  SEAT_PAD_H,
  SEAT_POST,
  SEAT_Z,
  SELECTOR_R,
  SHEAVE_HALF,
  SHEAVE_R,
  STACK_X,
  THIGH_BAR_R,
  THIGH_POST,
  THIGH_R,
  THIGH_REACH,
  THIGH_X,
  THIGH_Z,
  UPRIGHT,
  UPRIGHT_TOP,
  UPRIGHT_Y,
  YOKE,
  YOKE_H,
  YOKE_TOP,
  YOKE_Z,
  plateZ,
} from "./view";

const join = (paths: string[]) => paths.filter(Boolean).join("");

const mirrorY = (plan: Plan): Plan => ({ ...plan, y: -plan.y - plan.d });

// ---------------------------------------------------------------- base

const FEET = corners(BASE, 16);

export const BASE_ART = {
  halo: haloOf(BASE, -BASE_H - FOOT_H, 2, P),
  feet: FEET.map(([x, y]) => cylinder(x, y, FOOT_R, -FOOT_H, FOOT_H, P, 20)),
  footRings: join(FEET.map(([x, y]) => ring(x, y, FOOT_R + 1.6, BASE_H, P, 24))),
  slab: slabOf(BASE, 0, BASE_H, P, 10, 1),
  groove: planOutline(insetPlan(BASE, 5), BASE_H, P, 10),
  screws: pointsAt(
    corners(BASE, 9).map(([x, y]) => [x, y, BASE_H] as Point3),
    P,
  ),
  plate: slabOf({ x: 46, y: -40, w: 36, d: 13, r: 2 }, BASE_H, 0.7, P, 4),
  plateRule: join(
    [-36, -33.5, -31].map((y) => segment([49, y, BASE_H + 0.7], [79, y, BASE_H + 0.7], P)),
  ),
  plateScrews: pointsAt(
    [
      [48, -38.4, BASE_H + 0.7],
      [80, -38.4, BASE_H + 0.7],
    ] as Point3[],
    P,
  ),
};

// ---------------------------------------------------------------- tower

const upright = (sign: 1 | -1) => (sign > 0 ? UPRIGHT : mirrorY(UPRIGHT));
const UPRIGHT_H = UPRIGHT_TOP - BASE_H;

export const TOWER_ART = {
  uprights: [upright(-1), upright(1)].map((plan) => slabOf(plan, BASE_H, UPRIGHT_H, P, 4, 0.7)),
  uprightSeams: join(
    [upright(-1), upright(1)].flatMap((plan) => [60, 130].map((z) => sideSeam(plan, z, P, 4))),
  ),
  uprightScrews: pointsAt(
    ([-1, 1] as const).flatMap((sign) =>
      [12, 0].map((dx) => [UPRIGHT.x + 6 + dx, sign * UPRIGHT_Y, UPRIGHT_TOP] as Point3),
    ),
    P,
  ),
  block: slabOf(BLOCK, BLOCK_Z, BLOCK_H, P, 6, 0.7),
  blockSeam: sideSeam(BLOCK, BLOCK_Z + 4.5, P, 6),
  blockScrews: pointsAt(
    corners(BLOCK, 6).map(([x, y]) => [x, y, BLOCK_TOP] as Point3),
    P,
  ),
  rods: [-ROD_Y, ROD_Y].map((y) => cylinder(STACK_X, y, ROD_R, ROD_Z0, HEAD_Z - ROD_Z0, P, 20)),
  head: slabOf(HEAD, HEAD_Z, HEAD_H, P, 6, 0.9),
  headSeam: sideSeam(HEAD, HEAD_Z + 4, P, 6),
  bore: join([ring(STACK_X, 0, BORE_R, HEAD_TOP, P, 28), ring(STACK_X, 0, BORE_R + 2.2, HEAD_TOP, P, 28)]),
  headScrews: pointsAt(
    corners(HEAD, 6).map(([x, y]) => [x, y, HEAD_TOP] as Point3),
    P,
  ),
  riser: slabOf(RISER, HEAD_TOP, BOOM_Z - HEAD_TOP, P, 4, 0.6),
  riserSeam: sideSeam(RISER, HEAD_TOP + 10, P, 4),
};

// ---------------------------------------------------------------- the stack

const plateHoles = (z: number) =>
  join([
    ring(STACK_X, -ROD_Y, ROD_R + 0.9, z + PLATE_H, P, 18),
    ring(STACK_X, ROD_Y, ROD_R + 0.9, z + PLATE_H, P, 18),
    ring(STACK_X, 0, SELECTOR_R + 1, z + PLATE_H, P, 20),
  ]);

export interface PlateArt {
  solid: SolidPaths;
  seam: string;
  holes: string;
  pinHole: string;
  edge: string;
}

export const PLATE_ART: PlateArt[] = Array.from({ length: PLATES }, (_, index) => {
  const z = plateZ(index);
  return {
    solid: slabOf(PLATE, z, PLATE_H, P, 6, 0.5),
    seam: sideSeam(PLATE, z + PLATE_H / 2, P, 6),
    holes: plateHoles(z),
    pinHole: sideRing([PLATE.x + PLATE.w, 0, z + PLATE_H / 2], 1.9, "x", P, 18),
    edge: sideSeam(insetPlan(PLATE, 2.4), z + PLATE_H - 0.9, P, 6),
  };
});

// The carrier: the top plate the cable pulls on, with its eye.
export const YOKE_ART = {
  solid: slabOf(YOKE, YOKE_Z, YOKE_H, P, 6, 0.8),
  seam: sideSeam(YOKE, YOKE_Z + YOKE_H / 2, P, 6),
  screws: pointsAt(
    corners(YOKE, 6).map(([x, y]) => [x, y, YOKE_TOP] as Point3),
    P,
  ),
  holes: join([
    ring(STACK_X, -ROD_Y, ROD_R + 0.9, YOKE_TOP, P, 18),
    ring(STACK_X, ROD_Y, ROD_R + 0.9, YOKE_TOP, P, 18),
  ]),
  eye: cylinder(STACK_X, 0, 2.8, YOKE_TOP, 3, P, 16),
  eyeRing: ring(STACK_X, 0, 1.2, YOKE_TOP + 3, P, 14),
};

/** The selector rod, cut at the plate the pin sits in: below that it is inside the stack. */
export const ROD_ART: SolidPaths[] = Array.from({ length: PLATES }, (_, pin) => {
  const bottom = pin === 0 ? BLOCK_TOP : plateZ(pin - 1) + PLATE_H;
  return cylinder(STACK_X, 0, SELECTOR_R, bottom, YOKE_Z - bottom, P, 20);
});

/** The pin: a shaft through the plate and its knurled knob, the one lit part. */
export const PIN_ART = Array.from({ length: PLATES }, (_, pin) => {
  const z = plateZ(pin) + PLATE_H / 2;
  const face = PLATE.x + PLATE.w;
  return {
    shaft: prismAlong("x", circleSection(0, z, 1.7, 20), face - 7, face + 8, P),
    knob: prismAlong("x", circleSection(0, z, 3.4, 24), face + 8, face + 12.5, P),
    collar: sectionArc("x", circleSection(0, z, 3.4, 24), face + 10.2, P),
    lanyard: runOf(
      [
        [face + 12.5, 0, z],
        [face + 15, 2.5, z - 3],
        [face + 14, 5.5, z - 9],
      ],
      P,
    ),
  };
});

// ---------------------------------------------------------------- pulleys

function wheel(centre: Point3, mountZ: number, mountH: number) {
  const [cx, , cz] = centre;
  const flange = (from: number, to: number) => prismAlong("y", circleSection(cx, cz, SHEAVE_R, 44), from, to, P);
  return {
    cheeks: [-CHEEK_HALF - 2.4, CHEEK_HALF].map((y) =>
      slabOf({ x: cx - 3.6, y, w: 7.2, d: 2.4, r: 3 }, mountZ, mountH, P, 6, 0.4),
    ),
    far: flange(-SHEAVE_HALF, -SHEAVE_HALF + 1.2),
    core: prismAlong("y", circleSection(cx, cz, SHEAVE_R - 1.7, 44), -SHEAVE_HALF + 1.2, SHEAVE_HALF - 1.2, P),
    near: flange(SHEAVE_HALF - 1.2, SHEAVE_HALF),
    groove: sectionArc("y", circleSection(cx, cz, SHEAVE_R - 1.7, 44), SHEAVE_HALF - 1.2, P),
    hub: prismAlong("y", circleSection(cx, cz, 2.6, 20), -SHEAVE_HALF - 0.8, SHEAVE_HALF + 0.8, P),
    axle: [[cx, 0, cz]].map((point) => point as Point3),
    bolts: pointsAt(
      [-CHEEK_HALF - 1.2, CHEEK_HALF + 1.2].map((y) => [cx, y, cz] as Point3),
      P,
    ) as Flat[],
  };
}

export const REAR_ART = wheel(REAR, HEAD_TOP, BOOM_Z - HEAD_TOP);
export const FRONT_ART = wheel(FRONT, HEAD_TOP, BOOM_Z - HEAD_TOP);

// ---------------------------------------------------------------- boom

export const BOOM_ART = {
  slab: slabOf(BOOM, BOOM_Z, BOOM_H, P, 6, 1),
  seam: sideSeam(BOOM, BOOM_Z + BOOM_H / 2, P, 6),
  screws: pointsAt(
    [-4, 20, 48, 76, 104].map((x) => [x, 0, BOOM_Z + BOOM_H] as Point3),
    P,
  ),
};

// ---------------------------------------------------------------- cable

const arc = (centre: Point3, from: number, to: number, steps = 16) =>
  runOf(
    Array.from({ length: steps + 1 }, (_, index) => {
      const angle = from + ((to - from) * index) / steps;
      return [centre[0] + SHEAVE_R * Math.cos(angle), 0, centre[2] + SHEAVE_R * Math.sin(angle)] as Point3;
    }),
    P,
  );

export const CABLE_ART = {
  rearWrap: arc(REAR, Math.PI, Math.PI / 2),
  frontWrap: arc(FRONT, Math.PI / 2, 0),
  span: segment([REAR[0], 0, CABLE_TOP], [FRONT[0], 0, CABLE_TOP], P),
};

export const CABLE_UP_TOP: Point3 = [STACK_X, 0, REAR[2]];
export const CABLE_DOWN_TOP: Point3 = [BAR_X, 0, FRONT[2]];

// ---------------------------------------------------------------- seat

const holeColumn = (plan: Plan, from: number, to: number, step: number) =>
  pointsAt(
    Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, index) => [
      plan.x + plan.w,
      0,
      from + index * step,
    ] as Point3),
    P,
  );

export const SEAT_ART = {
  post: slabOf(SEAT_POST, BASE_H, SEAT_Z - 4 - BASE_H, P, 5, 0.6),
  postSeam: sideSeam(SEAT_POST, 30, P, 5),
  holes: holeColumn(SEAT_POST, 20, 44, 6),
  collar: slabOf(insetPlan(SEAT_POST, -3), SEAT_Z - 10, 6, P, 5, 0.4),
  bracket: slabOf(
    { x: SEAT_POST.x - 6, y: -14, w: SEAT_POST.w + 12, d: 28, r: 3 },
    SEAT_Z - 4,
    4,
    P,
    5,
  ),
  pad: slabOf(SEAT_PAD, SEAT_Z, SEAT_PAD_H, P, 12, 1.4),
  padSeam: sideSeam(SEAT_PAD, SEAT_Z + SEAT_PAD_H / 2, P, 12),
  padRivets: pointsAt(
    corners(SEAT_PAD, 9).map(([x, y]) => [x, y, SEAT_Z + SEAT_PAD_H] as Point3),
    P,
  ),
};

export const THIGH_ART = {
  post: slabOf(THIGH_POST, BASE_H, THIGH_Z - 8 - BASE_H, P, 5, 0.6),
  postSeam: sideSeam(THIGH_POST, 30, P, 5),
  holes: holeColumn(THIGH_POST, 36, 66, 6),
  collar: slabOf(insetPlan(THIGH_POST, -3), THIGH_Z - 14, 7, P, 5, 0.4),
  bar: prismAlong("y", circleSection(THIGH_X, THIGH_Z, THIGH_BAR_R, 20), -THIGH_REACH, THIGH_REACH, P),
  pads: [
    prismAlong("y", circleSection(THIGH_X, THIGH_Z, THIGH_R, 32), -THIGH_REACH + 1, -10, P),
    prismAlong("y", circleSection(THIGH_X, THIGH_Z, THIGH_R, 32), 10, THIGH_REACH - 1, P),
  ],
  padRings: join([
    sectionArc("y", circleSection(THIGH_X, THIGH_Z, THIGH_R - 1.4, 32), -11.6, P),
    sectionArc("y", circleSection(THIGH_X, THIGH_Z, THIGH_R - 1.4, 32), 11.6, P),
  ]),
  knob: prismAlong("x", circleSection(0, THIGH_Z - 10.5, 3, 20), THIGH_POST.x + THIGH_POST.w + 1, THIGH_POST.x + THIGH_POST.w + 5, P),
};

// ---------------------------------------------------------------- the bar

const ringsAlong = (from: number, to: number, count: number, radius: number) =>
  join(
    Array.from({ length: count }, (_, index) =>
      sectionArc("y", circleSection(BAR_X, BAR_Z, radius, 24), from + ((to - from) * (index + 0.5)) / count, P),
    ),
  );

export const BAR_ART = {
  shaft: prismAlong("y", circleSection(BAR_X, BAR_Z, BAR_R, 24), -24, 24, P),
  grips: [
    prismAlong("y", circleSection(BAR_X, BAR_Z, GRIP_R, 26), -38, -24, P),
    prismAlong("y", circleSection(BAR_X, BAR_Z, GRIP_R, 26), 24, 38, P),
  ],
  caps: [
    prismAlong("y", circleSection(BAR_X, BAR_Z, GRIP_R + 0.9, 26), -BAR_HALF, -38, P),
    prismAlong("y", circleSection(BAR_X, BAR_Z, GRIP_R + 0.9, 26), 38, BAR_HALF, P),
  ],
  knurl: join([ringsAlong(-36, -26, 4, GRIP_R - 0.3), ringsAlong(26, 36, 4, GRIP_R - 0.3)]),
  collars: join([
    sectionArc("y", circleSection(BAR_X, BAR_Z, GRIP_R, 26), -24.6, P),
    sectionArc("y", circleSection(BAR_X, BAR_Z, GRIP_R, 26), 24.6, P),
  ]),
  clevis: slabOf({ x: BAR_X - 3.6, y: -4.2, w: 7.2, d: 8.4, r: 1.2 }, BAR_Z, CLEVIS_TOP - BAR_Z, P, 4, 0.4),
  swivel: cylinder(BAR_X, 0, 2.1, CLEVIS_TOP, 3, P, 16),
  swivelRing: ring(BAR_X, 0, 1.1, CLEVIS_TOP + 3, P, 14),
  pinDots: pointsAt([[BAR_X, -4.2, BAR_Z + 4.5] as Point3], P),
};

export const PITCH_GAP = PITCH - PLATE_H;
export const FIRST_PLATE_Z = PLATE_Z0;
