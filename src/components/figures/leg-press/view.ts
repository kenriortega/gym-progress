import { iso, type Flat, type Plan, type Point3, type Projection } from "@/components/iso/iso-kit";
import { directionOf } from "../prism";

// World units are about 1 cm of the real machine. x runs from the top of the
// rails (back, low x) down to the seat (front, high x), y across it, z up.

export const WIDTH = 620;
export const HEIGHT = 410;
const PAD = 26;
export const AZIMUTH = 52;
export const ELEVATION = 26;

export const BASE: Plan = { x: -46, y: -46, w: 246, d: 92, r: 8 };
export const BASE_H = 7;
export const FOOT_R = 5.5;
export const FOOT_H = 5;

// The rails, in the xz plane: the whole machine is built along this one line.
export const RAIL_FOOT: [number, number] = [96, 26];
export const RAIL_HEAD: [number, number] = [-34, 156];
export const RAIL_DIR = directionOf(RAIL_FOOT, RAIL_HEAD);
export const RAIL_Y = 26;
export const RAIL_HALF = 3.4;
export const RAIL_LENGTH = Math.hypot(RAIL_HEAD[0] - RAIL_FOOT[0], RAIL_HEAD[1] - RAIL_FOOT[1]);
/** sin of the ramp angle: how much of the load you actually push. */
export const RAMP_SIN = RAIL_DIR[1];

/** A point `s` along the rail from its foot, offset `off` perpendicular to it. */
export const onRail = (s: number, off = 0): [number, number] => [
  RAIL_FOOT[0] + RAIL_DIR[0] * s - RAIL_DIR[1] * off,
  RAIL_FOOT[1] + RAIL_DIR[1] * s + RAIL_DIR[0] * off,
];

export const SLED_REST = 34;
export const SLED_LONG = 23;
export const SLED_OFF = -11;
export const SLED_HALF = 9;
export const SLED_Y = 20;
export const STROKE = 62;

export const PLATE_R = 21;
export const PLATE_T = 4.2;
export const HORN_Y = 30;
export const HORN_R = 3.4;
export const HORN_LONG = 26;
export const PLATE_KG = 20;
export const PLATES_MAX = 4;
export const SLED_KG = 25;

export const FOOT_LONG = 30;
export const FOOT_HALF = 2.4;
export const FOOT_Y = 24;

/** The notches the safety catches drop into, along the rail. */
export const NOTCH_FROM = 20;
export const NOTCH_STEP = 11;
export const NOTCHES = 7;
export const CATCH_AT = 4;
export const CATCH_S = NOTCH_FROM + CATCH_AT * NOTCH_STEP;

export const SEAT_POST: Plan = { x: 126, y: -11, w: 22, d: 22, r: 3 };
export const SEAT_Z = 34;
export const BACK_FROM: [number, number] = [130, 40];
export const BACK_TO: [number, number] = [178, 54];
export const BACK_HALF = 4;
export const BACK_Y = 21;
export const PAD_Y = 19;

function fit(points: Point3[]): Projection {
  const unit: Projection = { origin: [0, 0], scale: 1, azimuth: AZIMUTH, elevation: ELEVATION };
  const flat = points.map((point) => iso(point, unit));
  const xs = flat.map(([x]) => x);
  const ys = flat.map(([, y]) => y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const up = Math.min(...ys);
  const down = Math.max(...ys);
  const scale = Math.min((WIDTH - PAD * 2) / (right - left), (HEIGHT - PAD * 2) / (down - up));
  return {
    origin: [WIDTH / 2 - ((left + right) / 2) * scale, HEIGHT / 2 - ((up + down) / 2) * scale],
    scale,
    azimuth: AZIMUTH,
    elevation: ELEVATION,
  };
}

const boxOf = ({ x, y, w, d }: Plan, z0: number, z1: number): Point3[] => {
  const out: Point3[] = [];
  for (const px of [x, x + w]) for (const py of [y, y + d]) for (const z of [z0, z1]) out.push([px, py, z]);
  return out;
};

const topSled = onRail(SLED_REST + STROKE, SLED_OFF);

export const P = fit([
  ...boxOf(BASE, -BASE_H - FOOT_H, BASE_H),
  [RAIL_HEAD[0], -RAIL_Y, RAIL_HEAD[1] + 8],
  [RAIL_HEAD[0], RAIL_Y, RAIL_HEAD[1] + 8],
  [topSled[0] - PLATE_R, -HORN_Y - 14, topSled[1] + PLATE_R],
  [topSled[0] + PLATE_R, HORN_Y + 14, topSled[1] + PLATE_R],
  [BACK_TO[0] + 8, -BACK_Y, BACK_TO[1]],
]);

export const at = (point: Point3) => iso(point, P);

const ORIGIN = at([0, 0, 0]);
const minus = (a: Flat, b: Flat): Flat => [a[0] - b[0], a[1] - b[1]];
const EX = minus(at([1, 0, 0]), ORIGIN);
export const EZ = minus(at([0, 0, 1]), ORIGIN);

const fine = (value: number) => Math.round(value * 100) / 100;

/** A screen transform that slides a pre-built group `s` units up the rail. */
export const slide = (s: number) => {
  const dx = RAIL_DIR[0] * s;
  const dz = RAIL_DIR[1] * s;
  return `translate(${fine(EX[0] * dx + EZ[0] * dz)} ${fine(EX[1] * dx + EZ[1] * dz)})`;
};

/** Screen px per world unit travelled along the rail, for turning a drag into travel. */
export const RUN = Math.hypot(EX[0] * RAIL_DIR[0] + EZ[0] * RAIL_DIR[1], EX[1] * RAIL_DIR[0] + EZ[1] * RAIL_DIR[1]);

/** How far the drag's screen-down direction moves the sled down the rail. */
export const DOWN_PER_PX =
  -(EX[1] * RAIL_DIR[0] + EZ[1] * RAIL_DIR[1]) / (RUN * RUN === 0 ? 1 : RUN * RUN);
