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
import {
  BACK_FROM,
  BACK_HALF,
  BACK_TO,
  BACK_Y,
  BASE,
  BASE_H,
  CATCH_S,
  FOOT_H,
  FOOT_HALF,
  FOOT_LONG,
  FOOT_R,
  FOOT_Y,
  HORN_LONG,
  HORN_R,
  HORN_Y,
  NOTCHES,
  NOTCH_FROM,
  NOTCH_STEP,
  P,
  PAD_Y,
  PLATES_MAX,
  PLATE_R,
  PLATE_T,
  RAIL_FOOT,
  RAIL_HALF,
  RAIL_HEAD,
  RAIL_LENGTH,
  RAIL_Y,
  SEAT_POST,
  SEAT_Z,
  SLED_HALF,
  SLED_LONG,
  SLED_OFF,
  SLED_REST,
  SLED_Y,
  onRail,
} from "./view";

const join = (paths: string[]) => paths.filter(Boolean).join("");

// ---------------------------------------------------------------- base

export const BASE_ART = {
  ...platformOf({ plan: BASE, height: BASE_H, footRadius: FOOT_R, footHeight: FOOT_H, footInset: 16 }, P),
  plate: slabOf({ x: 4, y: -40, w: 34, d: 12, r: 2 }, BASE_H, 0.7, P, 4),
  plateRule: join([-36, -33.5, -31].map((y) => segment([7, y, BASE_H + 0.7], [35, y, BASE_H + 0.7], P))),
};

// ---------------------------------------------------------------- the rails
//
// Everything on this machine is placed along one line, so the rails are the
// first thing built and the rest hangs off `onRail`.

const RAIL_SECTION = barSection(RAIL_FOOT, RAIL_HEAD, RAIL_HALF, 4);

const railAt = (y: number) => prismAlong("y", RAIL_SECTION, y - 2.6, y + 2.6, P);

const notchS = (index: number) => NOTCH_FROM + index * NOTCH_STEP;

export const RAIL_ART = {
  rails: [-RAIL_Y, RAIL_Y].map(railAt),
  // The slots the catches drop into, cut in the outer face of each rail.
  notches: join(
    ([-1, 1] as const).flatMap((side) =>
      Array.from({ length: NOTCHES }, (_, index) => {
        const a = onRail(notchS(index), -RAIL_HALF);
        const b = onRail(notchS(index), -RAIL_HALF - 3.4);
        const y = side * (RAIL_Y + 2.6);
        return segment([a[0], y, a[1]], [b[0], y, b[1]], P);
      }),
    ),
  ),
  seams: join(
    ([-1, 1] as const).map((side) => {
      const a = onRail(6, -RAIL_HALF + 1.2);
      const b = onRail(RAIL_LENGTH - 6, -RAIL_HALF + 1.2);
      const y = side * (RAIL_Y + 2.6);
      return segment([a[0], y, a[1]], [b[0], y, b[1]], P);
    }),
  ),
  // Two columns under each rail end, not one slab the width of the machine.
  posts: ([-1, 1] as const).flatMap((side) => [
    slabOf(
      { x: RAIL_HEAD[0] - 6, y: side * RAIL_Y - 5, w: 14, d: 10, r: 2 },
      BASE_H,
      RAIL_HEAD[1] - 4 - BASE_H,
      P,
      4,
      0.6,
    ),
    slabOf(
      { x: RAIL_FOOT[0] - 7, y: side * RAIL_Y - 5, w: 16, d: 10, r: 2 },
      BASE_H,
      RAIL_FOOT[1] - 4 - BASE_H,
      P,
      4,
      0.6,
    ),
  ]),
  postSeams: join(
    ([-1, 1] as const).map((side) =>
      sideSeam({ x: RAIL_HEAD[0] - 6, y: side * RAIL_Y - 5, w: 14, d: 10, r: 2 }, RAIL_HEAD[1] / 2, P, 4),
    ),
  ),
  // A tie bar across the head, so the two columns are one frame.
  tie: slabOf(
    { x: RAIL_HEAD[0] - 4, y: -RAIL_Y - 5, w: 10, d: (RAIL_Y + 5) * 2, r: 2 },
    RAIL_HEAD[1] - 30,
    12,
    P,
    4,
    0.5,
  ),
  braces: ([-1, 1] as const).map((side) =>
    prismAlong(
      "y",
      barSection(onRail(RAIL_LENGTH * 0.42, 2), [RAIL_FOOT[0] - 4, BASE_H + 4], 3, 0),
      side * RAIL_Y - 2.5,
      side * RAIL_Y + 2.5,
      P,
    ),
  ),
};

