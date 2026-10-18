import {
  corners,
  cylinder,
  insetPlan,
  pointsAt,
  ring,
  segment,
  sideSeam,
  slabOf,
  type Plan,
  type Point3,
} from "@/components/iso/iso-kit";
import { circleSection, prismAlong, runOf, sectionArc } from "../prism";
import { platformOf } from "../parts/platform";
import { sheaveOf, wrapPoints } from "../parts/pulley";
import { blockOf, guideRodsOf, pinsOf, platesOf, selectorRodsOf, yokeOf, type StackSpec } from "../parts/stack";
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
  YOKE_Z,
  plateZ,
} from "./view";

const join = (paths: string[]) => paths.filter(Boolean).join("");

const mirrorY = (plan: Plan): Plan => ({ ...plan, y: -plan.y - plan.d });

const STACK: StackSpec = {
  x: STACK_X,
  plate: PLATE,
  plateHeight: PLATE_H,
  pitch: PITCH,
  firstZ: PLATE_Z0,
  count: PLATES,
  rodY: ROD_Y,
  rodR: ROD_R,
  selectorR: SELECTOR_R,
  blockTop: BLOCK_TOP,
  yoke: YOKE,
  yokeZ: YOKE_Z,
  yokeHeight: YOKE_H,
  rodTop: HEAD_Z,
};

const BLOCK_ART = blockOf(BLOCK, BLOCK_Z, BLOCK_H, P);

// ---------------------------------------------------------------- base

export const BASE_ART = {
  ...platformOf({ plan: BASE, height: BASE_H, footRadius: FOOT_R, footHeight: FOOT_H, footInset: 16 }, P),
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
  block: BLOCK_ART.solid,
  blockSeam: BLOCK_ART.seam,
  blockScrews: BLOCK_ART.screws,
  rods: guideRodsOf(STACK, P),
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

export const PLATE_ART = platesOf(STACK, P);
export const YOKE_ART = yokeOf(STACK, P);
export const ROD_ART = selectorRodsOf(STACK, P);

/** The pin, plus the lanyard that keeps it from being left on the floor. */
export const PIN_ART = pinsOf(STACK, P).map((pin, index) => {
  const z = plateZ(index) + PLATE_H / 2;
  const face = PLATE.x + PLATE.w;
  return {
    ...pin,
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

const sheave = (centre: Point3) =>
  sheaveOf(
    {
      centre,
      radius: SHEAVE_R,
      half: SHEAVE_HALF,
      cheekHalf: CHEEK_HALF,
      mountZ: HEAD_TOP,
      mountHeight: BOOM_Z - HEAD_TOP,
      hubRadius: 2.6,
    },
    P,
  );

export const REAR_ART = sheave(REAR);
export const FRONT_ART = sheave(FRONT);

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

const arc = (centre: Point3, from: number, to: number) =>
  runOf(wrapPoints(centre, SHEAVE_R, from, to), P);

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
