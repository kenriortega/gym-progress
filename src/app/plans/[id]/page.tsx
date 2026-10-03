import { and, asc, eq, isNull, or } from "drizzle-orm";
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
import { FormSelect } from "@/components/form-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { db } from "@/db";
import { exercises, trainingPlanExercises, trainingPlans } from "@/db/schema";
import { AppHeader } from "@/components/app-header";
import { ExercisePicker } from "@/components/exercise-picker";

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
    <main className="mx-auto min-h-dvh w-full max-w-md md:max-w-3xl lg:max-w-5xl px-5 pb-12 pt-6">
      <AppHeader backHref="/plans" eyebrow="Configurar plan" title={plan.name} />

      <form action={startWorkout} className="mt-6">
        <input type="hidden" name="planId" value={plan.id} />
        <PendingButton type="submit" disabled={plannedExercises.length === 0} pendingLabel="Preparando…" className="h-14 w-full rounded-2xl bg-primary text-base font-black text-primary-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground">
          {plannedExercises.length === 0 ? "Añade ejercicios para empezar" : "Empezar este entrenamiento"}
        </PendingButton>
      </form>

      <Card className="mt-4 p-4">
        <Collapsible>
        <CollapsibleTrigger className="w-full text-left text-sm font-medium text-muted-foreground">Editar nombre y día</CollapsibleTrigger>
        <CollapsibleContent>
        <form action={updatePlan} className="mt-4 space-y-3">
          <input type="hidden" name="planId" value={plan.id} />
          <Input name="name" required minLength={2} maxLength={100} defaultValue={plan.name} className="h-12" aria-label="Nombre del plan" />
          <FormSelect
            name="weekday"
            defaultValue={plan.weekday === null ? "" : String(plan.weekday)}
            placeholder="Sin día fijo"
            options={weekdays.map((day, index) => ({ value: String(index), label: day }))}
            aria-label="Día de la semana"
          />
          <Input name="description" maxLength={500} defaultValue={plan.description ?? ""} placeholder="Nota opcional" className="h-12" aria-label="Nota" />
          <PendingButton type="submit" className="h-11 w-full">Guardar cambios</PendingButton>
        </form>
        </CollapsibleContent>
        </Collapsible>
      </Card>

      <section className="mt-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{plan.weekday === null ? "Sin día fijo" : weekdays[plan.weekday]}</p>
            <h2 className="mt-1 text-xl font-extrabold text-foreground">Ejercicios del día</h2>
          </div>
          <Badge variant="outline">{plannedExercises.length}</Badge>
        </div>

        {plannedExercises.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {plannedExercises.map((exercise, index) => (
              <Card key={exercise.id} className="p-4">
                <div className="flex items-center gap-3">
                  <Badge className="size-10 shrink-0 justify-center rounded-xl text-sm font-bold">{String(index + 1).padStart(2, "0")}</Badge>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-foreground">{exercise.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {exercise.targetSets} series · {exercise.targetRepsMin}{exercise.targetRepsMax !== exercise.targetRepsMin ? `–${exercise.targetRepsMax}` : ""} reps
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {(["up", "down"] as const).map((direction) => (
                      <form action={movePlanExercise} key={direction}>
                        <input type="hidden" name="planId" value={plan.id} />
                        <input type="hidden" name="planExerciseId" value={exercise.id} />
                        <input type="hidden" name="direction" value={direction} />
                        <PendingButton type="submit" disabled={(direction === "up" && index === 0) || (direction === "down" && index === plannedExercises.length - 1)} pendingLabel="…" variant="secondary" size="icon" className="size-9 disabled:opacity-20" aria-label={`${direction === "up" ? "Subir" : "Bajar"} ${exercise.name}`}>
                          {direction === "up" ? "↑" : "↓"}
                        </PendingButton>
                      </form>
                    ))}
                  </div>
                </div>

                <Collapsible className="mt-3 border-t border-border pt-3">
                  <CollapsibleTrigger className="w-full text-left text-sm font-medium text-muted-foreground">Editar objetivo</CollapsibleTrigger>
                  <CollapsibleContent>
                  <form action={updatePlanExercise} className="mt-3">
                    <input type="hidden" name="planId" value={plan.id} />
                    <input type="hidden" name="planExerciseId" value={exercise.id} />
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        ["targetSets", "SERIES", exercise.targetSets],
                        ["targetRepsMin", "REPS MIN", exercise.targetRepsMin],
                        ["targetRepsMax", "REPS MAX", exercise.targetRepsMax],
                      ].map(([name, label, value]) => (
                        <label key={String(name)} className="text-[11px] font-bold text-muted-foreground">
                          {label}
                          <Input name={String(name)} type="number" inputMode="numeric" min="1" max={name === "targetSets" ? 20 : 1000} required defaultValue={value} className="mt-2 h-11 text-center font-semibold" />
                        </label>
                      ))}
                    </div>
                    <PendingButton type="submit" className="mt-3 h-11 w-full">Guardar objetivo</PendingButton>
                  </form>
                  <form action={removePlanExercise} className="mt-2">
                    <input type="hidden" name="planId" value={plan.id} />
                    <input type="hidden" name="planExerciseId" value={exercise.id} />
                    <ConfirmSubmitButton type="submit" variant="destructive" confirmation={`¿Quitar ${exercise.name} de este plan?`} className="h-10 w-full">Quitar del plan</ConfirmSubmitButton>
                  </form>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="mt-4 border-dashed p-6 text-center"><CardDescription>Añade los ejercicios en el orden en que quieres realizarlos.</CardDescription></Card>
        )}
      </section>

      <Card className="mt-8 p-5">
        <CardTitle className="text-lg">Añadir ejercicio</CardTitle>
        <form action={addPlanExercise} className="mt-4 space-y-3">
          <input type="hidden" name="planId" value={plan.id} />
          <ExercisePicker
            exercises={availableExercises.map((exercise) => ({
              id: exercise.id,
              name: exercise.name,
              muscleGroup: exercise.muscleGroup,
            }))}
          />
          <div className="grid grid-cols-3 gap-2">
            {[
              ["targetSets", "SERIES", 3, 20],
              ["targetRepsMin", "REPS MIN", 8, 1000],
              ["targetRepsMax", "REPS MAX", 12, 1000],
            ].map(([name, label, value, max]) => (
              <label key={String(name)} className="text-xs font-bold text-muted-foreground">
                {label}
                <Input name={String(name)} type="number" inputMode="numeric" min="1" max={max} defaultValue={value} required className="mt-2 h-12 text-center text-lg font-semibold" />
              </label>
            ))}
          </div>
          <PendingButton type="submit" disabled={availableExercises.length === 0} className="h-12 w-full">Añadir al plan</PendingButton>
        </form>
      </Card>

      <section className="mt-6 grid grid-cols-2 gap-3">
        <form action={duplicatePlan}>
          <input type="hidden" name="planId" value={plan.id} />
          <PendingButton type="submit" variant="outline" pendingLabel="Duplicando…" className="h-12 w-full">Duplicar plan</PendingButton>
        </form>
        <form action={archivePlan}>
          <input type="hidden" name="planId" value={plan.id} />
          <ConfirmSubmitButton type="submit" variant="destructive" confirmation="¿Archivar este plan? Sus entrenamientos anteriores se conservarán." pendingLabel="Archivando…" className="h-12 w-full">Archivar plan</ConfirmSubmitButton>
        </form>
      </section>
    </main>
  );
}
