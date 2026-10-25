import { PlanBlockEditor } from "@/components/plan-block-editor";
import { changePlanBlock } from "@/app/actions/plans";
import { BLOCK_LABELS, describeBlock, DISCIPLINES } from "@/lib/training-blocks";
import { ExerciseTargetFields } from "@/components/exercise-target-fields";
import { formatTarget } from "@/lib/training-metrics";
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
import { StartWorkoutButton } from "@/components/start-workout-button";
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
      variation: trainingPlanExercises.variation, progressionSteps: trainingPlanExercises.progressionSteps, progressionStep: trainingPlanExercises.progressionStep,
      measurement: trainingPlanExercises.measurement, loadType: trainingPlanExercises.loadType, targetSeconds: trainingPlanExercises.targetSeconds,
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

      <StartWorkoutButton refreshBeforeStart userId={userId} planId={plan.id} disabled={plannedExercises.length === 0}
        className="mt-6 h-14 w-full rounded-2xl bg-primary text-base font-black text-primary-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground">
        {plannedExercises.length === 0 ? "Añade ejercicios para empezar" : "Empezar este entrenamiento"}
      </StartWorkoutButton>

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
          <FormSelect placeholder="Disciplina" name="discipline" defaultValue={plan.discipline} aria-label="Disciplina" options={Object.entries(DISCIPLINES).map(([value, label]) => ({ value, label }))} />
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
                    <Link
                      href={`/exercises/${exercise.exerciseId}`}
                      className="block truncate font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline"
                    >
                      {exercise.name}
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatTarget(exercise)}
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
                    <ExerciseTargetFields value={exercise} />
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
          <ExerciseTargetFields />
          <PendingButton type="submit" disabled={availableExercises.length === 0} className="h-12 w-full">Añadir al plan</PendingButton>
        </form>
      </Card>

      <section className="mt-8" aria-label="Bloques del entrenamiento">
        <h2 className="text-xl font-bold">Bloques del entrenamiento</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Combina fuerza, técnica y circuitos en una sesión. Los ejercicios sin bloque conservan sus series habituales.</p>
        <div className="mt-4 divide-y divide-border">
          {plan.blocks.map((block, index) => <div key={block.id} className="py-4">
            <h3 className="font-semibold">{block.name} · {BLOCK_LABELS[block.format]}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{describeBlock(block)}</p>
            <details className="mt-3"><summary className="min-h-11 cursor-pointer py-2 text-sm underline underline-offset-4">Editar bloque</summary><PlanBlockEditor planId={plan.id} exercises={plannedExercises} block={block} /></details>
            <div className="mt-3 flex flex-wrap gap-2">{(["up", "down", "remove"] as const).map((direction) => <form key={direction} action={changePlanBlock}>
              <input type="hidden" name="planId" value={plan.id} /><input type="hidden" name="blockId" value={block.id} /><input type="hidden" name="direction" value={direction} />
              {direction === "remove" ? <ConfirmSubmitButton variant="outline" confirmation="El bloque se quitará del plan. Los ejercicios y las sesiones anteriores se conservan.">Quitar bloque</ConfirmSubmitButton> : <PendingButton variant="outline" disabled={direction === "up" ? index === 0 : index === plan.blocks.length - 1}>{direction === "up" ? "Subir bloque" : "Bajar bloque"}</PendingButton>}
            </form>)}</div>
          </div>)}
        </div>
        <details className="mt-4 border-t border-border pt-3"><summary className="min-h-11 cursor-pointer py-2 font-semibold">Añadir bloque</summary><PlanBlockEditor planId={plan.id} exercises={plannedExercises} /></details>
      </section>

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
