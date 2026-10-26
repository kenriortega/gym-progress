import { getWeightPreferences } from "@/db/preferences";
import { WeightView, WeightSet, WeightValue } from "@/components/weight-view";
import { RecordedSetFields } from "@/components/recorded-set-fields";
import { formatTarget } from "@/lib/training-metrics";
import { and, asc, desc, eq, isNull, ne, or } from "drizzle-orm";
import Link from "next/link";
import { HistoryIcon, PencilIcon, PlusIcon, TrendingUpIcon } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import { convertWeight, type WeightUnit } from "@/lib/weight-units";
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
  discardWorkout,
  finishWorkout,
  toggleExerciseComplete,
  updateSet,
  updateWorkoutNotes,
} from "@/app/actions/workouts";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PendingButton } from "@/components/pending-button";
import { SetEntryForm } from "@/components/set-entry-form";
import { FormSelect } from "@/components/form-select";
import { AppHeader } from "@/components/app-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SESSIONS_TO_PROGRESS,
  suggestProgression,
  type ProgressionSuggestion,
} from "@/lib/progression";

/** Sesiones que se miran hacia atrás para medir la racha en el tope. */
const PROGRESSION_LOOKBACK = 8;

type ExerciseReference = {
  date: Date;
  sets: Array<{ reps: number; weight: number }>;
} | null;

async function getPreviousPerformance(
  userId: string,
  currentWorkoutId: string,
  exerciseId: string,
  targetUnit: WeightUnit,
): Promise<ExerciseReference> {
  const [previous] = await db
    .select({
      workoutExerciseId: workoutExercises.id,
      date: workouts.performedAt,
      unit: workouts.weightUnit,
    })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(
      and(
        eq(workoutExercises.exerciseId, exerciseId),
        isNull(workoutExercises.variation), eq(workoutExercises.measurement, "reps"), eq(workoutExercises.loadType, "external"),
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

  return { date: previous.date, sets: sets.map((set) => ({
    reps: set.reps,
    weight: convertWeight(Number(set.weight), previous.unit, targetUnit),
  })) };
}

async function getProgressionSuggestion(
  userId: string,
  currentWorkoutId: string,
  exerciseId: string,
  targetUnit: WeightUnit,
): Promise<ProgressionSuggestion | null> {
  const recent = await db
    .select({
      workoutExerciseId: workoutExercises.id,
      performedAt: workouts.performedAt,
      weightUnit: workouts.weightUnit,
      variation: workoutExercises.variation, progressionSteps: workoutExercises.progressionSteps, progressionStep: workoutExercises.progressionStep,
      measurement: workoutExercises.measurement, loadType: workoutExercises.loadType, targetSeconds: workoutExercises.targetSeconds,
      targetSets: workoutExercises.targetSets,
      targetRepsMax: workoutExercises.targetRepsMax,
    })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(
      and(
        eq(workoutExercises.exerciseId, exerciseId),
        isNull(workoutExercises.variation), eq(workoutExercises.measurement, "reps"), eq(workoutExercises.loadType, "external"),
        eq(workouts.userId, userId),
        eq(workouts.status, "completed"),
        ne(workouts.id, currentWorkoutId),
      ),
    )
    .orderBy(desc(workouts.performedAt))
    .limit(PROGRESSION_LOOKBACK);

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
        performedAt: entry.performedAt,
        weightUnit: entry.weightUnit,
        targetSets: entry.targetSets,
        targetRepsMax: entry.targetRepsMax,
        sets: sets.map((set) => ({ reps: set.reps, weight: Number(set.weight) })),
      };
    }),
  );

  return suggestProgression(sessions, targetUnit);
}

