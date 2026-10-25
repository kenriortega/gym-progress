import { and, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { workouts, workoutExercises } from "@/db/schema";
import { describeBlock, describeResult, type TrainingBlock, type BlockResult } from "@/lib/training-blocks";

/** Resultados comparables: receta, objetivos y adaptación idénticos. */
export async function BlockProgressHistory({ userId }: { userId: string }) {
  const sessions = await db.select({ id: workouts.id, date: workouts.performedAt, blocks: workouts.blocks, progress: workouts.blockProgress, unit: workouts.weightUnit }).from(workouts)
    .where(and(eq(workouts.userId, userId), eq(workouts.status, "completed"))).orderBy(desc(workouts.performedAt)).limit(100);
  if (!sessions.length) return null;
  const exercises = await db.select().from(workoutExercises).where(inArray(workoutExercises.workoutId, sessions.map((item) => item.id)));
  type Entry = { block: TrainingBlock; scores: Array<{ workoutId: string; date: Date; result: BlockResult }> };
  const groups = new Map<string, Entry>();
  for (const session of sessions) for (const block of session.blocks) {
    const result = session.progress[block.id]?.result;
    if (!result || block.format === "sets") continue;
    const prescription = block.exerciseIds.map((id) => {
      const exercise = exercises.find((item) => item.workoutId === session.id && item.exerciseId === id);
      return exercise ? { id, measurement: exercise.measurement, loadType: exercise.loadType, variation: exercise.variation,
        min: exercise.targetRepsMin, max: exercise.targetRepsMax, seconds: exercise.targetSeconds, notes: exercise.notes } : { id };
    });
    const key = JSON.stringify({ name: block.name, format: block.format, prescription: block.prescription ?? null, rounds: block.rounds,
      duration: block.durationSeconds, cap: block.timeCapSeconds, interval: block.intervalSeconds, movements: prescription,
      unit: session.unit, adaptation: result.adaptation, note: result.adaptationNote });
    const entry = groups.get(key) ?? { block, scores: [] };
    entry.scores.push({ workoutId: session.id, date: session.date, result }); groups.set(key, entry);
  }
  if (!groups.size) return null;
  const better = (block: TrainingBlock, a: BlockResult, b: BlockResult) => {
    if (block.format === "for-time") {
      if (a.completed !== b.completed) return a.completed;
      if (a.completed) return Number(a.durationSeconds) < Number(b.durationSeconds);
    }
    if (block.format === "emom") return a.intervals > b.intervals;
    return a.rounds > b.rounds || a.rounds === b.rounds && a.reps > b.reps;
  };
  return <section className="mt-8" aria-label="Progreso de circuitos y WOD">
    <h2 className="text-xl font-bold">Circuitos y WOD</h2>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">Comparamos la misma receta, objetivos y adaptación en las últimas 100 sesiones. Rx y Scaled tienen marcas separadas; anota los cambios de carga o movimiento al adaptar.</p>
    <div className="mt-4 divide-y divide-border">{[...groups.entries()].map(([key, entry]) => {
      const best = entry.scores.reduce((a, b) => better(entry.block, a.result, b.result) ? a : b);
      return <article key={key} className="py-5"><h3 className="font-semibold">{entry.block.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{describeBlock(entry.block)}</p>
        {entry.block.prescription && <p className="mt-2 text-sm">{entry.block.prescription}</p>}
        <p className="mt-3 font-semibold">Mejor: {describeResult(entry.block, best.result)}</p>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">{entry.scores.slice(0, 5).map((score) => <li key={score.workoutId}><Link href={`/history/${score.workoutId}`} className="underline underline-offset-4">{score.date.toLocaleDateString("es")}</Link> · {describeResult(entry.block, score.result)}</li>)}</ul>
      </article>;
    })}</div>
  </section>;
}
