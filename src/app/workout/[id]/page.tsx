import { and, asc, desc, eq, isNull, ne, or } from "drizzle-orm";
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
import {
  addExercise,
  deleteSet,
  finishWorkout,
  toggleExerciseComplete,
  updateSet,
} from "@/app/actions/workouts";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PendingButton } from "@/components/pending-button";
import { SetEntryForm } from "@/components/set-entry-form";
import {
  SESSIONS_TO_PROGRESS,
  suggestProgression,
  type ProgressionSuggestion,
} from "@/lib/progression";

type ExerciseReference = {
  date: Date;
  sets: Array<{ reps: number; weight: string }>;
} | null;

async function getPreviousPerformance(
  userId: string,
  currentWorkoutId: string,
  exerciseId: string,
): Promise<ExerciseReference> {
  const [previous] = await db
    .select({
      workoutExerciseId: workoutExercises.id,
      date: workouts.performedAt,
    })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(
      and(
        eq(workoutExercises.exerciseId, exerciseId),
        eq(workouts.userId, userId),
        eq(workouts.status, "completed"),
        ne(workouts.id, currentWorkoutId),
      ),
    )
    .orderBy(desc(workouts.performedAt))
    .limit(1);

  if (!previous) {
    return null;
  }

  const sets = await db
    .select({ reps: workoutSets.reps, weight: workoutSets.weight })
    .from(workoutSets)
    .where(eq(workoutSets.workoutExerciseId, previous.workoutExerciseId))
    .orderBy(asc(workoutSets.position));

  return { date: previous.date, sets };
}

async function getProgressionSuggestion(
  userId: string,
  currentWorkoutId: string,
  exerciseId: string,
): Promise<ProgressionSuggestion | null> {
  const recent = await db
    .select({
      workoutExerciseId: workoutExercises.id,
      targetSets: workoutExercises.targetSets,
      targetRepsMax: workoutExercises.targetRepsMax,
    })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(
      and(
        eq(workoutExercises.exerciseId, exerciseId),
        eq(workouts.userId, userId),
        eq(workouts.status, "completed"),
        ne(workouts.id, currentWorkoutId),
      ),
    )
    .orderBy(desc(workouts.performedAt))
    .limit(SESSIONS_TO_PROGRESS);

  if (recent.length < SESSIONS_TO_PROGRESS) {
    return null;
  }

  const sessions = await Promise.all(
    recent.map(async (entry) => {
      const sets = await db
        .select({ reps: workoutSets.reps, weight: workoutSets.weight })
        .from(workoutSets)
        .where(eq(workoutSets.workoutExerciseId, entry.workoutExerciseId));

      return {
        targetSets: entry.targetSets,
        targetRepsMax: entry.targetRepsMax,
        sets: sets.map((set) => ({ reps: set.reps, weight: Number(set.weight) })),
      };
    }),
  );

  return suggestProgression(sessions);
}

