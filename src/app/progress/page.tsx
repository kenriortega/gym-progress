import { and, countDistinct, desc, eq, max } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import { exercises, workoutExercises, workouts, workoutSets } from "@/db/schema";

export default async function ProgressPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const summaries = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      muscleGroup: exercises.muscleGroup,
      workoutCount: countDistinct(workouts.id),
      bestWeight: max(workoutSets.weight),
      lastPerformedAt: max(workouts.performedAt),
    })
    .from(workoutSets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, workoutSets.workoutExerciseId))
    .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(and(eq(workouts.userId, session.user.id), eq(workouts.status, "completed")))
    .groupBy(exercises.id)
    .orderBy(desc(max(workouts.performedAt)));

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-12 pt-6">
      <header className="flex items-center gap-4">
        <Link href="/" className="grid size-11 place-items-center rounded-full border border-white/10 text-xl text-zinc-300" aria-label="Volver al inicio">←</Link>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-lime-300">Marcas personales</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Progreso por ejercicio</h1>
        </div>
      </header>

      {summaries.length > 0 ? (
        <section className="mt-8 space-y-3">
          {summaries.map((exercise) => (
            <Link key={exercise.id} href={`/exercises/${exercise.id}`} className="flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.035] p-4 transition hover:border-lime-300/30">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-lime-300/10 text-sm font-black text-lime-300">PR</div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-extrabold text-white">{exercise.name}</h2>
                <p className="mt-1 text-sm text-zinc-500">{exercise.muscleGroup} · {exercise.workoutCount} {exercise.workoutCount === 1 ? "sesión" : "sesiones"}</p>
              </div>
              <div className="text-right">
                <p className="font-black text-white">{Number(exercise.bestWeight)} kg</p>
                <p className="mt-1 text-xs text-zinc-600">máximo</p>
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <section className="mt-10 rounded-3xl border border-dashed border-white/12 px-6 py-12 text-center">
          <h2 className="text-lg font-extrabold text-white">Aún no hay progreso calculado</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">Finaliza una sesión para comenzar a ver tus récords y evolución.</p>
        </section>
      )}
    </main>
  );
}
