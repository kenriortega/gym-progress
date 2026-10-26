/** Contrato compartido entre formularios, IndexedDB y API. Ausencia = formato histórico. */
export type Measurement = "reps" | "time";
export type LoadType = "external" | "bodyweight" | "weighted" | "assisted";
export type ExerciseMetrics = {
  variation?: string | null;
  progressionSteps?: string[];
  progressionStep?: number | null;
  measurement?: Measurement;
  loadType?: LoadType;
  targetSeconds?: number | null;
};
export type SetMetrics = {
  reps: number;
  weight: number;
  durationSeconds?: number | null;
  loadType?: LoadType;
  assistanceNote?: string | null;
};
export const LOAD_LABELS: Record<LoadType, string> = {
  external: "Carga externa", bodyweight: "Peso corporal", weighted: "Con lastre", assisted: "Con asistencia",
};
export const isLoadType = (value: unknown): value is LoadType => typeof value === "string" && value in LOAD_LABELS && Object.hasOwn(LOAD_LABELS, value);
const integer = (value: unknown, min: number, max: number) => typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
export function validMetrics(value: Record<string, unknown>): boolean {
  const measurement = value.measurement ?? "reps";
  const steps = value.progressionSteps ?? [];
  const step = value.progressionStep ?? null;
  if (!(value.variation == null || typeof value.variation === "string" && value.variation.trim().length > 0 && value.variation.length <= 120) ||
      !Array.isArray(steps) || steps.length > 12 || !steps.every((item) => typeof item === "string" && item.trim().length > 0 && item.length <= 120) || new Set(steps).size !== steps.length ||
      (steps.length ? !integer(step, 1, steps.length) || value.variation !== steps[Number(step) - 1] : step !== null)) return false;
  return (measurement === "reps" || measurement === "time") && isLoadType(value.loadType ?? "external") &&
    (measurement === "time" ? integer(value.targetSeconds, 1, 86400) : value.targetSeconds == null);
}
export function validSet(value: Record<string, unknown>): boolean {
  const type = value.loadType ?? "external";
  const note = value.assistanceNote;
  return isLoadType(type) && typeof value.weight === "number" && Number.isFinite(value.weight) && value.weight >= 0 && value.weight <= 99999 &&
    (value.durationSeconds == null ? integer(value.reps, 1, 1000) : integer(value.durationSeconds, 1, 86400) && value.reps === 0) &&
    (note == null || typeof note === "string" && note.trim().length > 0 && note.length <= 120) &&
    (type === "bodyweight" ? value.weight === 0 : type === "assisted" ? value.weight > 0 || typeof note === "string" && note.trim().length > 0 : true) &&
    (type === "assisted" || note == null);
}
export function sameVariant(a: ExerciseMetrics, b: ExerciseMetrics): boolean {
  return (a.measurement ?? "reps") === (b.measurement ?? "reps") && (a.loadType ?? "external") === (b.loadType ?? "external") && (a.variation ?? "") === (b.variation ?? "");
}
export function matchesExercise(set: SetMetrics, exercise: ExerciseMetrics): boolean {
  return (set.loadType ?? "external") === (exercise.loadType ?? "external") &&
    (set.durationSeconds != null) === (exercise.measurement === "time");
}
export function formatSet(set: SetMetrics, unit: string, formatLoad = (weight: number) => `${weight} ${unit}`): string {
  const result = set.durationSeconds != null ? `${set.durationSeconds} s` : `${set.reps} reps`;
  switch (set.loadType ?? "external") {
    case "bodyweight": return `${result} · peso corporal`;
    case "weighted": return `${result} · +${formatLoad(set.weight)} de lastre`;
    case "assisted": return `${result} · ${set.weight > 0 ? `${formatLoad(set.weight)} de asistencia` : "banda"}${set.assistanceNote ? ` (${set.assistanceNote})` : ""}`;
    default: return set.durationSeconds != null ? `${set.durationSeconds} s · ${formatLoad(set.weight)}` : `${formatLoad(set.weight)} × ${set.reps}`;
  }
}
export function formatTarget(value: ExerciseMetrics & { targetSets: number | null; targetRepsMin: number | null; targetRepsMax: number | null }): string {
  const target = value.measurement === "time" ? `${value.targetSeconds} s` : `${value.targetRepsMin ?? "—"}${value.targetRepsMax !== value.targetRepsMin ? `–${value.targetRepsMax ?? "—"}` : ""} reps`;
  return `${value.targetSets ?? "—"} ${value.targetSets === 1 ? "serie" : "series"} · ${target} · ${LOAD_LABELS[value.loadType ?? "external"]}${value.variation ? ` · ${value.variation}` : ""}`;
}
export function parseTargets(form: FormData) {
  const progressionSteps = String(form.get("progressionSteps") ?? "").split("\n").map((item) => item.trim()).filter(Boolean);
  const progressionStep = progressionSteps.length ? Number(form.get("progressionStep") ?? 1) : null;
  const variation = progressionSteps.length ? progressionSteps[Number(progressionStep) - 1] : String(form.get("variation") ?? "").trim() || null;
  const measurement = String(form.get("measurement") ?? "reps") as Measurement;
  const loadType = String(form.get("loadType") ?? "external") as LoadType;
  const targetSeconds = measurement === "time" ? Number(form.get("targetSeconds")) : null;
  const targetSets = Number(form.get("targetSets"));
  const targetRepsMin = measurement === "time" ? null : Number(form.get("targetRepsMin"));
  const targetRepsMax = measurement === "time" ? null : Number(form.get("targetRepsMax"));
  if (!validMetrics({ measurement, loadType, targetSeconds, variation, progressionSteps, progressionStep }) || !integer(targetSets, 1, 20) ||
      measurement === "reps" && (!integer(targetRepsMin, 1, 1000) || !integer(targetRepsMax, Number(targetRepsMin), 1000))) {
    throw new Error("Revisa el objetivo: 1–20 series, 1–1000 repeticiones o 1–86400 segundos.");
  }
  return { measurement, loadType, targetSeconds, targetSets, targetRepsMin, targetRepsMax, variation, progressionSteps, progressionStep };
}
