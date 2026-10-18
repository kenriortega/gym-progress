import { iso, type Flat, type Plan, type Point3, type Projection } from "@/components/iso/iso-kit";

// World units are about 1 cm. x runs from the tower at the back out to the
// knees, y across the machine, z up.
//
// The cam, the cable and the stack all live in one vertical plane out at
// y = SIDE: the cam has to sit outboard of the seat, and a stack in line with
// it is how these machines are actually laid out.

export const WIDTH = 560;
export const HEIGHT = 430;
const PAD = 26;
export const AZIMUTH = 50;
export const ELEVATION = 27;

export const SIDE = 46;

export const BASE: Plan = { x: -26, y: -40, w: 170, d: 104, r: 8 };
export const BASE_H = 7;
export const FOOT_R = 5.5;
export const FOOT_H = 5;

export const STACK_X = 6;
export const BLOCK: Plan = { x: -14, y: SIDE - 16, w: 40, d: 32, r: 4 };
export const BLOCK_Z = BASE_H;
export const BLOCK_H = 9;
export const BLOCK_TOP = BLOCK_Z + BLOCK_H;

export const PLATES = 12;
export const PLATE_KG = 5;
export const PLATE: Plan = { x: -10, y: SIDE - 12, w: 32, d: 24, r: 3 };
export const PLATE_H = 6.4;
export const PITCH = 8;
export const PLATE_Z0 = 17;
export const plateZ = (index: number) => PLATE_Z0 + index * PITCH;

export const YOKE: Plan = { x: -9, y: SIDE - 11, w: 30, d: 22, r: 3 };
export const YOKE_Z = plateZ(PLATES - 1) + PLATE_H + 2.6;
export const YOKE_H = 10;
export const YOKE_TOP = YOKE_Z + YOKE_H;
export const EYE_TOP = YOKE_TOP + 3;

export const ROD_Y = 8;
export const ROD_R = 2;
export const SELECTOR_R = 2.4;

export const UPRIGHT_A: Plan = { x: -1, y: SIDE - 20, w: 14, d: 8, r: 2 };
export const UPRIGHT_B: Plan = { x: -1, y: SIDE + 12, w: 14, d: 8, r: 2 };
export const UPRIGHT_TOP = 152;

export const HEAD: Plan = { x: -12, y: SIDE - 24, w: 44, d: 48, r: 4 };
export const HEAD_Z = UPRIGHT_TOP;
export const HEAD_H = 8;
export const HEAD_TOP = HEAD_Z + HEAD_H;

export const IDLER_R = 7;
export const IDLER: Point3 = [STACK_X + IDLER_R, SIDE, 168];
export const IDLER_HALF = 3;

export const PIVOT: [number, number] = [86, 56];
export const ARM = 38;
export const ARM_HALF = 2.6;
export const ARM_Y = 24;
export const ROLLER_R = 6.5;
export const ROLLER_HALF = 14;
export const SHAFT_R = 3.4;
export const CAM_HALF = 3;

/** Where the cable first touches the idler, coming up from the cam. */
export const IDLER_TOUCH = 41;

export const SEAT_POST: Plan = { x: 92, y: -11, w: 22, d: 22, r: 3 };
export const SEAT_Z = 44;
export const SEAT_PAD: Plan = { x: 76, y: -21, w: 48, d: 42, r: 10 };
export const SEAT_PAD_H = 8;
export const BACK_FROM: [number, number] = [120, 48];
export const BACK_TO: [number, number] = [136, 92];
export const BACK_HALF = 4;
export const BACK_Y = 20;

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
  [IDLER[0] - IDLER_R, SIDE, IDLER[2] + IDLER_R + 6],
  [PIVOT[0] + ARM + ROLLER_R, -ROLLER_HALF, PIVOT[1] + 6],
  [PIVOT[0] + 10, -ROLLER_HALF, PIVOT[1] - ARM - ROLLER_R],
  [BACK_TO[0] + 8, BACK_Y, BACK_TO[1] + 6],
]);

export const at = (point: Point3) => iso(point, P);

const ORIGIN = at([0, 0, 0]);
const minus = (a: Flat, b: Flat): Flat => [a[0] - b[0], a[1] - b[1]];
export const EX = minus(at([1, 0, 0]), ORIGIN);
export const EZ = minus(at([0, 0, 1]), ORIGIN);

const fine = (value: number) => Math.round(value * 100) / 100;

export const lift = (z: number) => `translate(${fine(EZ[0] * z)} ${fine(EZ[1] * z)})`;

export const RISE = Math.hypot(EZ[0], EZ[1]);

/** The screen point of the cable's drop line at z = 0; add EZ·z for any height. */
export const DROP_ANCHOR = at([STACK_X, SIDE, 0]);
export const DROP_TOP = IDLER[2];
