import {
  corners,
  insetPlan,
  pointsAt,
  ring,
  segment,
  sideSeam,
  slabOf,
  type Point3,
} from "@/components/iso/iso-kit";
import { barSection, circleSection, prismAlong, runOf, sectionArc } from "../prism";
import { platformOf } from "../parts/platform";
import { sheaveOf, wrapPoints } from "../parts/pulley";
import { blockOf, guideRodsOf, pinsOf, platesOf, selectorRodsOf, yokeOf, type StackSpec } from "../parts/stack";
import { DEGREES, TOUCH } from "./cam";
import {
  ARM_Y,
  BACK_FROM,
  BACK_HALF,
  BACK_TO,
  BACK_Y,
  BASE,
  BASE_H,
  BLOCK,
  BLOCK_H,
  BLOCK_TOP,
  BLOCK_Z,
  EYE_TOP,
  FOOT_H,
  FOOT_R,
  HEAD,
  HEAD_H,
  HEAD_TOP,
  HEAD_Z,
  IDLER,
  IDLER_HALF,
  IDLER_R,
  IDLER_TOUCH,
  P,
  PITCH,
  PIVOT,
  PLATE,
  PLATES,
  PLATE_H,
  PLATE_Z0,
  ROD_R,
  ROD_Y,
  SEAT_PAD,
  SEAT_PAD_H,
  SEAT_POST,
  SEAT_Z,
  SELECTOR_R,
  SHAFT_R,
  SIDE,
  STACK_X,
  UPRIGHT_A,
  UPRIGHT_B,
  UPRIGHT_TOP,
  YOKE,
  YOKE_H,
  YOKE_Z,
} from "./view";

const join = (paths: string[]) => paths.filter(Boolean).join("");

const STACK: StackSpec = {
  x: STACK_X,
  y: SIDE,
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
  ...platformOf({ plan: BASE, height: BASE_H, footRadius: FOOT_R, footHeight: FOOT_H, footInset: 15 }, P),
  plate: slabOf({ x: 44, y: -34, w: 32, d: 11, r: 2 }, BASE_H, 0.7, P, 4),
  plateRule: join([-31, -28.8, -26.6].map((y) => segment([47, y, BASE_H + 0.7], [73, y, BASE_H + 0.7], P))),
};

// ---------------------------------------------------------------- tower

export const TOWER_ART = {
  uprights: [UPRIGHT_A, UPRIGHT_B].map((plan) => slabOf(plan, BASE_H, UPRIGHT_TOP - BASE_H, P, 4, 0.7)),
  uprightSeams: join([UPRIGHT_A, UPRIGHT_B].flatMap((plan) => [50, 104].map((z) => sideSeam(plan, z, P, 4)))),
  block: BLOCK_ART.solid,
  blockSeam: BLOCK_ART.seam,
  blockScrews: BLOCK_ART.screws,
  rods: guideRodsOf(STACK, P),
  head: slabOf(HEAD, HEAD_Z, HEAD_H, P, 6, 0.9),
  headSeam: sideSeam(HEAD, HEAD_Z + 4, P, 6),
  bore: ring(STACK_X, SIDE, 4, HEAD_TOP, P, 28),
  headScrews: pointsAt(
    corners(HEAD, 7).map(([x, y]) => [x, y, HEAD_TOP] as Point3),
    P,
  ),
  // The arm that carries the idler above the head.
  boom: slabOf(
    { x: IDLER[0] - 7, y: SIDE - 9, w: 14, d: 18, r: 3 },
    HEAD_TOP,
    IDLER[2] + IDLER_R + 6 - HEAD_TOP,
    P,
    4,
    0.5,
  ),
};

export const PLATE_ART = platesOf(STACK, P);
export const YOKE_ART = yokeOf(STACK, P);
export const ROD_ART = selectorRodsOf(STACK, P);
export const PIN_ART = pinsOf(STACK, P);

// ---------------------------------------------------------------- the idler

