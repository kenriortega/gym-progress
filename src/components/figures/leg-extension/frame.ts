import { pathOf, type SolidPaths } from "@/components/iso/iso-kit";
import { barSection, circleSection, prismAlong, runOf, sectionArc, type Section } from "../prism";
import { DEGREES, TOUCH, camRadius, riseAt, tangentAt } from "./cam";
import {
  ARM,
  ARM_HALF,
  ARM_Y,
  CAM_HALF,
  P,
  PIVOT,
  ROLLER_HALF,
  ROLLER_R,
  SIDE,
  at,
} from "./view";

// Everything that turns, rebuilt for an angle. A rotation about the knee axis
// is a rotation of the section in its own plane, so it cannot be a screen
// transform the way a sliding carriage can: these paths are made again each
// frame. There are few enough of them that it costs nothing.

const CAM_STEPS = 56;

/** The cam's outline at this arm angle: local radii, turned with the arm. */
function camSection(deg: number): Section {
  const turn = deg * DEGREES;
  return Array.from({ length: CAM_STEPS }, (_, index) => {
    const psi = (index / CAM_STEPS) * Math.PI * 2;
    const radius = camRadius(psi);
    const world = psi + turn;
    return [PIVOT[0] + radius * Math.cos(world), PIVOT[1] + radius * Math.sin(world)] as [number, number];
  });
}

export const armEnd = (deg: number): [number, number] => [
  PIVOT[0] + ARM * Math.cos(deg * DEGREES),
  PIVOT[1] + ARM * Math.sin(deg * DEGREES),
];

export interface Frame {
  cam: SolidPaths;
  camRim: string;
  arms: SolidPaths[];
  roller: SolidPaths;
  rollerRings: string;
  cable: string;
  rise: number;
  lever: number;
}

export function frameOf(deg: number): Frame {
  const section = camSection(deg);
  const end = armEnd(deg);
  const tangent = tangentAt(deg);
  return {
    cam: prismAlong("y", section, SIDE - CAM_HALF, SIDE + CAM_HALF, P),
    // The groove the cable sits in, drawn on the face you can see.
    camRim: sectionArc(
      "y",
      section.map(([x, z]) => {
        const dx = x - PIVOT[0];
        const dz = z - PIVOT[1];
        const length = Math.hypot(dx, dz) || 1;
        return [x - (dx / length) * 2, z - (dz / length) * 2] as [number, number];
      }),
      SIDE + CAM_HALF,
      P,
    ),
    arms: ([-1, 1] as const).map((side) =>
      prismAlong(
        "y",
        barSection([PIVOT[0], PIVOT[1]], end, ARM_HALF, 3),
        side * ARM_Y - 2.4,
        side * ARM_Y + 2.4,
        P,
      ),
    ),
    roller: prismAlong("y", circleSection(end[0], end[1], ROLLER_R, 28), -ROLLER_HALF, ROLLER_HALF, P),
    rollerRings: [-8, 0, 8]
      .map((y) => sectionArc("y", circleSection(end[0], end[1], ROLLER_R - 1.2, 24), y, P))
      .join(""),
    // The cable leaves the cam where it is tangent, and that point walks round
    // the profile as the cam turns. It is the whole mechanism in one line.
    cable: runOf(
      [
        [tangent.at[0], SIDE, tangent.at[1]],
        [TOUCH[0], SIDE, TOUCH[1]],
      ],
      P,
    ),
    rise: riseAt(deg),
    lever: tangent.radius,
  };
}

/** The arm's travel drawn as a faint trace, so the range is visible at rest. */
export function sweepPath(from: number, to: number, steps = 24) {
  const points = Array.from({ length: steps + 1 }, (_, index) => {
    const deg = from + ((to - from) * index) / steps;
    const end = armEnd(deg);
    return at([end[0], 0, end[1]]);
  });
  return pathOf(points);
}
