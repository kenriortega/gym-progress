import {
  corners,
  cylinder,
  insetPlan,
  pointsAt,
  ring,
  sideRing,
  sideSeam,
  slabOf,
  type Flat,
  type Plan,
  type Point3,
  type Projection,
  type SolidPaths,
} from "@/components/iso/iso-kit";
import { circleSection, prismAlong, sectionArc } from "../prism";

/**
 * A selectorized weight stack: plates on two guide rods, a selector rod hanging
 * from the carrier, and the pin that decides how many of them leave the floor.
 *
 * Every cable machine in the gym has one, built the same way and sized
 * differently, so the geometry lives here and each figure passes its own
 * dimensions. Nothing here knows which machine it belongs to.
 */
export interface StackSpec {
  /** Centre of the stack on the floor plan. */
  x: number;
  /**
   * Centre across the machine. Most towers sit on the middle line, but a cam
   * machine puts its stack out to one side, in line with the cam.
   */
  y?: number;
  plate: Plan;
  plateHeight: number;
  pitch: number;
  firstZ: number;
  count: number;
  /** Guide rods sit at ±rodY either side of the centre. */
  rodY: number;
  rodR: number;
  selectorR: number;
  /** Top of the block the stack rests on: where the rods and selector start. */
  blockTop: number;
  yoke: Plan;
  yokeZ: number;
  yokeHeight: number;
  /** Top of the tower, where the guide rods end. */
  rodTop: number;
}

export const plateZOf = (spec: StackSpec, index: number) => spec.firstZ + index * spec.pitch;
export const stackTopOf = (spec: StackSpec) => plateZOf(spec, spec.count - 1) + spec.plateHeight;
export const yokeTopOf = (spec: StackSpec) => spec.yokeZ + spec.yokeHeight;
export const eyeTopOf = (spec: StackSpec) => yokeTopOf(spec) + 3;

const join = (paths: string[]) => paths.filter(Boolean).join("");

const midY = (spec: StackSpec) => spec.y ?? 0;

export interface PlateArt {
  solid: SolidPaths;
  seam: string;
  edge: string;
  holes: string;
  pinHole: string;
}

export function platesOf(spec: StackSpec, P: Projection): PlateArt[] {
  return Array.from({ length: spec.count }, (_, index) => {
    const z = plateZOf(spec, index);
    return {
      solid: slabOf(spec.plate, z, spec.plateHeight, P, 6, 0.5),
      seam: sideSeam(spec.plate, z + spec.plateHeight / 2, P, 6),
      edge: sideSeam(insetPlan(spec.plate, 2.4), z + spec.plateHeight - 0.9, P, 6),
      holes: join([
        ring(spec.x, midY(spec) - spec.rodY, spec.rodR + 0.9, z + spec.plateHeight, P, 18),
        ring(spec.x, midY(spec) + spec.rodY, spec.rodR + 0.9, z + spec.plateHeight, P, 18),
        ring(spec.x, midY(spec), spec.selectorR + 1, z + spec.plateHeight, P, 20),
      ]),
      pinHole: sideRing(
        [spec.plate.x + spec.plate.w, midY(spec), z + spec.plateHeight / 2],
        1.9,
        "x",
        P,
        18,
      ),
    };
  });
}

/** The carrier the cable pulls on, with the eye the cable ties to. */
export function yokeOf(spec: StackSpec, P: Projection) {
  const top = yokeTopOf(spec);
  return {
    solid: slabOf(spec.yoke, spec.yokeZ, spec.yokeHeight, P, 6, 0.8),
    seam: sideSeam(spec.yoke, spec.yokeZ + spec.yokeHeight / 2, P, 6),
    holes: join([
      ring(spec.x, midY(spec) - spec.rodY, spec.rodR + 0.9, top, P, 18),
      ring(spec.x, midY(spec) + spec.rodY, spec.rodR + 0.9, top, P, 18),
    ]),
    screws: pointsAt(
      corners(spec.yoke, 6).map(([x, y]) => [x, y, top] as Point3),
      P,
    ),
    eye: cylinder(spec.x, midY(spec), 2.8, top, 3, P, 16),
    eyeRing: ring(spec.x, midY(spec), 1.2, top + 3, P, 14),
  };
}

export const guideRodsOf = (spec: StackSpec, P: Projection) =>
  [midY(spec) - spec.rodY, midY(spec) + spec.rodY].map((y) =>
    cylinder(spec.x, y, spec.rodR, spec.blockTop, spec.rodTop - spec.blockTop, P, 20),
  );

/**
 * The selector rod, one per pin position: below the plate the pin sits in, the
 * rod is inside the stack and nothing of it shows, so it is cut there.
 */
export const selectorRodsOf = (spec: StackSpec, P: Projection): SolidPaths[] =>
  Array.from({ length: spec.count }, (_, pin) => {
    const bottom = pin === 0 ? spec.blockTop : plateZOf(spec, pin - 1) + spec.plateHeight;
    return cylinder(spec.x, midY(spec), spec.selectorR, bottom, spec.yokeZ - bottom, P, 20);
  });

/** The pin, one per position: a shaft through the plate and its knurled knob. */
export const pinsOf = (spec: StackSpec, P: Projection) =>
  Array.from({ length: spec.count }, (_, pin) => {
    const z = plateZOf(spec, pin) + spec.plateHeight / 2;
    const face = spec.plate.x + spec.plate.w;
    return {
      shaft: prismAlong("x", circleSection(midY(spec), z, 1.7, 20), face - 7, face + 8, P),
      knob: prismAlong("x", circleSection(midY(spec), z, 3.4, 24), face + 8, face + 12.5, P),
      collar: sectionArc("x", circleSection(midY(spec), z, 3.4, 24), face + 10.2, P),
    };
  });

/** The block the stack stands on. */
export function blockOf(plan: Plan, z: number, height: number, P: Projection) {
  return {
    solid: slabOf(plan, z, height, P, 6, 0.7),
    seam: sideSeam(plan, z + height / 2, P, 6),
    screws: pointsAt(
      corners(plan, 6).map(([x, y]) => [x, y, z + height] as Point3),
      P,
    ) as Flat[],
  };
}
