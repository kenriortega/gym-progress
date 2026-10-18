import { iso, type Flat, type Plan, type Point3, type Projection } from "@/components/iso/iso-kit";

// World units are about 1 cm of the real machine: x runs from the tower out
// toward the user, y across it, z up.

export const WIDTH = 400;
export const HEIGHT = 470;
const PAD = 26;
export const AZIMUTH = 50;
export const ELEVATION = 27;

export const BASE: Plan = { x: -28, y: -40, w: 106, d: 80, r: 8 };
export const BASE_H = 7;
export const FOOT_R = 5.5;
export const FOOT_H = 5;

export const STACK_X = 6;
export const BLOCK: Plan = { x: -14, y: -28, w: 40, d: 56, r: 4 };
export const BLOCK_Z = BASE_H;
export const BLOCK_H = 9;
export const BLOCK_TOP = BLOCK_Z + BLOCK_H;

export const PLATES = 12;
export const PLATE_KG = 5;
export const PLATE: Plan = { x: -10, y: -24, w: 32, d: 48, r: 3 };
export const PLATE_H = 6.4;
export const PITCH = 8;
export const PLATE_Z0 = 17;
export const plateZ = (index: number) => PLATE_Z0 + index * PITCH;
export const STACK_TOP = plateZ(PLATES - 1) + PLATE_H;

export const YOKE: Plan = { x: -9, y: -22, w: 30, d: 44, r: 3 };
export const YOKE_Z = STACK_TOP + 2.6;
export const YOKE_H = 10;
export const YOKE_TOP = YOKE_Z + YOKE_H;
export const EYE_TOP = YOKE_TOP + 3;

export const ROD_Y = 17;
export const ROD_R = 2;
export const SELECTOR_R = 2.4;

export const UPRIGHT_Y = 30.5;
export const UPRIGHT: Plan = { x: -1, y: UPRIGHT_Y - 4.5, w: 14, d: 9, r: 2 };
export const UPRIGHT_TOP = 198;

export const HEAD: Plan = { x: -12, y: -36, w: 62, d: 72, r: 4 };
export const HEAD_Z = UPRIGHT_TOP;
export const HEAD_H = 8;
export const HEAD_TOP = HEAD_Z + HEAD_H;
export const BORE_R = 4;

export const SHEAVE_R = 7;
export const SHEAVE_HALF = 3;
export const CHEEK_HALF = 4.6;
export const TOP_Z = 215;
export const REAR: Point3 = [STACK_X + SHEAVE_R, 0, TOP_Z];
export const DROP_X = 44;
export const FRONT: Point3 = [DROP_X - SHEAVE_R, 0, TOP_Z];
export const CABLE_TOP = TOP_Z + SHEAVE_R;

export const CAP: Plan = { x: -14, y: -11, w: 66, d: 22, r: 3 };
export const CAP_Z = 226;
export const CAP_H = 9;

// The rail the pulley carriage rides, with its column of holes. This is what
// makes one machine serve four exercises.
export const RAIL: Plan = { x: 34, y: -9, w: 8, d: 18, r: 2 };
export const RAIL_Z = BLOCK_TOP;
export const RAIL_TOP = HEAD_Z;
export const HOLE_FROM = 110;
export const HOLE_TO = 190;
export const HOLE_STEP = 10;
export const HOLES = Math.round((HOLE_TO - HOLE_FROM) / HOLE_STEP) + 1;
export const holeZ = (index: number) => HOLE_FROM + index * HOLE_STEP;
export const HOLE_REST = 6;

export const CLAMP: Plan = { x: 30, y: -11, w: 16, d: 22, r: 3 };
export const CLAMP_DROP = 13;
export const CLAMP_H = 20;
export const CARRIAGE_X = 50;
export const CARRIAGE_R = 6;
export const CARRIAGE_HALF = 2.6;
export const PIN_DROP = 11;

/** Where the cable leaves the carriage sheave on its way down to the handle. */
export const HANDLE_X = CARRIAGE_X + CARRIAGE_R;
export const HANDLE_DROP = 50;
export const STROKE = 45;

export const CLIP_H = 7;
export const BAR_R = 2;
export const BAR_HALF = 17;
export const ROPE_HALF = 9;
export const ROPE_DROP = 26;

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
  ...boxOf(CAP, CAP_Z, CAP_Z + CAP_H),
  ...boxOf(
    { x: HANDLE_X - BAR_R, y: -BAR_HALF, w: BAR_R * 2, d: BAR_HALF * 2, r: 0 },
    holeZ(HOLE_REST) - HANDLE_DROP - STROKE - ROPE_DROP,
    holeZ(HOLE_REST),
  ),
]);

export const at = (point: Point3) => iso(point, P);

const ORIGIN = at([0, 0, 0]);
const minus = (a: Flat, b: Flat): Flat => [a[0] - b[0], a[1] - b[1]];
export const EZ = minus(at([0, 0, 1]), ORIGIN);

const fine = (value: number) => Math.round(value * 100) / 100;

/** A screen transform that lifts a pre-built group by `z` world units. */
export const lift = (z: number) => `translate(${fine(EZ[0] * z)} ${fine(EZ[1] * z)})`;

/** Screen px per world unit of height — pointer drag turns into handle travel with it. */
export const RISE = Math.hypot(EZ[0], EZ[1]);

/** Screen anchors for the cable runs whose length changes as things move. */
export const ANCHOR = {
  eye: at([STACK_X, 0, EYE_TOP]),
  upTop: at([STACK_X, 0, TOP_Z]),
  dropTop: at([DROP_X, 0, TOP_Z]),
  drop: at([DROP_X, 0, 0]),
  handle: at([HANDLE_X, 0, 0]),
};
