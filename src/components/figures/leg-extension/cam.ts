import { IDLER, IDLER_R, IDLER_TOUCH, PIVOT } from "./view";

// The cam is the whole point of this machine, so its shape is defined once here
// and everything else falls out of it: where the cable leaves, how far the stack
// rises, and how heavy the pad feels at each angle.
//
// The profile is a limaçon, ρ(ψ) = R + E·cos(ψ − phase), which is what an offset
// sheave gives you and what plenty of real machines use. R ≥ 2E keeps it convex,
// so it can be drawn as a plain solid.
//
// The phase is what makes it a cam and not just a big pulley. It puts the widest
// radius where the knee is bent and the narrowest at full extension, because
// that is the shape of the quadriceps' own strength curve: you push hardest in
// mid flexion and least at lockout. The machine gives back what you have.

export const DEGREES = Math.PI / 180;
export const CAM_R = 15;
export const CAM_E = 7;
export const CAM_PHASE = 164 * DEGREES;

/** The cam's radius at a local angle, in cm. */
export const camRadius = (psi: number) => CAM_R + CAM_E * Math.cos(psi - CAM_PHASE);

/** Where the arm sits: 0 is the leg straight out, negative is the knee bent. */
export const ANGLE_LOW = -80;
export const ANGLE_HIGH = 0;

/** Where the cable first touches the idler, in the cam's own plane. */
export const TOUCH: [number, number] = [
  IDLER[0] + IDLER_R * Math.cos(IDLER_TOUCH * DEGREES),
  IDLER[2] + IDLER_R * Math.sin(IDLER_TOUCH * DEGREES),
];

const TO_TOUCH = Math.hypot(TOUCH[0] - PIVOT[0], TOUCH[1] - PIVOT[1]);
const TO_TOUCH_ANGLE = Math.atan2(TOUCH[1] - PIVOT[1], TOUCH[0] - PIVOT[0]);

/**
 * Where the cable leaves the cam, and how long a lever it has there.
 *
 * The cable is tangent to the profile, so the lever is the perpendicular
 * distance from the pivot to the cable — which is the radius at the point of
 * tangency. That point depends on the radius and the radius on the point, so it
 * is found by iterating; four passes settle it well inside a pixel.
 */
export function tangentAt(deg: number) {
  let radius = CAM_R;
  let angle = TO_TOUCH_ANGLE;
  for (let pass = 0; pass < 4; pass++) {
    angle = TO_TOUCH_ANGLE - Math.acos(Math.min(1, radius / TO_TOUCH));
    radius = camRadius(angle - deg * DEGREES);
  }
  return {
    radius,
    at: [PIVOT[0] + radius * Math.cos(angle), PIVOT[1] + radius * Math.sin(angle)] as [number, number],
  };
}

export const leverAt = (deg: number) => tangentAt(deg).radius;

const STEP = 0.5;

/**
 * How much cable the cam has wound in by `deg`, which is how far the stack has
 * risen: the integral of the lever over the angle turned. Precomputed once a
 * degree, because the frame loop asks for it sixty times a second.
 */
function integrate(deg: number) {
  const span = deg - ANGLE_LOW;
  const steps = Math.max(1, Math.round(span / STEP));
  let total = 0;
  for (let index = 0; index < steps; index++) {
    const a = ANGLE_LOW + (span * index) / steps;
    const b = ANGLE_LOW + (span * (index + 1)) / steps;
    total += ((leverAt(a) + leverAt(b)) / 2) * (b - a) * DEGREES;
  }
  return total;
}

const TABLE = Array.from({ length: ANGLE_HIGH - ANGLE_LOW + 1 }, (_, index) => integrate(ANGLE_LOW + index));

export function riseAt(deg: number) {
  const t = Math.min(TABLE.length - 1, Math.max(0, deg - ANGLE_LOW));
  const low = Math.floor(t);
  const high = Math.min(TABLE.length - 1, low + 1);
  return TABLE[low]! + (TABLE[high]! - TABLE[low]!) * (t - low);
}

export const RISE_FULL = riseAt(ANGLE_HIGH);

/**
 * What the pad pushes back with, in kilos, at this angle: the stack's weight
 * times the cam's lever, over the arm out to the roller. This is the number the
 * cam exists to shape, and why the machine feels different at the top.
 */
export const resistanceAt = (kg: number, deg: number, armLength: number) =>
  (kg * leverAt(deg)) / armLength;
