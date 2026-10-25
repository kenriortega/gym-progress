export const DISCIPLINES = { strength: "Musculación", calisthenics: "Calistenia", crossfit: "CrossFit", mixed: "Mixto" } as const;
export type Discipline = keyof typeof DISCIPLINES;
export const validDiscipline = (value: unknown): value is Discipline => typeof value === "string" && Object.hasOwn(DISCIPLINES, value);
export type BlockFormat = "sets" | "circuit" | "amrap" | "for-time" | "emom";
export const BLOCK_LABELS: Record<BlockFormat, string> = { sets: "Series", circuit: "Circuito", amrap: "AMRAP", "for-time": "Por tiempo", emom: "EMOM" };
export type TrainingBlock = {
  id: string; name: string; prescription?: string | null; format: BlockFormat; exerciseIds: string[];
  rounds: number | null; durationSeconds: number | null; timeCapSeconds: number | null; intervalSeconds: number | null;
};
export type BlockResult = {
  rounds: number; reps: number; durationSeconds: number | null; intervals: number;
  completed: boolean; adaptation: "rx" | "scaled"; adaptationNote: string | null;
};
export type BlockProgress = {
  startedAt: number | null; elapsedSeconds: number; result: BlockResult | null;
  updatedAt: number; mutationId: string;
};
export type BlockProgressMap = Record<string, BlockProgress>;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const int = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function validBlocks(value: unknown, exerciseIds: string[]): value is TrainingBlock[] {
  if (!Array.isArray(value) || value.length > 50) return false;
  const blocks = new Set<string>(), assigned = new Set<string>();
  return value.every((block) => {
    if (!record(block) || !uuid(block.id) || blocks.has(block.id) || typeof block.name !== "string" || !block.name.trim() || block.name.length > 100 ||
        !(block.prescription == null || typeof block.prescription === "string" && block.prescription.length <= 2000) ||
        typeof block.format !== "string" || !Object.hasOwn(BLOCK_LABELS, block.format) || !Array.isArray(block.exerciseIds) || !block.exerciseIds.length ||
        !block.exerciseIds.every((id) => typeof id === "string" && exerciseIds.includes(id) && !assigned.has(id))) return false;
    if (new Set(block.exerciseIds).size !== block.exerciseIds.length) return false;
    const { format, rounds, durationSeconds, intervalSeconds, timeCapSeconds } = block;
    if ((format === "circuit" || format === "for-time" ? !int(rounds, 1, 1000) : rounds !== null) ||
        (format === "amrap" || format === "emom" ? !int(durationSeconds, 1, 86400) : durationSeconds !== null) ||
        (format === "emom" ? !int(intervalSeconds, 1, 3600) || Number(durationSeconds) % Number(intervalSeconds) !== 0 : intervalSeconds !== null) ||
        (format === "for-time" ? timeCapSeconds !== null && !int(timeCapSeconds, 1, 86400) : timeCapSeconds !== null)) return false;
    blocks.add(block.id); block.exerciseIds.forEach((id) => assigned.add(id)); return true;
  });
}
export function validProgress(value: unknown, block: TrainingBlock): value is BlockProgress {
  if (!record(value) || !int(value.elapsedSeconds, 0, 86400 * 7) || !int(value.updatedAt, 0, Number.MAX_SAFE_INTEGER) || !uuid(value.mutationId) ||
      !(value.startedAt === null || int(value.startedAt, 0, Number.MAX_SAFE_INTEGER))) return false;
  const r = value.result;
  if (r === null) return true;
  if (!record(r) || !int(r.rounds, 0, 10000) || !int(r.reps, 0, 100000) || !int(r.intervals, 0, 86400) || typeof r.completed !== "boolean" ||
      !(r.durationSeconds === null || int(r.durationSeconds, 1, 86400 * 7)) || (r.adaptation !== "rx" && r.adaptation !== "scaled") ||
      !(r.adaptationNote === null || typeof r.adaptationNote === "string" && r.adaptationNote.trim().length > 0 && r.adaptationNote.length <= 1000) ||
      (r.adaptation === "scaled" && !r.adaptationNote)) return false;
  if (block.format === "circuit" && (r.rounds > Number(block.rounds) || r.completed !== (r.rounds === block.rounds))) return false;
  if (block.format === "for-time" && r.completed && r.rounds !== block.rounds) return false;
  if (block.format === "for-time" && (r.completed ? r.durationSeconds === null || block.timeCapSeconds !== null && r.durationSeconds > block.timeCapSeconds : r.durationSeconds === null || block.timeCapSeconds !== null && r.durationSeconds !== block.timeCapSeconds)) return false;
  if (block.format === "emom" && (r.intervals > Number(block.durationSeconds) / Number(block.intervalSeconds) || r.completed !== (r.intervals === Number(block.durationSeconds) / Number(block.intervalSeconds)))) return false;
  return true;
}
export function elapsedBlock(progress?: BlockProgress, now = Date.now()): number {
  return Math.max(0, Math.floor((progress?.elapsedSeconds ?? 0) + (progress?.startedAt == null ? 0 : (now - progress.startedAt) / 1000)));
}
export function describeBlock(block: TrainingBlock): string {
  switch (block.format) {
    case "sets": return "Series individuales";
    case "circuit": return `${block.rounds} rondas`;
    case "amrap": return `AMRAP · ${block.durationSeconds! / 60} min`;
    case "for-time": return `${block.rounds} rondas por tiempo${block.timeCapSeconds ? ` · límite ${block.timeCapSeconds / 60} min` : ""}`;
    case "emom": return `${block.durationSeconds! / 60} min · cada ${block.intervalSeconds} s`;
  }
}
export function describeResult(block: TrainingBlock, result: BlockResult): string {
  const score = block.format === "for-time" ? result.completed ? `${result.durationSeconds} s` : `Límite alcanzado · ${result.rounds} rondas + ${result.reps} reps` : block.format === "emom" ? `${result.intervals} intervalos` : `${result.rounds} rondas${result.reps ? ` + ${result.reps} reps` : ""}`;
  return `${score} · ${result.adaptation === "rx" ? "Según plan" : `Adaptado: ${result.adaptationNote}`}`;
}
