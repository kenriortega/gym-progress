import { validBlocks, validDiscipline, type Discipline, type TrainingBlock } from "../training-blocks";
import { validMetrics, validSet, type ExerciseMetrics, type SetMetrics } from "../training-metrics";
import type { Reschedule, SchedulablePlan } from "../schedule";

export type PreviousPerformance = {
  performedAt: string;
  weightUnit: "kg" | "lb";
  sets: Array<SetMetrics & { rpe: number | null }>;
};

export type OfflinePlanExercise = ExerciseMetrics & {
  id: string;
  exerciseId: string;
  name: string;
  muscleGroup: string;
  position: number;
  targetSets: number;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  notes: string | null;
  previous: PreviousPerformance | null;
};

export type OfflinePlan = SchedulablePlan & {
  description: string | null;
  exercises: OfflinePlanExercise[];
  discipline?: Discipline;
  blocks?: TrainingBlock[];
};

export type OfflinePlans = {
  schemaVersion: 1 | 2 | 3;
  userId: string;
  weightUnit: "kg" | "lb";
  generatedAt: number;
  plans: OfflinePlan[];
  reschedules: Reschedule[];
};

export type SavedOfflinePlans = {
  userId: string;
  savedAt: number;
  data: OfflinePlans;
};

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const nullableText = (value: unknown) => value === null || typeof value === "string";
const integer = (value: unknown, min: number, max: number) =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
const unit = (value: unknown) => value === "kg" || value === "lb";
const day = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

function performance(value: unknown): boolean {
  return value === null || (record(value) && text(value.performedAt) &&
    Number.isFinite(Date.parse(value.performedAt)) && unit(value.weightUnit) &&
    Array.isArray(value.sets) && value.sets.every((set: unknown) => record(set) &&
      validSet(set) &&
      (set.rpe === null || (typeof set.rpe === "number" && Number.isFinite(set.rpe) && set.rpe >= 1 && set.rpe <= 10))));
}

function exercise(value: unknown): boolean {
  return record(value) && text(value.id) && text(value.exerciseId) && text(value.name) &&
    text(value.muscleGroup) && integer(value.position, 0, 32767) &&
    validMetrics(value) && integer(value.targetSets, 1, 20) &&
    (value.measurement === "time" ? value.targetRepsMin === null && value.targetRepsMax === null : integer(value.targetRepsMin, 1, 1000) && integer(value.targetRepsMax, Number(value.targetRepsMin), 1000)) &&
    nullableText(value.notes) && performance(value.previous);
}

/** No sustituir una copia válida por una descarga incompleta o incompatible. */
export function isOfflinePlans(value: unknown): value is OfflinePlans {
  if (!record(value) || (value.schemaVersion !== 1 && value.schemaVersion !== 2 && value.schemaVersion !== 3) || !text(value.userId) || !unit(value.weightUnit) ||
      typeof value.generatedAt !== "number" || !Number.isFinite(value.generatedAt) ||
      !Array.isArray(value.plans) || !Array.isArray(value.reschedules)) return false;
  const validPlans = value.plans.every((plan: unknown) => record(plan) && text(plan.id) &&
    text(plan.name) && validDiscipline(plan.discipline ?? "strength") && nullableText(plan.description) &&
    (plan.weekday === null || integer(plan.weekday, 0, 6)) &&
    Array.isArray(plan.exercises) && plan.exercises.every(exercise) &&
    validBlocks(plan.blocks ?? [], plan.exercises.map((item: OfflinePlanExercise) => item.exerciseId)) &&
    new Set(plan.exercises.map((item: OfflinePlanExercise) => item.id)).size === plan.exercises.length);
  if (!validPlans) return false;
  const ids = new Set(value.plans.map((plan: OfflinePlan) => plan.id));
  return ids.size === value.plans.length && value.reschedules.every((item: unknown) =>
    record(item) && ids.has(String(item.planId)) && day(item.fromDate) && day(item.toDate));
}
