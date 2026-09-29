import { and, count, countDistinct, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import {
  trainingPlans,
  workoutExercises,
  workouts,
  workoutSets,
} from "@/db/schema";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default async function HistoryPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const history = await db
    .select({
      id: workouts.id,
      performedAt: workouts.performedAt,
      weightUnit: workouts.weightUnit,
      planName: trainingPlans.name,
      exerciseCount: countDistinct(workoutExercises.id),
      setCount: count(workoutSets.id),
    })
    .from(workouts)
    .leftJoin(trainingPlans, eq(trainingPlans.id, workouts.trainingPlanId))
    .leftJoin(workoutExercises, eq(workoutExercises.workoutId, workouts.id))
    .leftJoin(
      workoutSets,
      eq(workoutSets.workoutExerciseId, workoutExercises.id),
    )
    .where(
      and(
        eq(workouts.userId, session.user.id),
        eq(workouts.status, "completed"),
      ),
    )
    .groupBy(workouts.id, trainingPlans.name)
    .orderBy(desc(workouts.performedAt));

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-12 pt-6">
      <header className="flex items-center gap-4">
        <Link
          href="/"
          className="grid size-11 place-items-center rounded-full border border-white/10 text-xl text-zinc-300"
          aria-label="Volver al inicio"
        >
          ←
        </Link>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-lime-300">
            Tu progreso
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
            Historial de entrenamientos
          </h1>
        </div>
      </header>

      {history.length > 0 ? (
        <section className="mt-8 space-y-3">
          {history.map((workout, index) => (
            <Link
              key={workout.id}
              href={`/history/${workout.id}`}
              className="block rounded-2xl border border-white/8 bg-white/[0.035] p-5 transition hover:border-lime-300/30"
            >
              <div className="flex items-start gap-4">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-lime-300 text-sm font-black text-zinc-950">
                  {String(history.length - index).padStart(2, "0")}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-extrabold text-white">
                    {workout.planName ?? "Sesión libre"}
                  </h2>
                  <p className="mt-1 capitalize text-sm text-zinc-500">
                    {formatDate(workout.performedAt)}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-zinc-300">
                    {workout.exerciseCount} {workout.exerciseCount === 1 ? "ejercicio" : "ejercicios"}
                    {" · "}
                    {workout.setCount} {workout.setCount === 1 ? "serie" : "series"}
                  </p>
                </div>
                <span className="mt-2 text-zinc-600">→</span>
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <section className="mt-10 rounded-3xl border border-dashed border-white/12 px-6 py-12 text-center">
          <h2 className="text-lg font-extrabold text-white">
            Aún no hay sesiones terminadas
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Cuando finalices un entrenamiento aparecerá aquí con todas sus series.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex h-12 items-center rounded-xl bg-lime-300 px-5 text-sm font-black text-zinc-950"
          >
            Volver al inicio
          </Link>
        </section>
      )}
    </main>
  );
}