// ---------------------------------------------------------------- the sled
//
// Built at its resting place and slid along the rail, so the carriage, the
// footplate, the horns and every plate on them move as one piece.

const hornCentre = onRail(SLED_REST, SLED_OFF - 2);
const footTop = onRail(SLED_REST - SLED_LONG - 2, -2);
const footEnd = onRail(SLED_REST - SLED_LONG - 2, -2 - FOOT_LONG);

export const SLED_BACK = {
  body: prismAlong(
    "y",
    barSection(onRail(SLED_REST - SLED_LONG, SLED_OFF), onRail(SLED_REST + SLED_LONG, SLED_OFF), SLED_HALF),
    -SLED_Y,
    SLED_Y,
    P,
  ),
  // The bushings that ride each rail.
  bushes: ([-1, 1] as const).flatMap((side) =>
    [-1, 1].map((end) =>
      prismAlong(
        "y",
        barSection(
          onRail(SLED_REST + end * SLED_LONG * 0.55 - 5, -1),
          onRail(SLED_REST + end * SLED_LONG * 0.55 + 5, -1),
          RAIL_HALF + 3,
        ),
        side * RAIL_Y - 3.6,
        side * RAIL_Y + 3.6,
        P,
      ),
    ),
  ),

  horns: ([-1, 1] as const).map((side) =>
    prismAlong(
      "y",
      circleSection(hornCentre[0], hornCentre[1], HORN_R, 20),
      side > 0 ? HORN_Y - 4 : -HORN_Y - HORN_LONG,
      side > 0 ? HORN_Y + HORN_LONG : -HORN_Y + 4,
      P,
    ),
  ),
  hornCollars: join(
    ([-1, 1] as const).map((side) =>
      sectionArc("y", circleSection(hornCentre[0], hornCentre[1], HORN_R + 1.4, 20), side * (HORN_Y + 1), P),
    ),
  ),
};

/** Drawn after the discs: it sits nearer the viewer than they do. */
export const SLED_FRONT = {
  footplate: prismAlong("y", barSection(footTop, footEnd, FOOT_HALF), -FOOT_Y, FOOT_Y, P),
  footRibs: join(
    [-14, -5, 5, 14].map((y) =>
      segment(
        [footTop[0] - 1, y, footTop[1] + 1],
        [footEnd[0] - 1, y, footEnd[1] + 1],
        P,
      ),
    ),
  ),
};

/** One disc per side, built where it sits once that many are on the horn. */
export const DISC_ART = Array.from({ length: PLATES_MAX }, (_, index) =>
  ([-1, 1] as const).map((side) => {
    const from = HORN_Y + 3 + index * (PLATE_T + 0.6);
    const to = from + PLATE_T;
    return {
      disc: prismAlong(
        "y",
        circleSection(hornCentre[0], hornCentre[1], PLATE_R, 40),
        side > 0 ? from : -to,
        side > 0 ? to : -from,
        P,
      ),
      face: sectionArc(
        "y",
        circleSection(hornCentre[0], hornCentre[1], PLATE_R - 5, 40),
        side > 0 ? to : -to,
        P,
      ),
    };
  }),
);