export default async function ActiveWorkoutPage({ params }: PageProps<"/workout/[id]">) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;
  const { trainingUnit } = await getWeightPreferences(userId);
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
      variation: workoutExercises.variation, progressionSteps: workoutExercises.progressionSteps, progressionStep: workoutExercises.progressionStep,
      measurement: workoutExercises.measurement, loadType: workoutExercises.loadType, targetSeconds: workoutExercises.targetSeconds,
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
      durationSeconds: workoutSets.durationSeconds, loadType: workoutSets.loadType, assistanceNote: workoutSets.assistanceNote,
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
        getPreviousPerformance(userId, workout.id, exercise.exerciseId, workout.weightUnit),
        getProgressionSuggestion(userId, workout.id, exercise.exerciseId, workout.weightUnit),
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
    <main className="mx-auto min-h-dvh w-full max-w-md md:max-w-3xl lg:max-w-5xl px-5 pb-32 pt-6">
      <AppHeader
        backHref="/"
        eyebrow="En curso"
        title={plan?.name ?? "Sesión libre"}
        action={
          <div
            className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary"
            title={`${totalSets} series registradas`}
          >
            {totalSets}
          </div>
        }
      />

      <p className="mt-6 capitalize text-sm text-muted-foreground">{dateLabel}</p>

      <Collapsible className="mt-6 rounded-xl border border-border bg-card p-4">
        <CollapsibleTrigger className="w-full text-left text-sm font-medium text-muted-foreground">
          Nota de la sesión{workout.notes ? " · escrita" : ""}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <form action={updateWorkoutNotes} className="mt-3 grid gap-2">
            <input type="hidden" name="workoutId" value={workout.id} />
            <Textarea
              name="notes"
              defaultValue={workout.notes ?? ""}
              maxLength={2000}
              rows={3}
              placeholder="Cómo fue, molestias, cambios de máquina…"
            />
            <PendingButton type="submit" variant="outline" className="h-10">
              Guardar nota
            </PendingButton>
          </form>
        </CollapsibleContent>
      </Collapsible>

      <Card className="mt-6 p-4">
        <form action={addExercise} className="flex gap-2">
          <input type="hidden" name="workoutId" value={workout.id} />
          <label htmlFor="exerciseId" className="sr-only">
            Ejercicio
          </label>
          <FormSelect
            id="exerciseId"
            name="exerciseId"
            required
            disabled={availableExercises.length === 0}
            placeholder={
              availableExercises.length > 0 ? "Añadir ejercicio" : "Todos añadidos"
            }
            options={availableExercises.map((exercise) => ({
              value: exercise.id,
              label: exercise.name,
              group: exercise.muscleGroup,
            }))}
            className="h-14 min-w-0 flex-1 rounded-2xl px-4 text-base font-semibold"
          />
          <Button
            type="submit"
            size="icon"
            disabled={availableExercises.length === 0}
            className="size-14 shrink-0 rounded-2xl"
            aria-label="Añadir ejercicio"
          >
            <PlusIcon className="size-5" />
          </Button>
        </form>
      </Card>

      {exerciseRows.length === 0 ? (
        <section className="mt-12 rounded-3xl border border-dashed border-border px-6 py-12 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-muted text-2xl">
            +
          </div>
          <h2 className="mt-5 text-xl font-extrabold text-foreground">
            Añade tu primer ejercicio
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Elige uno arriba y registra cada serie cuando la completes.
          </p>
        </section>
      ) : (
        <div className="mt-6 grid items-start gap-5 md:grid-cols-2">
          {exerciseRows.map((exercise, exerciseIndex) => {
            const sets = setRows.filter(
              (set) => set.workoutExerciseId === exercise.workoutExerciseId,
            );
            const reference = references.get(exercise.workoutExerciseId) ?? null;
            const target =
              exercise.targetSets !== null
                ? {
                    variation: exercise.variation, progressionSteps: exercise.progressionSteps, progressionStep: exercise.progressionStep,
        measurement: exercise.measurement, loadType: exercise.loadType, targetSeconds: exercise.targetSeconds,
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
              <Card
                key={exercise.workoutExerciseId}
                className={`gap-0 overflow-hidden py-0 ${isComplete ? "border-primary/45 bg-primary/5" : ""}`}
              >
                <div className="flex items-start gap-3 border-b border-border p-5">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-sm font-black text-primary-foreground">
                    {String(exerciseIndex + 1).padStart(2, "0")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-extrabold leading-tight text-balance text-foreground">
                      {exercise.name}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
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
                      className={`h-10 rounded-xl px-3 text-xs font-black ${isComplete ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                    >
                      {isComplete ? "✓ Hecho" : "Completar"}
                    </PendingButton>
                  </form>
                </div>

                <div className="px-5"><WeightView defaultUnit={trainingUnit} storageKey={`${userId}:${workout.id}:${exercise.workoutExerciseId}`} selectable={exercise.loadType !== "bodyweight"}>
                <div className="pt-4">
                  {target && (
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {formatTarget(exercise)}
                      </Badge>
                      <Badge variant={remainingSets === 0 ? "default" : "outline"}>
                        {remainingSets === 0
                          ? "Objetivo alcanzado"
                          : `Faltan ${remainingSets}`}
                      </Badge>
                    </div>
                  )}
                  {exercise.measurement === "reps" && exercise.loadType === "external" && suggestion && (
                    <Alert className="mb-2">
                      <TrendingUpIcon />
                      <AlertTitle>Toca subir peso</AlertTitle>
                      <AlertDescription>
                        Llevas {suggestion.sessions} sesiones y {suggestion.days}{" "}
                        días cerrando el rango con <WeightValue value={suggestion.fromWeight} from={workout.weightUnit} />. Prueba <WeightValue value={suggestion.toWeight} from={workout.weightUnit} /> y vuelve al mínimo de repeticiones.
                      </AlertDescription>
                    </Alert>
                  )}
                  {exercise.measurement === "reps" && exercise.loadType === "external" && reference && reference.sets.length > 0 ? (
                    <Alert className="bg-muted/40">
                      <HistoryIcon />
                      <AlertTitle>Última vez</AlertTitle>
                      <AlertDescription>
                        {reference.sets.map((set, index) => <span key={index}>{index > 0 ? " · " : ""}<WeightSet value={set} from={workout.weightUnit} /></span>)}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Primera vez con este ejercicio
                    </p>
                  )}
                  <Link href={`/exercises/${exercise.exerciseId}`} className="mt-2 inline-block text-xs font-bold text-muted-foreground hover:text-primary">
                    Ver progreso completo →
                  </Link>
                </div>

                {sets.length > 0 && (
                  <div className="px-5 pt-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Registro</TableHead>
                          <TableHead>RPE</TableHead>
                          <TableHead className="w-10 text-right">Editar</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sets.map((set, index) => (
                          <TableRow key={set.id}>
                            <TableCell className="text-muted-foreground">
                              {index + 1}
                            </TableCell>
                            <TableCell className="font-semibold text-foreground">
                              <WeightSet value={{ ...set, weight: Number(set.weight) }} from={workout.weightUnit} />
                            </TableCell>
                            <TableCell className="font-semibold text-foreground">
                              {set.rpe ?? "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Dialog>
                                <DialogTrigger
                                  className="grid size-8 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                                  aria-label={`Editar serie ${index + 1}`}
                                >
                                  <PencilIcon className="size-4" />
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-sm">
                                  <DialogHeader>
                                    <DialogTitle>Serie {index + 1}</DialogTitle>
                                    <DialogDescription>
                                      {exercise.name} · <WeightSet value={{ ...set, weight: Number(set.weight) }} from={workout.weightUnit} />
                                    </DialogDescription>
                                  </DialogHeader>

                                  <form action={updateSet} className="grid gap-3">
                                    <input type="hidden" name="workoutId" value={workout.id} />
                                    <input type="hidden" name="setId" value={set.id} />
                                    <RecordedSetFields value={{ ...set, weight: Number(set.weight) }} unit={workout.weightUnit} />
                                    <PendingButton type="submit" className="w-full">
                                      Guardar cambios
                                    </PendingButton>
                                  </form>

                                  <DialogFooter>
                                    <form action={deleteSet} className="w-full sm:w-auto">
                                      <input type="hidden" name="workoutId" value={workout.id} />
                                      <input type="hidden" name="setId" value={set.id} />
                                      <ConfirmSubmitButton
                                        type="submit"
                                        variant="destructive"
                                        className="w-full sm:w-auto"
                                        confirmation={`¿Eliminar la serie ${index + 1}? No se puede deshacer.`}
                                      >
                                        Eliminar serie
                                      </ConfirmSubmitButton>
                                    </form>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                </WeightView></div>
                <SetEntryForm />
              </Card>
            );
          })}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur">
        <form action={finishWorkout} className="mx-auto max-w-md md:max-w-sm">
          <input type="hidden" name="workoutId" value={workout.id} />
          <ConfirmSubmitButton
            type="submit"
            disabled={totalSets === 0}
            confirmation={`¿Finalizar toda la sesión? Has completado ${completedExercises} de ${exerciseRows.length} ejercicios.`}
            pendingLabel="Finalizando…"
            className="h-14 w-full rounded-2xl bg-foreground text-base font-black text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          >
            {totalSets === 0
              ? "Registra una serie para terminar"
              : `Finalizar sesión completa · ${totalSets} ${totalSets === 1 ? "serie" : "series"}`}
          </ConfirmSubmitButton>
          {totalSets > 0 && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {completedExercises}/{exerciseRows.length} ejercicios marcados como completados.
            </p>
          )}
        </form>

        {/*
          La salida que faltaba. Sin esto, dejar una sesión a medias obligaba a
          finalizarla, y acababa contando como un entreno que no hiciste.
        */}
        <form action={discardWorkout} className="mx-auto mt-2 max-w-md md:max-w-sm">
          <input type="hidden" name="workoutId" value={workout.id} />
          <ConfirmSubmitButton
            type="submit"
            variant="ghost"
            confirmation={
              totalSets === 0
                ? "¿Descartar esta sesión? No has registrado ninguna serie, así que no se pierde nada."
                : `¿Descartar esta sesión? Se perderán las ${totalSets} ${totalSets === 1 ? "serie" : "series"} que registraste, y no contará como entreno.`
            }
            pendingLabel="Descartando…"
            className="h-10 w-full text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Descartar sesión
          </ConfirmSubmitButton>
        </form>
      </div>
    </main>
  );
}
