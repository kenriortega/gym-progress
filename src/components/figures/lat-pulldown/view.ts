import { iso, type Flat, type Plan, type Point3, type Projection } from "@/components/iso/iso-kit";

// World units are about 1 cm of the real machine: x runs from the tower out to the
// knees, y across it, z up.

export const WIDTH = 530;
export const HEIGHT = 460;
const PAD = 26;
export const AZIMUTH = 50;
export const ELEVATION = 27;

export const BASE: Plan = { x: -26, y: -42, w: 154, d: 84, r: 8 };
export const BASE_H = 7;
export const FOOT_R = 5.5;
export const FOOT_H = 5;

export const STACK_X = 6;
export const BLOCK: Plan = { x: -14, y: -30, w: 42, d: 60, r: 4 };
export const BLOCK_Z = BASE_H;
export const BLOCK_H = 9;
export const BLOCK_TOP = BLOCK_Z + BLOCK_H;

export const PLATES = 12;
export const PLATE_KG = 5;
export const PLATE: Plan = { x: -10, y: -26, w: 32, d: 52, r: 3 };
export const PLATE_H = 6.4;
export const PITCH = 8;
export const PLATE_Z0 = 17;
export const plateZ = (index: number) => PLATE_Z0 + index * PITCH;
export const STACK_TOP = plateZ(PLATES - 1) + PLATE_H;

export const YOKE: Plan = { x: -9, y: -24, w: 30, d: 48, r: 3 };
export const YOKE_Z = STACK_TOP + 2.6;
export const YOKE_H = 10;
export const YOKE_TOP = YOKE_Z + YOKE_H;

export const ROD_Y = 18;
export const ROD_R = 2;
export const ROD_Z0 = BLOCK_TOP;
export const SELECTOR_R = 2.4;
export const SELECTOR_Z0 = PLATE_Z0 + 1.6;

export const UPRIGHT_Y = 32.5;
export const UPRIGHT: Plan = { x: -1, y: UPRIGHT_Y - 4.5, w: 14, d: 9, r: 2 };
export const UPRIGHT_Z = BASE_H;
export const UPRIGHT_TOP = 198;

export const HEAD: Plan = { x: -12, y: -39, w: 36, d: 78, r: 4 };
export const HEAD_Z = UPRIGHT_TOP;
export const HEAD_H = 8;
export const HEAD_TOP = HEAD_Z + HEAD_H;
export const BORE_R = 4;

export const SHEAVE_R = 8;
export const SHEAVE_HALF = 3;
export const CHEEK_HALF = 4.6;
export const REAR: Point3 = [STACK_X + SHEAVE_R, 0, 215];
export const BAR_X = 92;
export const FRONT: Point3 = [BAR_X - SHEAVE_R, 0, 215];
export const CABLE_TOP = REAR[2] + SHEAVE_R;
export const CABLE_R = 0.9;

export const BOOM: Plan = { x: -12, y: -9, w: 124, d: 18, r: 3 };
export const BOOM_Z = 227;
export const BOOM_H = 12;
export const BOOM_TOP = BOOM_Z + BOOM_H;

// You sit facing the tower, so the order out from it is tower, thigh rollers,
// seat: the rollers hold the thighs down between you and the column, with the
// bar hanging a little ahead of the seat.
export const THIGH_POST: Plan = { x: 56, y: -8, w: 16, d: 16, r: 3 };
export const THIGH_Z = 86;
export const THIGH_R = 7;
export const THIGH_BAR_R = 3;
export const THIGH_REACH = 33;
export const THIGH_X = 64;

export const SEAT_POST: Plan = { x: 88, y: -9, w: 18, d: 18, r: 3 };
export const SEAT_Z = 56;
export const SEAT_PAD: Plan = { x: 74, y: -21, w: 48, d: 42, r: 10 };
export const SEAT_PAD_H = 8;

export const BAR_Z = 186;
export const BAR_R = 2.2;
export const GRIP_R = 3;
export const BAR_HALF = 42;
export const CLEVIS_TOP = BAR_Z + 9;

export const STROKE = 62;

export const RISER: Plan = { x: -12, y: -9, w: 14, d: 18, r: 3 };

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

export const P = fit([
  ...boxOf(BASE, -BASE_H - FOOT_H, BASE_H),
  ...boxOf(BOOM, BOOM_Z, BOOM_TOP),
  ...boxOf({ x: BAR_X - 3, y: -BAR_HALF, w: 6, d: BAR_HALF * 2, r: 0 }, BAR_Z - STROKE - 4, BAR_Z + 4),
  ...boxOf({ x: THIGH_X - THIGH_R, y: -THIGH_REACH, w: THIGH_R * 2, d: THIGH_REACH * 2, r: 0 }, THIGH_Z - THIGH_R, THIGH_Z + THIGH_R),
]);

export const at = (point: Point3) => iso(point, P);

export const EYE_TOP = YOKE_TOP + 3;

/** Screen anchors for the two cable runs that change length as the bar travels. */
export const ANCHOR = {
  eye: at([STACK_X, 0, EYE_TOP]),
  upTop: at([STACK_X, 0, REAR[2]]),
  downTop: at([BAR_X, 0, FRONT[2]]),
  barTop: at([BAR_X, 0, CLEVIS_TOP + 3]),
};

const ORIGIN = at([0, 0, 0]);
const minus = (a: Flat, b: Flat): Flat => [a[0] - b[0], a[1] - b[1]];
export const EZ = minus(at([0, 0, 1]), ORIGIN);

const fine = (value: number) => Math.round(value * 100) / 100;

/** A screen transform that lifts a pre-built group by `z` world units. */
export const lift = (z: number) => `translate(${fine(EZ[0] * z)} ${fine(EZ[1] * z)})`;

/** Screen px per world unit of height — pointer drag turns into bar travel with it. */
export const RISE = Math.hypot(EZ[0], EZ[1]);
