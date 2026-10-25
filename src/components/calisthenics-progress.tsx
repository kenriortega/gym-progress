import { and, desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { exercises, workoutExercises, workouts, workoutSets } from "@/db/schema";
import { formatSet, LOAD_LABELS, type SetMetrics } from "@/lib/training-metrics";

/** Comparar únicamente la misma variante, carga y asistencia; nunca kilos con segundos. */
export async function CalisthenicsProgress({ userId, exerciseId }: { userId: string; exerciseId?: string }) {
  const rows = await db.select({
    variation: workoutExercises.variation, progressionSteps: workoutExercises.progressionSteps, progressionStep: workoutExercises.progressionStep,
    exerciseId: exercises.id, name: exercises.name, workoutId: workouts.id, date: workouts.performedAt,
    unit: workouts.weightUnit, weight: workoutSets.weight, reps: workoutSets.reps,
    loadType: workoutSets.loadType, durationSeconds: workoutSets.durationSeconds, assistanceNote: workoutSets.assistanceNote,
  }).from(workoutSets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, workoutSets.workoutExerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
    .where(and(eq(workouts.userId, userId), eq(workouts.status, "completed"),
      sql`(${workoutSets.loadType} <> 'external' or ${workoutSets.durationSeconds} is not null or ${workoutExercises.variation} is not null)`,
      exerciseId ? eq(exercises.id, exerciseId) : undefined))
    .orderBy(desc(workouts.performedAt), desc(workoutSets.position)).limit(500);
  if (!rows.length) return null;
  type Entry = { exerciseId: string; name: string; best: SetMetrics; sessions: Set<string>; recent: Array<{ workoutId: string; date: Date; value: SetMetrics }> };
  const groups = new Map<string, Entry>();
  for (const row of rows) {
    const kg = Math.round(Number(row.weight) * (row.unit === "lb" ? 0.45359237 : 1) * 100) / 100;
    const value: SetMetrics = { ...row, weight: kg };
    const key = JSON.stringify([row.exerciseId, row.variation, row.loadType, row.durationSeconds != null, kg, row.assistanceNote?.trim().toLocaleLowerCase() ?? ""]);
    const entry = groups.get(key) ?? { exerciseId: row.exerciseId, name: `${row.name}${row.variation ? ` · ${row.variation}` : ""}`, best: value, sessions: new Set<string>(), recent: [] };
    if ((value.durationSeconds ?? value.reps) > (entry.best.durationSeconds ?? entry.best.reps)) entry.best = value;
    entry.sessions.add(row.workoutId);
    if (entry.recent.length < 5) entry.recent.push({ workoutId: row.workoutId, date: row.date, value });
    groups.set(key, entry);
  }
  return <section className="mt-8" aria-label="Progreso de calistenia y tiempo">
    <h2 className="text-xl font-bold">Calistenia y series por tiempo</h2>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">Mejor registro bajo la misma carga y asistencia. Kilos normalizados; las bandas se comparan por su descripción. Se consultan las últimas 500 series.</p>
    <div className="mt-4 divide-y divide-border">
      {[...groups.entries()].map(([key, entry]) => <article key={key} className="py-5">
        <Link href={`/exercises/${entry.exerciseId}`} className="font-semibold underline-offset-4 hover:underline">{entry.name}</Link>
        <p className="mt-1 text-sm text-muted-foreground">{LOAD_LABELS[entry.best.loadType ?? "external"]} · {entry.sessions.size} sesiones</p>
        <p className="mt-2 font-semibold">Mejor: {formatSet(entry.best, "kg")}</p>
        <details className="mt-3 text-sm">
          <summary className="min-h-11 cursor-pointer py-2 underline underline-offset-4">Ver registros recientes</summary>
          <ul className="space-y-3 text-muted-foreground">{entry.recent.map((item, index) => <li key={index}>
            <Link href={`/history/${item.workoutId}`} className="underline underline-offset-4">{item.date.toLocaleDateString("es")}</Link> · {formatSet(item.value, "kg")}
          </li>)}</ul>
        </details>
      </article>)}
    </div>
  </section>;
}
