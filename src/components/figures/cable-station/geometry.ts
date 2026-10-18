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
import { circleSection, prismAlong, runOf, sectionArc } from "../prism";
import {
  BAR_HALF,
  BAR_R,
  BASE,
  BASE_H,
  BLOCK,
  BLOCK_H,
  BLOCK_TOP,
  BLOCK_Z,
  BORE_R,
  CABLE_TOP,
  CAP,
  CAP_H,
  CAP_Z,
  CARRIAGE_HALF,
  CARRIAGE_R,
  CARRIAGE_X,
  CHEEK_HALF,
  CLAMP,
  CLAMP_DROP,
  CLAMP_H,
  CLIP_H,
  DROP_X,
  FOOT_H,
  FOOT_R,
  FRONT,
  HANDLE_X,
  HEAD,
  HEAD_H,
  HEAD_TOP,
  HEAD_Z,
  HOLES,
  P,
  PLATE,
  PLATES,
  PLATE_H,
  RAIL,
  RAIL_TOP,
  RAIL_Z,
  REAR,
  ROD_R,
  ROD_Y,
  ROPE_DROP,
  ROPE_HALF,
  SELECTOR_R,
  SHEAVE_HALF,
  SHEAVE_R,
  STACK_X,
  UPRIGHT,
  UPRIGHT_TOP,
  YOKE,
  YOKE_H,
  YOKE_TOP,
  YOKE_Z,
  holeZ,
  plateZ,
} from "./view";

const join = (paths: string[]) => paths.filter(Boolean).join("");
const mirrorY = (plan: Plan): Plan => ({ ...plan, y: -plan.y - plan.d });

// ---------------------------------------------------------------- base

const FEET = corners(BASE, 15);

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
  plate: slabOf({ x: 36, y: -34, w: 30, d: 11, r: 2 }, BASE_H, 0.7, P, 4),
  plateRule: join([-31, -28.8, -26.6].map((y) => segment([39, y, BASE_H + 0.7], [63, y, BASE_H + 0.7], P))),
};

// ---------------------------------------------------------------- tower

const upright = (sign: 1 | -1) => (sign > 0 ? UPRIGHT : mirrorY(UPRIGHT));

export const TOWER_ART = {
  uprights: [upright(-1), upright(1)].map((plan) => slabOf(plan, BASE_H, UPRIGHT_TOP - BASE_H, P, 4, 0.7)),
  uprightSeams: join([upright(-1), upright(1)].flatMap((plan) => [62, 132].map((z) => sideSeam(plan, z, P, 4)))),
  block: slabOf(BLOCK, BLOCK_Z, BLOCK_H, P, 6, 0.7),
  blockSeam: sideSeam(BLOCK, BLOCK_Z + 4.5, P, 6),
  blockScrews: pointsAt(
    corners(BLOCK, 6).map(([x, y]) => [x, y, BLOCK_TOP] as Point3),
    P,
  ),
  rods: [-ROD_Y, ROD_Y].map((y) => cylinder(STACK_X, y, ROD_R, BLOCK_TOP, HEAD_Z - BLOCK_TOP, P, 20)),
  head: slabOf(HEAD, HEAD_Z, HEAD_H, P, 6, 0.9),
  headSeam: sideSeam(HEAD, HEAD_Z + 4, P, 6),
  bore: join([ring(STACK_X, 0, BORE_R, HEAD_TOP, P, 28), ring(DROP_X, 0, BORE_R, HEAD_TOP, P, 28)]),
  headScrews: pointsAt(
    corners(HEAD, 7).map(([x, y]) => [x, y, HEAD_TOP] as Point3),
    P,
  ),
  cap: slabOf(CAP, CAP_Z, CAP_H, P, 5, 0.8),
  capSeam: sideSeam(CAP, CAP_Z + CAP_H / 2, P, 5),
  capScrews: pointsAt(
    [-8, 10, 30].map((x) => [x, 0, CAP_Z + CAP_H] as Point3),
    P,
  ),
};

// ---------------------------------------------------------------- the stack

const plateHoles = (z: number) =>
  join([
    ring(STACK_X, -ROD_Y, ROD_R + 0.9, z + PLATE_H, P, 18),
    ring(STACK_X, ROD_Y, ROD_R + 0.9, z + PLATE_H, P, 18),
    ring(STACK_X, 0, SELECTOR_R + 1, z + PLATE_H, P, 20),
  ]);

