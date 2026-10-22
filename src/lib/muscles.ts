/**
 * Las doce regiones del mapa corporal. Empezamos con doce a propósito: MuscleMap
 * distingue treinta y siete, pero cada una es un dato que hay que decidir y
 * mantener por ejercicio, y doce ya cuentan la historia de un entreno.
 *
 * Para añadir una, muévela de la silueta a su propia región en
 * `scripts/extract-body-paths.mjs`, vuelve a ejecutarlo, y añádela aquí.
 */
export const MUSCLE_REGIONS = [
  "pecho",
  "espalda",
  "lumbar",
  "hombros",
  "biceps",
  "triceps",
  "antebrazo",
  "abdomen",
  "gluteos",
  "cuadriceps",
  "isquios",
  "gemelos",
] as const;

export type MuscleRegion = (typeof MUSCLE_REGIONS)[number];

export const MUSCLE_LABELS: Record<MuscleRegion, string> = {
  pecho: "pecho",
  espalda: "espalda",
  lumbar: "lumbares",
  hombros: "hombros",
  biceps: "bíceps",
  triceps: "tríceps",
  antebrazo: "antebrazo",
  abdomen: "abdomen",
  gluteos: "glúteos",
  cuadriceps: "cuádriceps",
  isquios: "isquios",
  gemelos: "gemelos",
};

export const isMuscleRegion = (value: string): value is MuscleRegion =>
  (MUSCLE_REGIONS as readonly string[]).includes(value);

/**
 * Cuánto cuenta un músculo secundario frente a uno primario. El press de banca
 * trabaja el tríceps de verdad, pero no como el pecho, y pintarlos igual haría
 * que el mapa dijese que todo se entrena por igual.
 */
export const SECONDARY_SHARE = 0.4;

export const weightOf = (role: "primary" | "secondary") =>
  role === "primary" ? 1 : SECONDARY_SHARE;