export const IDLER_ART = sheaveOf(
  {
    centre: IDLER,
    radius: IDLER_R,
    half: IDLER_HALF,
    cheekHalf: IDLER_HALF + 1.8,
    mountZ: HEAD_TOP,
    mountHeight: IDLER[2] + IDLER_R + 6 - HEAD_TOP,
    hubRadius: 2.4,
  },
  P,
);

/** From where the cable first touches the idler, round to the drop. */
export const IDLER_WRAP = runOf(
  wrapPoints(IDLER, IDLER_R, IDLER_TOUCH * DEGREES, Math.PI, 18).map(
    ([x, , z]) => [x, SIDE, z] as Point3,
  ),
  P,
);

export const DROP_FROM: Point3 = [STACK_X, SIDE, IDLER[2]];
export const EYE_AT: Point3 = [STACK_X, SIDE, EYE_TOP];
export const TOUCH_AT: Point3 = [TOUCH[0], SIDE, TOUCH[1]];

// ---------------------------------------------------------------- the pivot

export const PIVOT_ART = {
  // The cross shaft the arms and the cam all turn on.
  shaft: prismAlong("y", circleSection(PIVOT[0], PIVOT[1], SHAFT_R, 20), -ARM_Y - 6, SIDE + 6, P),
  housing: ([-1, 1] as const).map((side) =>
    prismAlong("y", circleSection(PIVOT[0], PIVOT[1], 8, 24), side * ARM_Y - 7, side * ARM_Y - 3, P),
  ),
  collar: join(
    ([-1, 1] as const).map((side) =>
      sectionArc("y", circleSection(PIVOT[0], PIVOT[1], 5.4, 20), side * ARM_Y - 3.4, P),
    ),
  ),
  // The post that holds the knee axis up off the floor.
  post: prismAlong(
    "y",
    barSection([PIVOT[0], BASE_H], [PIVOT[0], PIVOT[1] - 6], 7),
    -ARM_Y - 4,
    -ARM_Y + 4,
    P,
  ),
  postFar: prismAlong(
    "y",
    barSection([PIVOT[0], BASE_H], [PIVOT[0], PIVOT[1] - 6], 7),
    SIDE - 4,
    SIDE + 4,
    P,
  ),
  dot: pointsAt([[PIVOT[0], SIDE + 6, PIVOT[1]] as Point3], P),
};

// ---------------------------------------------------------------- the seat

export const SEAT_ART = {
  post: slabOf(SEAT_POST, BASE_H, SEAT_Z - 6 - BASE_H, P, 5, 0.6),
  postSeam: sideSeam(SEAT_POST, 24, P, 5),
  collar: slabOf(insetPlan(SEAT_POST, -3), SEAT_Z - 12, 7, P, 5, 0.4),
  pad: slabOf(SEAT_PAD, SEAT_Z, SEAT_PAD_H, P, 12, 1.4),
  padSeam: sideSeam(SEAT_PAD, SEAT_Z + SEAT_PAD_H / 2, P, 12),
  padRivets: pointsAt(
    corners(SEAT_PAD, 9).map(([x, y]) => [x, y, SEAT_Z + SEAT_PAD_H] as Point3),
    P,
  ),
  back: prismAlong("y", barSection(BACK_FROM, BACK_TO, BACK_HALF), -BACK_Y, BACK_Y, P),
  backSeam: runOf(
    [
      [BACK_FROM[0] - BACK_HALF - 0.4, 0, BACK_FROM[1]],
      [BACK_TO[0] - BACK_HALF - 0.4, 0, BACK_TO[1]],
    ],
    P,
  ),
  backRivets: pointsAt(
    ([-1, 1] as const).flatMap((side) =>
      [0.3, 0.72].map((t) => [
        BACK_FROM[0] + (BACK_TO[0] - BACK_FROM[0]) * t - BACK_HALF,
        side * (BACK_Y - 4),
        BACK_FROM[1] + (BACK_TO[1] - BACK_FROM[1]) * t,
      ] as Point3),
    ),
    P,
  ),
  footRing: ring(SEAT_POST.x + SEAT_POST.w / 2, 0, SEAT_POST.w / 2 + 3, BASE_H, P, 24),
};