export const PLATE_ART = Array.from({ length: PLATES }, (_, index) => {
  const z = plateZ(index);
  return {
    solid: slabOf(PLATE, z, PLATE_H, P, 6, 0.5),
    seam: sideSeam(PLATE, z + PLATE_H / 2, P, 6),
    edge: sideSeam(insetPlan(PLATE, 2.4), z + PLATE_H - 0.9, P, 6),
    holes: plateHoles(z),
    pinHole: sideRing([PLATE.x + PLATE.w, 0, z + PLATE_H / 2], 1.9, "x", P, 18),
  };
});

export const YOKE_ART = {
  solid: slabOf(YOKE, YOKE_Z, YOKE_H, P, 6, 0.8),
  seam: sideSeam(YOKE, YOKE_Z + YOKE_H / 2, P, 6),
  holes: join([
    ring(STACK_X, -ROD_Y, ROD_R + 0.9, YOKE_TOP, P, 18),
    ring(STACK_X, ROD_Y, ROD_R + 0.9, YOKE_TOP, P, 18),
  ]),
  screws: pointsAt(
    corners(YOKE, 6).map(([x, y]) => [x, y, YOKE_TOP] as Point3),
    P,
  ),
  eye: cylinder(STACK_X, 0, 2.8, YOKE_TOP, 3, P, 16),
  eyeRing: ring(STACK_X, 0, 1.2, YOKE_TOP + 3, P, 14),
};

export const ROD_ART: SolidPaths[] = Array.from({ length: PLATES }, (_, pin) => {
  const bottom = pin === 0 ? BLOCK_TOP : plateZ(pin - 1) + PLATE_H;
  return cylinder(STACK_X, 0, SELECTOR_R, bottom, YOKE_Z - bottom, P, 20);
});

export const PIN_ART = Array.from({ length: PLATES }, (_, pin) => {
  const z = plateZ(pin) + PLATE_H / 2;
  const face = PLATE.x + PLATE.w;
  return {
    shaft: prismAlong("x", circleSection(0, z, 1.7, 20), face - 7, face + 8, P),
    knob: prismAlong("x", circleSection(0, z, 3.4, 24), face + 8, face + 12.5, P),
    collar: sectionArc("x", circleSection(0, z, 3.4, 24), face + 10.2, P),
  };
});

// ---------------------------------------------------------------- pulleys

function wheel(centre: Point3, radius: number, half: number, cheekHalf: number, mountZ: number, mountH: number) {
  const [cx, , cz] = centre;
  const flange = (from: number, to: number) => prismAlong("y", circleSection(cx, cz, radius, 44), from, to, P);
  return {
    cheeks: [-cheekHalf - 2.4, cheekHalf].map((y) =>
      slabOf({ x: cx - 3.6, y, w: 7.2, d: 2.4, r: 3 }, mountZ, mountH, P, 6, 0.4),
    ),
    far: flange(-half, -half + 1.2),
    core: prismAlong("y", circleSection(cx, cz, radius - 1.7, 44), -half + 1.2, half - 1.2, P),
    near: flange(half - 1.2, half),
    groove: sectionArc("y", circleSection(cx, cz, radius - 1.7, 44), half - 1.2, P),
    hub: prismAlong("y", circleSection(cx, cz, 2.4, 20), -half - 0.8, half + 0.8, P),
    bolts: pointsAt(
      [-cheekHalf - 1.2, cheekHalf + 1.2].map((y) => [cx, y, cz] as Point3),
      P,
    ) as Flat[],
  };
}

export const REAR_ART = wheel(REAR, SHEAVE_R, SHEAVE_HALF, CHEEK_HALF, HEAD_TOP, CAP_Z - HEAD_TOP);
export const FRONT_ART = wheel(FRONT, SHEAVE_R, SHEAVE_HALF, CHEEK_HALF, HEAD_TOP, CAP_Z - HEAD_TOP);

// ---------------------------------------------------------------- the rail

const HOLE_X = RAIL.x + RAIL.w;

export const RAIL_ART = {
  post: slabOf(RAIL, RAIL_Z, RAIL_TOP - RAIL_Z, P, 4, 0.6),
  channel: join(
    [RAIL.y + 4, RAIL.y + RAIL.d - 4].map((y) =>
      segment([HOLE_X, y, RAIL_Z + 4], [HOLE_X, y, RAIL_TOP - 4], P),
    ),
  ),
  holes: pointsAt(
    Array.from({ length: HOLES }, (_, index) => [HOLE_X, 0, holeZ(index)] as Point3),
    P,
  ),
  ticks: join(
    Array.from({ length: HOLES }, (_, index) => index)
      .filter((index) => index % 2 === 0)
      .map((index) =>
        segment([HOLE_X, RAIL.y, holeZ(index)], [HOLE_X, RAIL.y + 5, holeZ(index)], P),
      ),
  ),
  foot: slabOf(insetPlan(RAIL, -4), RAIL_Z, 7, P, 4, 0.4),
};

