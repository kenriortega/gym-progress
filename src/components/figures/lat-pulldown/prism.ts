import { cameraOf, depthOf, iso, pathOf, type Flat, type Point3, type Projection, type SolidPaths } from "@/components/iso/iso-kit";

// A prism lying along x or y: the kit's `extrude` only stands sections up on the
// floor, and a gym machine is full of parts that lie down instead — the sheaves of
// a pulley, the lat bar, the thigh rollers, the pin, the gusset under the boom.
// A section is given in the two axes the prism does not run along, counter-clockwise
// in that plane: [x, z] for a prism along y, [y, z] for one along x.

const SHADES = 4;

export type Section = Array<[number, number]>;

const area = (points: Flat[]) => {
  let sum = 0;
  for (let index = 0; index < points.length; index++) {
    const [ax, ay] = points[index]!;
    const [bx, by] = points[(index + 1) % points.length]!;
    sum += ax * by - bx * ay;
  }
  return sum / 2;
};

const wound = (points: Flat[]) => (area(points) < 0 ? [...points].reverse() : points);

function hullOf(points: Flat[]): Flat[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  const cross = (o: Flat, a: Flat, b: Flat) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: Flat[]) => {
    const out: Flat[] = [];
    for (const point of list) {
      while (out.length > 1 && cross(out[out.length - 2]!, out[out.length - 1]!, point) <= 0) out.pop();
      out.push(point);
    }
    out.pop();
    return out;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

export const circleSection = (cx: number, cz: number, radius: number, steps = 44): Section =>
  Array.from({ length: steps }, (_, index) => {
    const angle = (index / steps) * Math.PI * 2;
    return [cx + radius * Math.cos(angle), cz + radius * Math.sin(angle)] as [number, number];
  });

export function stadiumSection(cx: number, cz: number, radius: number, half: number, steps = 18): Section {
  const out: Section = [];
  for (let index = 0; index <= steps; index++) {
    const angle = -Math.PI / 2 + (index / steps) * Math.PI;
    out.push([cx + half + radius * Math.sin(angle), cz + radius * Math.cos(angle)]);
  }
  for (let index = 0; index <= steps; index++) {
    const angle = Math.PI / 2 + (index / steps) * Math.PI;
    out.push([cx - half + radius * Math.sin(angle), cz + radius * Math.cos(angle)]);
  }
  return out;
}

export const pointOn = (axis: "x" | "y", [u, z]: [number, number], along: number): Point3 =>
  axis === "y" ? [u, along, z] : [along, u, z];

/** The world normal of a section edge, and of the two end caps. */
const normalOf = (axis: "x" | "y", du: number, dz: number): Point3 => {
  const length = Math.hypot(du, dz) || 1;
  return axis === "y" ? [dz / length, 0, -du / length] : [0, dz / length, -du / length];
};

export interface PrismOptions {
  /** Steps per section point are implicit: pass the section already sampled. */
  bevel?: boolean;
}

/**
 * Builds the same `SolidPaths` the kit's own solids return, so `<Solid>` paints it:
 * paper fill, four shade buckets by facing, the near cap as the lit "top" face, the
 * crease where that cap meets the sides, and the silhouette.
 */
export function prismAlong(axis: "x" | "y", section: Section, from: number, to: number, P: Projection): SolidPaths {
  const { sinA, cosA } = cameraOf(P);
  const light: Point3 = [-sinA, cosA, 0.62];
  const scale = Math.hypot(light[0], light[1], light[2]);
  const ring = area(section.map(([u, z]) => [u, z] as Flat)) < 0 ? [...section].reverse() : section;
  const count = ring.length;

  const near = depthOf(pointOn(axis, [0, 0], to), P) > depthOf(pointOn(axis, [0, 0], from), P) ? to : from;
  const far = near === to ? from : to;
  const atNear = ring.map((point) => iso(pointOn(axis, point, near), P));
  const atFar = ring.map((point) => iso(pointOn(axis, point, far), P));

  const buckets: string[][] = Array.from({ length: SHADES }, () => []);
  const outline: string[] = [];
  const visible: boolean[] = [];

  for (let index = 0; index < count; index++) {
    const [u0, z0] = ring[index]!;
    const [u1, z1] = ring[(index + 1) % count]!;
    const normal = normalOf(axis, u1 - u0, z1 - z0);
    visible.push(depthOf(normal, P) > 1e-9);
  }

  for (let index = 0; index < count; index++) {
    if (!visible[index]) continue;
    const next = (index + 1) % count;
    const [u0, z0] = ring[index]!;
    const [u1, z1] = ring[next]!;
    const normal = normalOf(axis, u1 - u0, z1 - z0);
    const lit = (normal[0] * light[0] + normal[1] * light[1] + normal[2] * light[2]) / scale;
    const shade = Math.min(SHADES - 1, Math.max(0, Math.floor(((lit + 1) / 2) * SHADES)));
    buckets[shade]!.push(pathOf(wound([atFar[index]!, atFar[next]!, atNear[next]!, atNear[index]!]), true));
  }

  // The cap that faces the viewer is the brightest face, like a kit solid's top.
  const cap = pathOf(wound(atNear), true);

  // The silhouette, plus the two edges where the visible band meets the hidden one.
  outline.push(pathOf(hullOf([...atNear, ...atFar]), true));
  const crease: string[] = [];
  for (let index = 0; index < count; index++) {
    const next = (index + 1) % count;
    if (visible[index] && visible[next]) continue;
    if (visible[index] || visible[next]) crease.push(pathOf([atNear[next]!, atFar[next]!]));
  }

  return {
    fill: pathOf(hullOf([...atNear, ...atFar]), true),
    outline: outline.join(""),
    crease: crease.join(""),
    top: cap,
    shades: buckets.map((paths) => paths.join("")),
  };
}

/** The visible arc of a ring in the prism's own section plane, for grooves and seams. */
export function sectionArc(axis: "x" | "y", section: Section, along: number, P: Projection) {
  return pathOf(section.map((point) => iso(pointOn(axis, point, along), P)), true);
}

/** A run of world points as one path, for cables and rules. */
export const runOf = (points: Point3[], P: Projection) => pathOf(points.map((point) => iso(point, P)), false);