// ---------------------------------------------------------------- the catches
//
// The one part of this machine people get wrong. Two states, both drawn: parked
// across the notch, or swung out of the way.

const catchArm = (parked: boolean, side: 1 | -1) => {
  const pivot = onRail(CATCH_S, 0);
  const tip = parked ? onRail(CATCH_S, -RAIL_HALF - 13) : onRail(CATCH_S + 3, RAIL_HALF + 12);
  const y = side * (RAIL_Y + 5.5);
  return {
    arm: prismAlong("y", barSection([pivot[0], pivot[1]], [tip[0], tip[1]], 2.2), y - 2, y + 2, P),
    boss: prismAlong("y", circleSection(pivot[0], pivot[1], 3.6, 20), y - 3.4, y + 3.4, P),
    grip: prismAlong(
      "y",
      circleSection(tip[0], tip[1], 2.4, 18),
      side > 0 ? y : y - 11,
      side > 0 ? y + 11 : y,
      P,
    ),
    pivotDot: pointsAt([[pivot[0], y + 3.4, pivot[1]] as Point3], P),
  };
};

export const CATCH_ART = {
  parked: ([-1, 1] as const).map((side) => catchArm(true, side)),
  free: ([-1, 1] as const).map((side) => catchArm(false, side)),
};

// ---------------------------------------------------------------- the seat

export const SEAT_ART = {
  post: slabOf(SEAT_POST, BASE_H, SEAT_Z - 6 - BASE_H, P, 5, 0.6),
  postSeam: sideSeam(SEAT_POST, 22, P, 5),
  holes: pointsAt(
    [14, 20, 26].map((z) => [SEAT_POST.x + SEAT_POST.w, 0, z] as Point3),
    P,
  ),
  collar: slabOf(insetPlan(SEAT_POST, -3), SEAT_Z - 12, 7, P, 5, 0.4),
  pad: prismAlong("y", barSection(BACK_FROM, BACK_TO, BACK_HALF), -BACK_Y, BACK_Y, P),
  padSeam: runOf(
    [
      [BACK_FROM[0] - 1, 0, BACK_FROM[1] + BACK_HALF + 0.4],
      [BACK_TO[0] + 1, 0, BACK_TO[1] + BACK_HALF + 0.4],
    ],
    P,
  ),
  padRivets: pointsAt(
    ([-1, 1] as const).flatMap((side) =>
      [0.25, 0.75].map((t) => [
        BACK_FROM[0] + (BACK_TO[0] - BACK_FROM[0]) * t,
        side * (PAD_Y - 3),
        BACK_FROM[1] + (BACK_TO[1] - BACK_FROM[1]) * t + BACK_HALF,
      ] as Point3),
    ),
    P,
  ),
  // The handles you hold while the catches come off.
  grips: ([-1, 1] as const).map((side) =>
    prismAlong(
      "y",
      circleSection(BACK_FROM[0] + 6, BACK_FROM[1] + 10, 2.2, 20),
      side > 0 ? BACK_Y : -BACK_Y - 13,
      side > 0 ? BACK_Y + 13 : -BACK_Y,
      P,
    ),
  ),
  gripPosts: ([-1, 1] as const).map((side) =>
    prismAlong(
      "y",
      barSection([BACK_FROM[0] + 6, BACK_FROM[1]], [BACK_FROM[0] + 6, BACK_FROM[1] + 10], 1.8),
      side * (BACK_Y + 11) - 1.8,
      side * (BACK_Y + 11) + 1.8,
      P,
    ),
  ),
  footRing: ring(SEAT_POST.x + SEAT_POST.w / 2, 0, SEAT_POST.w / 2 + 3, BASE_H, P, 24),
  screws: pointsAt(
    corners(SEAT_POST, 5).map(([x, y]) => [x, y, SEAT_Z - 5] as Point3),
    P,
  ),
};
