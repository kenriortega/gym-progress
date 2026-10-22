// Extrae la silueta y los músculos de MuscleMap (MIT, Melih Colpan) a un módulo
// TypeScript que la app pueda pintar.
//
//   node scripts/extract-body-paths.mjs /ruta/al/clon/de/MuscleMap
//
// MuscleMap guarda sus paths como cadenas SVG dentro de arrays de Swift, así que
// esto es una extracción, no una conversión: los `d` salen tal cual.
//
// Para enriquecer el mapa más adelante basta con mover un slug de REGIONS a otra
// región, o sacarlo de IGNORED, y volver a ejecutarlo.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Las doce regiones con las que empezamos, y los slugs de MuscleMap que caen en
 * cada una. Su granularidad es mucho mayor (37 regiones: pecho superior e
 * inferior, cuádriceps interno y externo, deltoides anterior y posterior…), pero
 * un mapa con doce zonas se lee de un vistazo y se mantiene con doce datos por
 * ejercicio en vez de treinta y siete.
 */
const REGIONS = {
  pecho: ["chest", "serratus"],
  espalda: ["upperBack", "rhomboids", "trapezius"],
  lumbar: ["lowerBack"],
  hombros: ["deltoids", "rotatorCuff"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  antebrazo: ["forearm"],
  abdomen: ["abs", "obliques"],
  gluteos: ["gluteal"],
  cuadriceps: ["quadriceps", "hipFlexors"],
  isquios: ["hamstring"],
  gemelos: ["calves"],
};

/**
 * MuscleMap trae dos versiones del mismo músculo: una gruesa (`chest`) y otra
 * fina (`upperChest`, `lowerChest`). Cubren los mismos píxeles, así que unirlas
 * en un solo path hace que los contornos opuestos se anulen y abran agujeros:
 * el pecho salía vacío. Usamos solo la gruesa.
 *
 * Aquí está el camino para enriquecer el mapa: saca un slug de esta lista,
 * dale su propia región arriba, y tendrás pecho superior e inferior aparte.
 */
const FINER = [
  "upperChest",
  "lowerChest",
  "upperAbs",
  "lowerAbs",
  "upperTrapezius",
  "lowerTrapezius",
  "frontDeltoid",
  "rearDeltoid",
  "innerQuad",
  "outerQuad",
];

/** Lo que no es músculo entrenable dibuja el cuerpo, en un tono neutro. */
// Aductores y tibial van aquí, no a una región: teñir la cara interna del muslo
// al entrenar femoral, o la espinilla al entrenar gemelo, diría algo falso.
const SILHOUETTE = ["head", "hair", "neck", "hands", "feet", "knees", "ankles", "adductors", "tibialis"];

const VIEWBOX = { front: "0 95 727 1280", back: "718 95 727 1280" };

const regionOf = (slug) => {
  for (const [region, slugs] of Object.entries(REGIONS)) {
    if (slugs.includes(slug)) return region;
  }
  if (FINER.includes(slug)) return null;
  return SILHOUETTE.includes(slug) ? "silueta" : null;
};

/** Todas las entradas `BodyPartPathData(slug: .x, left: [...], right: [...])`. */
function parse(source) {
  const entries = [];
  const start = /BodyPartPathData\(\s*slug:\s*\.(\w+)\s*,/g;
  let match;
  while ((match = start.exec(source))) {
    // Hasta el cierre del paréntesis de esta entrada, que es la línea con el
    // mismo sangrado con el que abrió.
    const rest = source.slice(match.index);
    const end = rest.indexOf("\n        ),");
    const body = rest.slice(0, end === -1 ? rest.length : end);
    const paths = [...body.matchAll(/"(M[^"]+)"/g)].map((item) => item[1]);
    if (paths.length) entries.push({ slug: match[1], paths });
  }
  return entries;
}

function sideOf(root, file) {
  const entries = parse(readFileSync(join(root, "Sources/MuscleMap/Data", file), "utf8"));
  const regions = {};
  const silhouette = [];
  const skipped = new Set();

  for (const { slug, paths } of entries) {
    const region = regionOf(slug);
    if (!region) {
      skipped.add(slug);
      continue;
    }
    // Varios subpaths en un solo `d`: SVG lo admite, y así cada región es un
    // único elemento que se tiñe de una vez.
    if (region === "silueta") silhouette.push(...paths);
    else (regions[region] ??= []).push(...paths);
  }

  return {
    regions: Object.fromEntries(Object.entries(regions).map(([key, paths]) => [key, paths.join(" ")])),
    silhouette: silhouette.join(" "),
    skipped: [...skipped],
  };
}

const root = process.argv[2];
if (!root) {
  console.error("Falta la ruta al clon de MuscleMap.");
  process.exit(1);
}

const front = sideOf(root, "MaleFrontPaths.swift");
const back = sideOf(root, "MaleBackPaths.swift");

const output = `// Generado por scripts/extract-body-paths.mjs. No editar a mano.
//
// Siluetas y músculos derivados de MuscleMap (https://github.com/melihcolpan/MuscleMap)
// por Melih Colpan, usados bajo licencia MIT. Los paths son los suyos tal cual;
// lo único que hacemos es agrupar sus regiones en las nuestras.
//
// MIT License · Copyright (c) 2026 Melih Colpan

export const BODY_VIEWBOX = ${JSON.stringify(VIEWBOX, null, 2)} as const;

/** Las regiones que la app tiñe, por lado. Una región puede faltar en un lado. */
export const BODY_REGIONS = {
  front: ${JSON.stringify(front.regions, null, 4).replace(/\n/g, "\n  ")},
  back: ${JSON.stringify(back.regions, null, 4).replace(/\n/g, "\n  ")},
} as const;

/** Cabeza, cuello, manos y pies: dibujan el cuerpo, no se tiñen. */
export const BODY_SILHOUETTE = {
  front: ${JSON.stringify(front.silhouette)},
  back: ${JSON.stringify(back.silhouette)},
} as const;

export type BodySide = keyof typeof BODY_REGIONS;
export type MuscleRegion = keyof (typeof BODY_REGIONS)["front"] | keyof (typeof BODY_REGIONS)["back"];
`;

writeFileSync("src/lib/body-paths.ts", output);

console.log(`frente: ${Object.keys(front.regions).length} regiones`);
console.log(`espalda: ${Object.keys(back.regions).length} regiones`);
const skipped = [...new Set([...front.skipped, ...back.skipped])];
if (skipped.length) console.log(`sin usar: ${skipped.join(", ")}`);
console.log(`escrito src/lib/body-paths.ts (${(output.length / 1024).toFixed(0)} KB)`);
