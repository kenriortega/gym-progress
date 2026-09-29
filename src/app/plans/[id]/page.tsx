import { and, asc, eq, isNull, or } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  addPlanExercise,
  archivePlan,
  duplicatePlan,
  movePlanExercise,
  removePlanExercise,
  updatePlan,
  updatePlanExercise,
} from "@/app/actions/plans";
import { startWorkout } from "@/app/actions/workouts";
import { auth } from "@/auth";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PendingButton } from "@/components/pending-button";
import { db } from "@/db";
import { exercises, trainingPlanExercises, trainingPlans } from "@/db/schema";

const weekdays = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const userId = session.user.id;
  const [plan] = await db
    .select()
    .from(trainingPlans)
    .where(and(eq(trainingPlans.id, id), eq(trainingPlans.userId, userId), isNull(trainingPlans.archivedAt)))
    .limit(1);

  if (!plan) notFound();

  const plannedExercises = await db
    .select({
      id: trainingPlanExercises.id,
      exerciseId: exercises.id,
      name: exercises.name,
      muscleGroup: exercises.muscleGroup,
      position: trainingPlanExercises.position,
      targetSets: trainingPlanExercises.targetSets,
      targetRepsMin: trainingPlanExercises.targetRepsMin,
      targetRepsMax: trainingPlanExercises.targetRepsMax,
    })
    .from(trainingPlanExercises)
    .innerJoin(exercises, eq(exercises.id, trainingPlanExercises.exerciseId))
    .where(eq(trainingPlanExercises.planId, plan.id))
    .orderBy(asc(trainingPlanExercises.position));

  const catalog = await db
    .select({ id: exercises.id, name: exercises.name, muscleGroup: exercises.muscleGroup })
    .from(exercises)
    .where(and(isNull(exercises.archivedAt), or(isNull(exercises.userId), eq(exercises.userId, userId))))
    .orderBy(asc(exercises.muscleGroup), asc(exercises.name));
  const includedIds = new Set(plannedExercises.map((exercise) => exercise.exerciseId));
  const availableExercises = catalog.filter((exercise) => !includedIds.has(exercise.id));

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-12 pt-6">
      <header className="flex items-center gap-4">
        <Link href="/plans" className="grid size-11 place-items-center rounded-full border border-white/10 text-xl text-zinc-300" aria-label="Volver a planes">←</Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-lime-300">Configurar plan</p>
          <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-white">{plan.name}</h1>
        </div>
      </header>

      <form action={startWorkout} className="mt-6">
        <input type="hidden" name="planId" value={plan.id} />
        <PendingButton type="submit" disabled={plannedExercises.length === 0} pendingLabel="Preparando…" className="h-14 w-full rounded-2xl bg-lime-300 text-base font-black text-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600">
          {plannedExercises.length === 0 ? "Añade ejercicios para empezar" : "Empezar este entrenamiento"}
        </PendingButton>
      </form>

      <details className="mt-4 rounded-2xl border border-white/8 bg-white/[0.025] p-4">
        <summary className="cursor-pointer font-bold text-zinc-300">Editar nombre y día</summary>
        <form action={updatePlan} className="mt-4 space-y-3">
          <input type="hidden" name="planId" value={plan.id} />
          <input name="name" required minLength={2} maxLength={100} defaultValue={plan.name} className="h-12 w-full rounded-xl border border-white/10 bg-zinc-900 px-4 font-bold text-white outline-none focus:border-lime-300" />
          <select name="weekday" defaultValue={plan.weekday ?? ""} className="h-12 w-full rounded-xl border border-white/10 bg-zinc-900 px-4 font-bold text-white outline-none focus:border-lime-300">
            <option value="">Sin día fijo</option>
            {weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}
          </select>
          <input name="description" maxLength={500} defaultValue={plan.description ?? ""} placeholder="Nota opcional" className="h-12 w-full rounded-xl border border-white/10 bg-zinc-900 px-4 text-white outline-none placeholder:text-zinc-600 focus:border-lime-300" />
          <PendingButton type="submit" className="h-11 w-full rounded-xl bg-white text-sm font-black text-zinc-950">Guardar cambios</PendingButton>
        </form>
      </details>

      <section className="mt-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-zinc-500">{plan.weekday === null ? "Sin día fijo" : weekdays[plan.weekday]}</p>
            <h2 className="mt-1 text-xl font-extrabold text-white">Ejercicios del día</h2>
          </div>
          <span className="text-sm font-bold text-lime-300">{plannedExercises.length}</span>
        </div>

        {plannedExercises.length > 0 ? (
          <div className="mt-4 space-y-3">
            {plannedExercises.map((exercise, index) => (
              <article key={exercise.id} className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime-300 text-sm font-black text-zinc-950">{String(index + 1).padStart(2, "0")}</div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-extrabold text-white">{exercise.name}</h3>
                    <p className="mt-1 text-sm text-zinc-500">
                      {exercise.targetSets} series · {exercise.targetRepsMin}{exercise.targetRepsMax !== exercise.targetRepsMin ? `–${exercise.targetRepsMax}` : ""} reps
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {(["up", "down"] as const).map((direction) => (
                      <form action={movePlanExercise} key={direction}>
                        <input type="hidden" name="planId" value={plan.id} />
                        <input type="hidden" name="planExerciseId" value={exercise.id} />
                        <input type="hidden" name="direction" value={direction} />
                        <PendingButton type="submit" disabled={(direction === "up" && index === 0) || (direction === "down" && index === plannedExercises.length - 1)} pendingLabel="…" className="grid size-9 place-items-center rounded-xl bg-white/5 text-zinc-400 disabled:opacity-20" aria-label={`${direction === "up" ? "Subir" : "Bajar"} ${exercise.name}`}>
                          {direction === "up" ? "↑" : "↓"}
                        </PendingButton>
                      </form>
                    ))}
                  </div>
                </div>

                <details className="mt-3 border-t border-white/8 pt-3">
                  <summary className="cursor-pointer text-sm font-bold text-zinc-500">Editar objetivo</summary>
                  <form action={updatePlanExercise} className="mt-3">
                    <input type="hidden" name="planId" value={plan.id} />
                    <input type="hidden" name="planExerciseId" value={exercise.id} />
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        ["targetSets", "SERIES", exercise.targetSets],
                        ["targetRepsMin", "REPS MIN", exercise.targetRepsMin],
                        ["targetRepsMax", "REPS MAX", exercise.targetRepsMax],
                      ].map(([name, label, value]) => (
                        <label key={String(name)} className="text-[11px] font-bold text-zinc-500">
                          {label}
                          <input name={String(name)} type="number" min="1" max={name === "targetSets" ? 20 : 1000} required defaultValue={value} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-zinc-900 px-2 text-center font-bold text-white" />
                        </label>
                      ))}
                    </div>
                    <PendingButton type="submit" className="mt-3 h-11 w-full rounded-xl bg-white text-sm font-black text-zinc-950">Guardar objetivo</PendingButton>
                  </form>
                  <form action={removePlanExercise} className="mt-2">
                    <input type="hidden" name="planId" value={plan.id} />
                    <input type="hidden" name="planExerciseId" value={exercise.id} />
                    <ConfirmSubmitButton type="submit" confirmation={`¿Quitar ${exercise.name} de este plan?`} className="h-10 w-full rounded-xl text-sm font-bold text-red-300 hover:bg-red-400/10">Quitar del plan</ConfirmSubmitButton>
                  </form>
                </details>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-white/12 p-6 text-center text-sm leading-6 text-zinc-500">Añade los ejercicios en el orden en que quieres realizarlos.</p>
        )}
      </section>

      <section className="mt-8 rounded-3xl border border-white/8 bg-white/[0.035] p-5">
        <h2 className="text-lg font-extrabold text-white">Añadir ejercicio</h2>
        <form action={addPlanExercise} className="mt-4 space-y-3">
          <input type="hidden" name="planId" value={plan.id} />
          <select name="exerciseId" required defaultValue="" disabled={availableExercises.length === 0} className="h-12 w-full rounded-xl border border-white/10 bg-zinc-900 px-4 font-semibold text-white outline-none focus:border-lime-300 disabled:text-zinc-600">
            <option value="" disabled>{availableExercises.length > 0 ? "Selecciona un ejercicio" : "Todos añadidos"}</option>
            {availableExercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name} · {exercise.muscleGroup}</option>)}
          </select>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["targetSets", "SERIES", 3, 20],
              ["targetRepsMin", "REPS MIN", 8, 1000],
              ["targetRepsMax", "REPS MAX", 12, 1000],
            ].map(([name, label, value, max]) => (
              <label key={String(name)} className="text-xs font-bold text-zinc-500">
                {label}
                <input name={String(name)} type="number" min="1" max={max} defaultValue={value} required className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-zinc-900 px-2 text-center text-lg font-bold text-white outline-none focus:border-lime-300" />
              </label>
            ))}
          </div>
          <PendingButton type="submit" disabled={availableExercises.length === 0} className="h-12 w-full rounded-xl bg-white text-sm font-black text-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600">Añadir al plan</PendingButton>
        </form>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3">
        <form action={duplicatePlan}>
          <input type="hidden" name="planId" value={plan.id} />
          <PendingButton type="submit" pendingLabel="Duplicando…" className="h-12 w-full rounded-xl border border-white/10 text-sm font-bold text-zinc-300">Duplicar plan</PendingButton>
        </form>
        <form action={archivePlan}>
          <input type="hidden" name="planId" value={plan.id} />
          <ConfirmSubmitButton type="submit" confirmation="¿Archivar este plan? Sus entrenamientos anteriores se conservarán." pendingLabel="Archivando…" className="h-12 w-full rounded-xl border border-red-400/20 text-sm font-bold text-red-300">Archivar plan</ConfirmSubmitButton>
        </form>
      </section>
    </main>
  );
}
