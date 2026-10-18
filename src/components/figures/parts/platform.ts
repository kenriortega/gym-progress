import {
  corners,
  cylinder,
  haloOf,
  insetPlan,
  planOutline,
  pointsAt,
  ring,
  slabOf,
  type Flat,
  type Plan,
  type Point3,
  type Projection,
} from "@/components/iso/iso-kit";

/** The slab a machine stands on, with its feet, their rings and the corner screws. */
export interface PlatformSpec {
  plan: Plan;
  height: number;
  footRadius: number;
  footHeight: number;
  /** How far in from the corners the feet sit. */
  footInset: number;
}

const join = (paths: string[]) => paths.filter(Boolean).join("");

export function platformOf(spec: PlatformSpec, P: Projection) {
  const feet = corners(spec.plan, spec.footInset);
  return {
    halo: haloOf(spec.plan, -spec.height - spec.footHeight, 2, P),
    feet: feet.map(([x, y]) =>
      cylinder(x, y, spec.footRadius, -spec.footHeight, spec.footHeight, P, 20),
    ),
    footRings: join(feet.map(([x, y]) => ring(x, y, spec.footRadius + 1.6, spec.height, P, 24))),
    slab: slabOf(spec.plan, 0, spec.height, P, 10, 1),
    groove: planOutline(insetPlan(spec.plan, 5), spec.height, P, 10),
    screws: pointsAt(
      corners(spec.plan, 9).map(([x, y]) => [x, y, spec.height] as Point3),
      P,
    ) as Flat[],
  };
}