// ---------------------------------------------------------------- the carriage
//
// Built once at z = 0 and lifted into place, because the whole point of the
// machine is that it slides: everything it carries has to move together.

const CARRIAGE_WHEEL = wheel(
  [CARRIAGE_X, 0, 0],
  CARRIAGE_R,
  CARRIAGE_HALF,
  CARRIAGE_HALF + 1.8,
  -CLAMP_DROP,
  CLAMP_H,
);

const pinZ = -11;

export const CARRIAGE_ART = {
  clamp: slabOf(CLAMP, -CLAMP_DROP, CLAMP_H, P, 5, 0.6),
  clampSeam: sideSeam(CLAMP, -CLAMP_DROP + CLAMP_H / 2, P, 5),
  clampScrews: pointsAt(
    corners(CLAMP, 5).map(([x, y]) => [x, y, -CLAMP_DROP + CLAMP_H] as Point3),
    P,
  ),
  wheel: CARRIAGE_WHEEL,
  // The cable rides over the crown: down the rail on one side, down to the
  // handle on the other.
  wrap: runOf(
    Array.from({ length: 25 }, (_, index) => {
      const angle = Math.PI - (index / 24) * Math.PI;
      return [CARRIAGE_X + CARRIAGE_R * Math.cos(angle), 0, CARRIAGE_R * Math.sin(angle)] as Point3;
    }),
    P,
  ),
  pinShaft: prismAlong("x", circleSection(0, pinZ, 1.6, 20), CLAMP.x + 6, CLAMP.x + CLAMP.w + 7, P),
  pinKnob: prismAlong("x", circleSection(0, pinZ, 3.2, 24), CLAMP.x + CLAMP.w + 7, CLAMP.x + CLAMP.w + 11, P),
  pinCollar: sectionArc("x", circleSection(0, pinZ, 3.2, 24), CLAMP.x + CLAMP.w + 9, P),
};

// ---------------------------------------------------------------- the handles
//
// Also built at z = 0 and lifted: what changes between the four exercises is
// only what hangs here.

export const CLIP_ART = {
  body: slabOf({ x: HANDLE_X - 2.6, y: -3, w: 5.2, d: 6, r: 1 }, 0, CLIP_H, P, 4, 0.3),
  ring: ring(HANDLE_X, 0, 1.4, CLIP_H, P, 14),
  bolt: pointsAt([[HANDLE_X, -3, CLIP_H / 2] as Point3], P),
};

export const BAR_ART = {
  shaft: prismAlong("y", circleSection(HANDLE_X, -2, BAR_R, 24), -BAR_HALF + 4, BAR_HALF - 4, P),
  caps: [
    prismAlong("y", circleSection(HANDLE_X, -2, BAR_R + 0.9, 24), -BAR_HALF, -BAR_HALF + 4, P),
    prismAlong("y", circleSection(HANDLE_X, -2, BAR_R + 0.9, 24), BAR_HALF - 4, BAR_HALF, P),
  ],
  knurl: join(
    [-12, -8, -4, 4, 8, 12].map((y) => sectionArc("y", circleSection(HANDLE_X, -2, BAR_R - 0.3, 20), y, P)),
  ),
  bracket: slabOf({ x: HANDLE_X - 2, y: -3, w: 4, d: 6, r: 1 }, -2, 2.6, P, 3),
};

export const ROPE_ART = {
  strands: join(
    ([-1, 1] as const).map((side) =>
      runOf(
        [
          [HANDLE_X, 0, -1],
          [HANDLE_X + 1.5, side * ROPE_HALF * 0.5, -ROPE_DROP * 0.55],
          [HANDLE_X + 2.5, side * ROPE_HALF, -ROPE_DROP],
        ],
        P,
      ),
    ),
  ),
  knots: ([-1, 1] as const).map((side) =>
    prismAlong("x", circleSection(side * ROPE_HALF, -ROPE_DROP - 3, 3, 22), HANDLE_X + 1, HANDLE_X + 4, P),
  ),
  collar: prismAlong("x", circleSection(0, -1.5, 2.2, 20), HANDLE_X - 1.6, HANDLE_X + 1.6, P),
};

export const DROP_TOP: Point3 = [DROP_X, 0, 0];

// ---------------------------------------------------------------- cable, fixed part

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
  span: segment([REAR[0], 0, CABLE_TOP], [FRONT[0], 0, CABLE_TOP], P),
  frontWrap: arc(FRONT, Math.PI / 2, 0),
};