export default async function ActiveWorkoutPage({ params }: PageProps<"/workout/[id]">) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;
  const { id } = await params;

  const [workout] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, id), eq(workouts.userId, userId)))
    .limit(1);

  if (!workout) {
    notFound();
  }

  if (workout.status !== "active") {
    redirect("/");
  }

  const [plan] = workout.trainingPlanId
    ? await db
        .select({ id: trainingPlans.id, name: trainingPlans.name })
        .from(trainingPlans)
        .where(
          and(
            eq(trainingPlans.id, workout.trainingPlanId),
            eq(trainingPlans.userId, userId),
          ),
        )
        .limit(1)
    : [];

  const exerciseRows = await db
    .select({
      workoutExerciseId: workoutExercises.id,
      exerciseId: exercises.id,
      name: exercises.name,
      muscleGroup: exercises.muscleGroup,
      position: workoutExercises.position,
      targetSets: workoutExercises.targetSets,
      targetRepsMin: workoutExercises.targetRepsMin,
      targetRepsMax: workoutExercises.targetRepsMax,
      completedAt: workoutExercises.completedAt,
    })
    .from(workoutExercises)
    .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
    .where(eq(workoutExercises.workoutId, workout.id))
    .orderBy(asc(workoutExercises.position));

  const setRows = await db
    .select({
      id: workoutSets.id,
      workoutExerciseId: workoutSets.workoutExerciseId,
      position: workoutSets.position,
      reps: workoutSets.reps,
      weight: workoutSets.weight,
      rpe: workoutSets.rpe,
    })
    .from(workoutSets)
    .innerJoin(
      workoutExercises,
      eq(workoutExercises.id, workoutSets.workoutExerciseId),
    )
    .where(eq(workoutExercises.workoutId, workout.id))
    .orderBy(asc(workoutSets.position));

  const catalog = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      muscleGroup: exercises.muscleGroup,
    })
    .from(exercises)
    .where(
      and(
        isNull(exercises.archivedAt),
        or(isNull(exercises.userId), eq(exercises.userId, userId)),
      ),
    )
    .orderBy(asc(exercises.muscleGroup), asc(exercises.name));

  const addedExerciseIds = new Set(exerciseRows.map((row) => row.exerciseId));
  const availableExercises = catalog.filter(
    (exercise) => !addedExerciseIds.has(exercise.id),
  );

  const references = new Map<string, ExerciseReference>();
  const suggestions = new Map<string, ProgressionSuggestion | null>();
  await Promise.all(
    exerciseRows.map(async (exercise) => {
      const [reference, suggestion] = await Promise.all([
        getPreviousPerformance(userId, workout.id, exercise.exerciseId),
        getProgressionSuggestion(userId, workout.id, exercise.exerciseId),
      ]);
      references.set(exercise.workoutExerciseId, reference);
      suggestions.set(exercise.workoutExerciseId, suggestion);
    }),
  );

  const totalSets = setRows.length;
  const completedExercises = exerciseRows.filter((exercise) => exercise.completedAt).length;
  const dateLabel = new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(workout.performedAt);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-32 pt-6">
      <header className="flex items-center justify-between">
        <Link
          href="/"
          className="grid size-11 place-items-center rounded-full border border-white/10 text-xl text-zinc-300 transition hover:border-white/25 hover:text-white"
          aria-label="Volver al inicio"
        >
          ←
        </Link>
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-lime-300">
            En curso
          </p>
          <h1 className="mt-1 max-w-52 truncate text-lg font-extrabold text-white">
            {plan?.name ?? "Sesión libre"}
          </h1>
        </div>
        <div className="grid size-11 place-items-center rounded-full bg-lime-300/10 text-sm font-bold text-lime-300">
          {totalSets}
        </div>
      </header>

      <p className="mt-6 capitalize text-sm text-zinc-500">{dateLabel}</p>

      <section className="mt-6 rounded-3xl border border-white/8 bg-white/[0.035] p-4">
        <form action={addExercise} className="flex gap-2">
          <input type="hidden" name="workoutId" value={workout.id} />
          <label htmlFor="exerciseId" className="sr-only">
            Ejercicio
          </label>
          <select
            id="exerciseId"
            name="exerciseId"
            required
            disabled={availableExercises.length === 0}
            defaultValue=""
            className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-zinc-900 px-4 text-base font-semibold text-white outline-none focus:border-lime-300 disabled:text-zinc-600"
          >
            <option value="" disabled>
              {availableExercises.length > 0
                ? "Añadir ejercicio"
                : "Todos añadidos"}
            </option>
            {availableExercises.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name} · {exercise.muscleGroup}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={availableExercises.length === 0}
            className="grid size-14 shrink-0 place-items-center rounded-2xl bg-lime-300 text-2xl font-black text-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
            aria-label="Añadir ejercicio"
          >
            +
          </button>
        </form>
      </section>

      {exerciseRows.length === 0 ? (
        <section className="mt-12 rounded-3xl border border-dashed border-white/15 px-6 py-12 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-white/5 text-2xl">
            +
          </div>
          <h2 className="mt-5 text-xl font-extrabold text-white">
            Añade tu primer ejercicio
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Elige uno arriba y registra cada serie cuando la completes.
          </p>
        </section>
      ) : (
        <div className="mt-6 space-y-5">
          {exerciseRows.map((exercise, exerciseIndex) => {
            const sets = setRows.filter(
              (set) => set.workoutExerciseId === exercise.workoutExerciseId,
            );
            const reference = references.get(exercise.workoutExerciseId) ?? null;
            const lastKnownSet = sets.at(-1) ?? reference?.sets.at(-1);
            const target =
              exercise.targetSets !== null &&
              exercise.targetRepsMin !== null &&
              exercise.targetRepsMax !== null
                ? {
                    targetSets: exercise.targetSets,
                    targetRepsMin: exercise.targetRepsMin,
                    targetRepsMax: exercise.targetRepsMax,
                  }
                : null;
            const remainingSets = target ? Math.max(0, target.targetSets - sets.length) : 0;
            const isComplete = exercise.completedAt !== null;
            const rawSuggestion = suggestions.get(exercise.workoutExerciseId) ?? null;
            const alreadyAtSuggestedWeight =
              rawSuggestion !== null &&
              sets.some((set) => Number(set.weight) >= rawSuggestion.toWeight);
            const suggestion = alreadyAtSuggestedWeight ? null : rawSuggestion;

            return (
              <article
                key={exercise.workoutExerciseId}
                className={`overflow-hidden rounded-3xl border ${isComplete ? "border-lime-300/35 bg-lime-300/[0.04]" : "border-white/8 bg-white/[0.035]"}`}
              >
                <div className="flex items-start gap-3 border-b border-white/8 p-5">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime-300 text-sm font-black text-zinc-950">
                    {String(exerciseIndex + 1).padStart(2, "0")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-extrabold text-white">
                      {exercise.name}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      {exercise.muscleGroup}
                      {target
                        ? ` · ${sets.length}/${target.targetSets} series`
                        : ""}
                    </p>
                  </div>
                  <form action={toggleExerciseComplete}>
                    <input type="hidden" name="workoutId" value={workout.id} />
                    <input type="hidden" name="workoutExerciseId" value={exercise.workoutExerciseId} />
                    <input type="hidden" name="complete" value={isComplete ? "false" : "true"} />
                    <PendingButton
                      type="submit"
                      pendingLabel="…"
                      className={`h-10 rounded-xl px-3 text-xs font-black ${isComplete ? "bg-lime-300 text-zinc-950" : "bg-white/5 text-zinc-400"}`}
                    >
                      {isComplete ? "✓ Hecho" : "Completar"}
                    </PendingButton>
                  </form>
                </div>

                <div className="px-5 pt-4">
                  {target && (
                    <p className="mb-2 rounded-xl bg-lime-300/8 px-3 py-2 text-xs font-semibold leading-5 text-lime-200">
                      Objetivo: {target.targetSets} series de {target.targetRepsMin}
                      {target.targetRepsMax !== target.targetRepsMin
                        ? `–${target.targetRepsMax}`
                        : ""} repeticiones · {remainingSets === 0 ? "objetivo alcanzado" : `faltan ${remainingSets}`}
                    </p>
                  )}
                  {suggestion && (
                    <p className="mb-2 rounded-xl bg-amber-300/10 px-3 py-2 text-xs font-semibold leading-5 text-amber-200">
                      Toca subir peso: llevas {SESSIONS_TO_PROGRESS} sesiones
                      cerrando el rango con {suggestion.fromWeight}{" "}
                      {workout.weightUnit}. Prueba {suggestion.toWeight}{" "}
                      {workout.weightUnit} y vuelve al mínimo de repeticiones.
                    </p>
                  )}
                  {reference && reference.sets.length > 0 ? (
                    <p className="rounded-xl bg-sky-300/8 px-3 py-2 text-xs leading-5 text-sky-200">
                      Última vez: {reference.sets
                        .map((set) => `${Number(set.weight)}×${set.reps}`)
                        .join(" · ")} {workout.weightUnit}
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-600">Primera vez con este ejercicio</p>
                  )}
                  <Link href={`/exercises/${exercise.exerciseId}`} className="mt-2 inline-block text-xs font-bold text-zinc-500 hover:text-lime-300">
                    Ver progreso completo →
                  </Link>
                </div>

                {sets.length > 0 && (
                  <div className="px-5 pt-4">
                    <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-2 px-2 text-center text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                      <span>#</span>
                      <span>Peso</span>
                      <span>Reps</span>
                      <span />
                    </div>
                    <div className="mt-2 space-y-2">
                      {sets.map((set, index) => (
                        <details key={set.id} className="rounded-xl bg-white/[0.04] px-2 py-3">
                          <summary className="grid cursor-pointer list-none grid-cols-[2rem_1fr_1fr_2.5rem] items-center gap-2 text-center">
                            <span className="text-sm font-bold text-zinc-500">{index + 1}</span>
                            <span className="font-bold text-white">{Number(set.weight)} {workout.weightUnit}</span>
                            <span className="font-bold text-white">{set.reps}</span>
                            <span className="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-white/5 hover:text-white" aria-label={`Editar serie ${index + 1}`}>•••</span>
                          </summary>
                          <div className="mt-3 border-t border-white/8 pt-3">
                            <form action={updateSet} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                              <input type="hidden" name="workoutId" value={workout.id} />
                              <input type="hidden" name="setId" value={set.id} />
                              <input name="weight" type="number" min="0" max="99999" step="0.01" required defaultValue={Number(set.weight)} className="h-10 min-w-0 rounded-lg border border-white/10 bg-zinc-900 px-2 text-center font-bold text-white" aria-label="Peso" />
                              <input name="reps" type="number" min="1" max="1000" required defaultValue={set.reps} className="h-10 min-w-0 rounded-lg border border-white/10 bg-zinc-900 px-2 text-center font-bold text-white" aria-label="Repeticiones" />
                              <PendingButton type="submit" className="h-10 rounded-lg bg-white px-3 text-xs font-black text-zinc-950">Guardar</PendingButton>
                            </form>
                            <form action={deleteSet} className="mt-2">
                              <input type="hidden" name="workoutId" value={workout.id} />
                              <input type="hidden" name="setId" value={set.id} />
                              <ConfirmSubmitButton type="submit" confirmation={`¿Eliminar la serie ${index + 1}?`} className="h-9 w-full rounded-lg text-xs font-bold text-red-300 hover:bg-red-400/10">Eliminar serie</ConfirmSubmitButton>
                            </form>
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                )}

                <SetEntryForm
                  workoutId={workout.id}
                  workoutExerciseId={exercise.workoutExerciseId}
                  defaultWeight={lastKnownSet ? Number(lastKnownSet.weight) : null}
                  defaultReps={lastKnownSet?.reps ?? null}
                />
              </article>
            );
          })}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-white/8 bg-zinc-950/95 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur">
        <form action={finishWorkout} className="mx-auto max-w-md">
          <input type="hidden" name="workoutId" value={workout.id} />
          <ConfirmSubmitButton
            type="submit"
            disabled={totalSets === 0}
            confirmation={`¿Finalizar toda la sesión? Has completado ${completedExercises} de ${exerciseRows.length} ejercicios.`}
            pendingLabel="Finalizando…"
            className="h-14 w-full rounded-2xl bg-white text-base font-black text-zinc-950 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
          >
            {totalSets === 0
              ? "Registra una serie para terminar"
              : `Finalizar sesión completa · ${totalSets} ${totalSets === 1 ? "serie" : "series"}`}
          </ConfirmSubmitButton>
          {totalSets > 0 && (
            <p className="mt-2 text-center text-xs text-zinc-500">
              {completedExercises}/{exerciseRows.length} ejercicios marcados como completados.
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
