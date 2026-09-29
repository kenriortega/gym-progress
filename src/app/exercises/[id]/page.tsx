import { and, asc, eq, isNull, or } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import { exercises, workoutExercises, workouts, workoutSets } from "@/db/schema";

export default async function ExerciseProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const [exercise] = await db
    .select({ id: exercises.id, name: exercises.name, muscleGroup: exercises.muscleGroup })
    .from(exercises)
    .where(and(eq(exercises.id, id), or(isNull(exercises.userId), eq(exercises.userId, session.user.id))))
    .limit(1);
  if (!exercise) notFound();

  const rows = await db
    .select({
      workoutId: workouts.id,
      performedAt: workouts.performedAt,
      weight: workoutSets.weight,
      reps: workoutSets.reps,
      position: workoutSets.position,
    })
    .from(workoutSets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, workoutSets.workoutExerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(and(eq(workoutExercises.exerciseId, exercise.id), eq(workouts.userId, session.user.id), eq(workouts.status, "completed")))
    .orderBy(asc(workouts.performedAt), asc(workoutSets.position));

  const sessions = new Map<string, { id: string; date: Date; sets: Array<{ weight: number; reps: number }>; maxWeight: number; volume: number }>();
  for (const row of rows) {
    const current = sessions.get(row.workoutId) ?? { id: row.workoutId, date: row.performedAt, sets: [], maxWeight: 0, volume: 0 };
    const weight = Number(row.weight);
    current.sets.push({ weight, reps: row.reps });
    current.maxWeight = Math.max(current.maxWeight, weight);
    current.volume += weight * row.reps;
    sessions.set(row.workoutId, current);
  }

  const sessionList = Array.from(sessions.values());
  const bestSet = rows.reduce<{ weight: number; reps: number } | null>((best, row) => {
    const candidate = { weight: Number(row.weight), reps: row.reps };
    return !best || candidate.weight > best.weight || (candidate.weight === best.weight && candidate.reps > best.reps) ? candidate : best;
  }, null);
  const maxChartWeight = Math.max(...sessionList.map((item) => item.maxWeight), 1);
  const bestVolume = Math.max(...sessionList.map((item) => item.volume), 0);
  const dateFormatter = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "2-digit" });

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-12 pt-6">
      <header className="flex items-center gap-4">
        <Link href="/progress" className="grid size-11 place-items-center rounded-full border border-white/10 text-xl text-zinc-300" aria-label="Volver al progreso">←</Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-lime-300">{exercise.muscleGroup}</p>
          <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-white">{exercise.name}</h1>
        </div>
      </header>

      {bestSet ? (
        <>
          <section className="mt-7 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-lime-300 p-4 text-zinc-950">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-700">Récord de peso</p>
              <p className="mt-2 text-3xl font-black">{bestSet.weight} kg</p>
              <p className="mt-1 text-sm font-semibold text-zinc-700">× {bestSet.reps} reps</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Mejor volumen</p>
              <p className="mt-2 text-3xl font-black text-white">{Math.round(bestVolume)}</p>
              <p className="mt-1 text-sm font-semibold text-zinc-500">kg por sesión</p>
            </div>
          </section>

          <section className="mt-6 rounded-3xl border border-white/8 bg-white/[0.035] p-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm text-zinc-500">Peso máximo</p>
                <h2 className="mt-1 text-lg font-extrabold text-white">Evolución</h2>
              </div>
              <span className="text-sm font-bold text-lime-300">{sessionList.length} {sessionList.length === 1 ? "sesión" : "sesiones"}</span>
            </div>
            <div className="mt-6 flex h-44 items-end gap-2 overflow-x-auto pb-1">
              {sessionList.map((item) => (
                <div key={item.id} className="flex min-w-12 flex-1 flex-col items-center justify-end gap-2">
                  <span className="text-[11px] font-bold text-zinc-300">{item.maxWeight}</span>
                  <div className="w-full rounded-t-lg bg-lime-300" style={{ height: `${Math.max(10, (item.maxWeight / maxChartWeight) * 120)}px` }} />
                  <span className="whitespace-nowrap text-[10px] text-zinc-600">{dateFormatter.format(item.date)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6">
            <h2 className="text-lg font-extrabold text-white">Sesiones</h2>
            <div className="mt-3 space-y-3">
              {[...sessionList].reverse().map((item) => (
                <Link key={item.id} href={`/history/${item.id}`} className="block rounded-2xl border border-white/8 bg-white/[0.035] p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-bold capitalize text-white">{dateFormatter.format(item.date)}</p>
                    <p className="text-sm font-black text-lime-300">máx. {item.maxWeight} kg</p>
                  </div>
                  <p className="mt-2 text-sm text-zinc-500">{item.sets.map((set) => `${set.weight}×${set.reps}`).join(" · ")}</p>
                </Link>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="mt-10 rounded-3xl border border-dashed border-white/12 px-6 py-12 text-center">
          <h2 className="text-lg font-extrabold text-white">Sin series completadas</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">Este ejercicio todavía no tiene entrenamientos terminados.</p>
        </section>
      )}
    </main>
  );
}
