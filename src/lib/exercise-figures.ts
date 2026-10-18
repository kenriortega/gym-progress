import type { ComponentType } from "react";

/**
 * Which apparatus have an interactive figure.
 *
 * Keyed by `exercises.equipment_key`, a stable column, so renaming an exercise
 * no longer takes its figure away.
 */
const FIGURES: Record<string, () => Promise<ComponentType>> = {
  "lat-pulldown": () =>
    import("@/components/figures/lat-pulldown/figure").then((module) => module.LatPulldownFigure),
  "cable-station": () =>
    import("@/components/figures/cable-station/figure").then((module) => module.CableStationFigure),
  "leg-press": () =>
    import("@/components/figures/leg-press/figure").then((module) => module.LegPressFigure),
};

/**
 * Apparatus guessed from the exercise's name, for rows with no `equipment_key`.
 *
 * Two cases need this: exercises a user creates, which never get a key because
 * there is no UI to pick an apparatus, and system rows on a database where the
 * backfill migration has not run yet. So an exercise of your own called
 * "Jalón con barra" still shows the figure. The trade-off is that renaming
 * *that* one does lose it, exactly as before this column existed — the way out,
 * when it matters, is to let the create form set `equipment_key`.
 *
 * Keyed by the name with accents stripped, lowercased, spaces turned into
 * dashes. Only add an entry here when the name is unambiguous.
 */
const NAMES_TO_EQUIPMENT: Record<string, string> = {
  "jalon-con-barra": "lat-pulldown",
  "crunch-en-polea-alta": "cable-station",
  "extension-de-triceps-en-polea-con-barra-recta": "cable-station",
  "extension-de-triceps-en-polea-con-agarre-inverso": "cable-station",
  "extension-de-triceps-sobre-la-cabeza-con-cuerda": "cable-station",
  "prensa-de-piernas": "leg-press",
};

const normaliseName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-");

/** The apparatus to look a figure up by: the stored key, else guessed from the name. */
const figureKey = (equipmentKey: string | null, name: string) =>
  equipmentKey ?? NAMES_TO_EQUIPMENT[normaliseName(name)] ?? null;

export const loadFigure = (equipmentKey: string | null, name: string) => {
  const key = figureKey(equipmentKey, name);
  return key ? FIGURES[key] ?? null : null;
};

export const hasFigure = (equipmentKey: string | null, name: string) =>
  loadFigure(equipmentKey, name) !== null;
