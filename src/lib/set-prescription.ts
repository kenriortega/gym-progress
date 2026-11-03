export type PrescribedSet = {
  kind: "work" | "drop";
  repsMin: number | null;
  repsMax: number | null;
  rirMin: number | null;
  rirMax: number | null;
};
export type SetPrescription = {
  programId: string;
  microcycle: number;
  sessionIndex: number;
  exerciseIndex: number;
  page: number;
  raw: string;
  sets: PrescribedSet[];
};
export type ProgramCycle = { instanceId: string; programId: string; sessionIndex: number; microcycle: number };

const integer = (n: unknown, min: number, max: number) => typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const range = (min: unknown, max: unknown, low: number, high: number) =>
  min === null && max === null || integer(min, low, high) && integer(max, Number(min), high);

export function validPrescription(value: unknown): value is SetPrescription | null | undefined {
  if (value == null) return true;
  if (!record(value) || typeof value.programId !== "string" || !value.programId.length || value.programId.length > 100 ||
      !integer(value.microcycle, 1, 8) || !integer(value.sessionIndex, 0, 3) || !integer(value.exerciseIndex, 0, 19) ||
      !integer(value.page, 1, 20) || typeof value.raw !== "string" || !value.raw.trim() || value.raw.length > 300 ||
      !Array.isArray(value.sets) || !value.sets.length || value.sets.length > 20) return false;
  return value.sets.every((set: unknown) => record(set) &&
    (set.kind === "work" && range(set.repsMin, set.repsMax, 1, 1000) && integer(set.rirMin, 0, 4) && integer(set.rirMax, Number(set.rirMin), 4) ||
     set.kind === "drop" && set.repsMin === null && set.repsMax === null && set.rirMin === null && set.rirMax === null));
}

/** Solo interpreta la notación de las tablas de referencia; rechaza texto sobrante. */
export function parsePdfCell(raw: string): PrescribedSet[] {
  const compact = raw.replace(/\s/g, "");
  const pattern = /(\d+)x(?:(\d+)(?:-(\d+))?)?RIR([0-4])(?:-([0-4]))?/g;
  const sets: PrescribedSet[] = [];
  let remainder = compact.replace(pattern, (_match, count, min, max, rirMin, rirMax) => {
    if (!integer(Number(count), 1, 20)) throw new Error("Número de series PDF inválido.");
    for (let n = 0; n < Number(count); n++) sets.push({ kind: "work", repsMin: min ? Number(min) : null,
      repsMax: min ? Number(max ?? min) : null, rirMin: Number(rirMin), rirMax: Number(rirMax ?? rirMin) });
    return "";
  });
  remainder = remainder.replace(/\+?(\d+)DS/g, (_match, count) => {
    if (!integer(Number(count), 1, 20)) throw new Error("Número de drop sets PDF inválido.");
    for (let n = 0; n < Number(count); n++) sets.push({ kind: "drop", repsMin: null, repsMax: null, rirMin: null, rirMax: null });
    return "";
  }).replace(/\+/g, "");
  if (remainder || !sets.length || sets.length > 20 || sets.some((set) => set.repsMin !== null && set.repsMax! < set.repsMin || set.rirMin !== null && set.rirMax! < set.rirMin)) {
    throw new Error(`Prescripción PDF no reconocida: ${raw}`);
  }
  return sets;
}

export function formatPrescribedSet(set: PrescribedSet): string {
  if (set.kind === "drop") return "Drop set · repeticiones y reducción de carga sin especificar";
  const reps = set.repsMin === null ? "Repeticiones sin fijar" : `${set.repsMin}${set.repsMax !== set.repsMin ? `–${set.repsMax}` : ""} reps`;
  return `${reps} · RIR ${set.rirMin}${set.rirMax !== set.rirMin ? `–${set.rirMax}` : ""}`;
}

export function prescriptionTargets(prescription: SetPrescription) {
  const defined = prescription.sets.filter((set) => set.repsMin !== null);
  return { prescription, targetSets: prescription.sets.length,
    targetRepsMin: defined.length ? Math.min(...defined.map((set) => set.repsMin!)) : 1,
    targetRepsMax: defined.length ? Math.max(...defined.map((set) => set.repsMax!)) : 1000 };
}

/** En series diferenciadas se repone el hueco para conservar su objetivo. */
export function nextSetPosition(sets: Array<{ position: number }>, prescribed = false): number {
  if (!prescribed) return Math.max(-1, ...sets.map((set) => set.position)) + 1;
  const used = new Set(sets.map((set) => set.position));
  let position = 0;
  while (used.has(position)) position += 1;
  return position;
}

export function completedTargetSets(exercise: { prescription?: SetPrescription | null; sets: Array<{ position: number }> }): number {
  if (!exercise.prescription) return exercise.sets.length;
  return new Set(exercise.sets.filter((set) => set.position >= 0 && set.position < exercise.prescription!.sets.length).map((set) => set.position)).size;
}
