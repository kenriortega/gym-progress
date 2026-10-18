import {
  pointsAt,
  slabOf,
  type Flat,
  type Point3,
  type Projection,
} from "@/components/iso/iso-kit";
import { circleSection, prismAlong, sectionArc } from "../prism";

/**
 * A cable sheave in its bracket: two flanges with the groove between them, the
 * hub, and the straps that hold it. The straps are narrow on purpose — a full
 * cheek plate is what a real bracket has, and it hides the wheel it holds.
 */
export interface SheaveSpec {
  centre: Point3;
  radius: number;
  /** Half the wheel's width along y. */
  half: number;
  /** Half the gap between the two bracket straps. */
  cheekHalf: number;
  /** Where the straps run from and how tall they are. */
  mountZ: number;
  mountHeight: number;
  /** The hub boss on the axle; a bigger wheel carries a bigger one. */
  hubRadius: number;
}

export function sheaveOf(spec: SheaveSpec, P: Projection) {
  // The centre's y matters: a cam machine hangs its idler out to one side, and
  // a sheave built around y = 0 would float away from its own cable.
  const [cx, cy, cz] = spec.centre;
  const flange = (from: number, to: number) =>
    prismAlong("y", circleSection(cx, cz, spec.radius, 44), cy + from, cy + to, P);
  return {
    cheeks: [-spec.cheekHalf - 2.4, spec.cheekHalf].map((y) =>
      slabOf({ x: cx - 3.6, y: cy + y, w: 7.2, d: 2.4, r: 3 }, spec.mountZ, spec.mountHeight, P, 6, 0.4),
    ),
    far: flange(-spec.half, -spec.half + 1.2),
    core: prismAlong(
      "y",
      circleSection(cx, cz, spec.radius - 1.7, 44),
      cy - spec.half + 1.2,
      cy + spec.half - 1.2,
      P,
    ),
    near: flange(spec.half - 1.2, spec.half),
    groove: sectionArc("y", circleSection(cx, cz, spec.radius - 1.7, 44), cy + spec.half - 1.2, P),
    hub: prismAlong(
      "y",
      circleSection(cx, cz, spec.hubRadius, 20),
      cy - spec.half - 0.8,
      cy + spec.half + 0.8,
      P,
    ),
    bolts: pointsAt(
      [-spec.cheekHalf - 1.2, spec.cheekHalf + 1.2].map((y) => [cx, cy + y, cz] as Point3),
      P,
    ) as Flat[],
  };
}

export type SheaveArt = ReturnType<typeof sheaveOf>;

/** The arc the cable makes round a sheave, from one angle to another. */
export const wrapPoints = (centre: Point3, radius: number, from: number, to: number, steps = 16): Point3[] =>
  Array.from({ length: steps + 1 }, (_, index) => {
    const angle = from + ((to - from) * index) / steps;
    return [centre[0] + radius * Math.cos(angle), centre[1], centre[2] + radius * Math.sin(angle)];
  });
