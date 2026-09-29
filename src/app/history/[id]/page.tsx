import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import {
  exercises,
  trainingPlans,
  workoutExercises,
  workouts,
  workoutSets,
} from "@/db/schema";

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  const [workout] = await db
    .select({
      id: workouts.id,
      performedAt: workouts.performedAt,
      completedAt: workouts.completedAt,
      weightUnit: workouts.weightUnit,
      notes: workouts.notes,
      planName: trainingPlans.name,
    })
    .from(workouts)
    .leftJoin(trainingPlans, eq(trainingPlans.id, workouts.trainingPlanId))
    .where(
      and(
        eq(workouts.id, id),
        eq(workouts.userId, session.user.id),
        eq(workouts.status, "completed"),
      ),
    )
    .limit(1);

  if (!workout) {
    notFound();
  }

  const rows = await db
    .select({
      workoutExerciseId: workoutExercises.id,
      exerciseId: exercises.id,
      name: exercises.name,
      muscleGroup: exercises.muscleGroup,
      exercisePosition: workoutExercises.position,
      targetSets: workoutExercises.targetSets,
      targetRepsMin: workoutExercises.targetRepsMin,
      targetRepsMax: workoutExercises.targetRepsMax,
      setId: workoutSets.id,
      setPosition: workoutSets.position,
      reps: workoutSets.reps,
      weight: workoutSets.weight,
      rpe: workoutSets.rpe,
    })
    .from(workoutExercises)
    .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
    .leftJoin(
      workoutSets,
      eq(workoutSets.workoutExerciseId, workoutExercises.id),
    )
    .where(eq(workoutExercises.workoutId, workout.id))
    .orderBy(asc(workoutExercises.position), asc(workoutSets.position));

  const exerciseMap = new Map<
    string,
    {
      id: string;
      name: string;
      muscleGroup: string;
      position: number;
      targetSets: number | null;
      targetRepsMin: number | null;
      targetRepsMax: number | null;
      sets: Array<{
        id: string;
        reps: number;
        weight: string;
        rpe: string | null;
      }>;
    }
  >();

  for (const row of rows) {
    const exercise = exerciseMap.get(row.workoutExerciseId) ?? {
      id: row.workoutExerciseId,
      name: row.name,
      muscleGroup: row.muscleGroup,
      position: row.exercisePosition,
      targetSets: row.targetSets,
      targetRepsMin: row.targetRepsMin,
      targetRepsMax: row.targetRepsMax,
      sets: [],
    };

    if (row.setId && row.reps !== null && row.weight !== null) {
      exercise.sets.push({
        id: row.setId,
        reps: row.reps,
        weight: row.weight,
        rpe: row.rpe,
      });
    }

    exerciseMap.set(row.workoutExerciseId, exercise);
  }

  const workoutExerciseList = Array.from(exerciseMap.values()).sort(
    (a, b) => a.position - b.position,
  );
  const totalSets = workoutExerciseList.reduce(
    (total, exercise) => total + exercise.sets.length,
    0,
  );
  const dateLabel = new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(workout.performedAt);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-12 pt-6">
      <header className="flex items-center gap-4">
        <Link
          href="/history"
          className="grid size-11 place-items-center rounded-full border border-white/10 text-xl text-zinc-300"
          aria-label="Volver al historial"
        >
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-lime-300">
            Entrenamiento completado
          </p>
          <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-white">
            {workout.planName ?? "Sesión libre"}
          </h1>
        </div>
      </header>

      <section className="mt-7 rounded-3xl bg-lime-300 p-5 text-zinc-950">
        <p className="capitalize font-extrabold">{dateLabel}</p>
        <p className="mt-2 text-sm font-semibold text-zinc-700">
          {workoutExerciseList.length} {workoutExerciseList.length === 1 ? "ejercicio" : "ejercicios"}
          {" · "}
          {totalSets} {totalSets === 1 ? "serie" : "series"}
        </p>
      </section>

      <section className="mt-6 space-y-4">
        {workoutExerciseList.map((exercise, exerciseIndex) => (
          <article
            key={exercise.id}
            className="overflow-hidden rounded-3xl border border-white/8 bg-white/[0.035]"
          >
            <div className="flex items-center gap-3 border-b border-white/8 p-5">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime-300 text-sm font-black text-zinc-950">
                {String(exerciseIndex + 1).padStart(2, "0")}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-extrabold text-white">{exercise.name}</h2>
                <p className="mt-1 text-sm text-zinc-500">{exercise.muscleGroup}</p>
                {exercise.targetSets !== null && (
                  <p className="mt-1 text-xs font-semibold text-lime-200/70">
                    Objetivo de aquel día: {exercise.targetSets}×
                    {exercise.targetRepsMin}
                    {exercise.targetRepsMax !== exercise.targetRepsMin
                      ? `–${exercise.targetRepsMax}`
                      : ""}
                    {" · "}
                    {exercise.sets.length >= exercise.targetSets
                      ? "cumplido"
                      : `quedaron ${exercise.targetSets - exercise.sets.length}`}
                  </p>
                )}
              </div>
              <span className="text-sm font-bold text-zinc-400">
                {exercise.sets.length} {exercise.sets.length === 1 ? "serie" : "series"}
              </span>
            </div>

            {exercise.sets.length > 0 ? (
              <div className="p-5 pt-4">
                <div className="grid grid-cols-[2rem_1fr_1fr] gap-2 px-2 text-center text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                  <span>#</span>
                  <span>Peso</span>
                  <span>Reps</span>
                </div>
                <div className="mt-2 space-y-2">
                  {exercise.sets.map((set, setIndex) => (
                    <div
                      key={set.id}
                      className="grid grid-cols-[2rem_1fr_1fr] items-center gap-2 rounded-xl bg-white/[0.04] px-2 py-3 text-center"
                    >
                      <span className="text-sm font-bold text-zinc-500">
                        {setIndex + 1}
                      </span>
                      <span className="font-bold text-white">
                        {Number(set.weight)} {workout.weightUnit}
                      </span>
                      <span className="font-bold text-white">{set.reps}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="p-5 text-sm text-zinc-600">No se registraron series.</p>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
