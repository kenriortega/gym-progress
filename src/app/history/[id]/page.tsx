import { getWeightPreferences } from "@/db/preferences";
import { WeightView, WeightSet } from "@/components/weight-view";
import { describeBlock, describeResult } from "@/lib/training-blocks";
import { formatTarget, type ExerciseMetrics, type SetMetrics } from "@/lib/training-metrics";
import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  const userId = session.user.id;
  const { trainingUnit } = await getWeightPreferences(userId);
  const { id } = await params;
  const [workout] = await db
    .select({
      id: workouts.id, blocks: workouts.blocks, blockProgress: workouts.blockProgress,
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
      variation: workoutExercises.variation, progressionSteps: workoutExercises.progressionSteps, progressionStep: workoutExercises.progressionStep,
      measurement: workoutExercises.measurement, loadType: workoutExercises.loadType, targetSeconds: workoutExercises.targetSeconds,
      targetSets: workoutExercises.targetSets,
      targetRepsMin: workoutExercises.targetRepsMin,
      targetRepsMax: workoutExercises.targetRepsMax,
      setId: workoutSets.id,
      setPosition: workoutSets.position,
      durationSeconds: workoutSets.durationSeconds, setLoadType: workoutSets.loadType, assistanceNote: workoutSets.assistanceNote,
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
      /** El del catálogo, para enlazar a su ficha. No el de esta sesión. */
      exerciseId: string;
      name: string;
      muscleGroup: string;
      position: number;
      variation?: string | null; progressionSteps?: string[]; progressionStep?: number | null;
      measurement?: ExerciseMetrics["measurement"]; loadType?: ExerciseMetrics["loadType"]; targetSeconds?: number | null;
      targetSets: number | null;
      targetRepsMin: number | null;
      targetRepsMax: number | null;
      sets: Array<{
        id: string;
        durationSeconds?: number | null; loadType?: SetMetrics["loadType"]; assistanceNote?: string | null;
        reps: number;
        weight: string;
        rpe: string | null;
      }>;
    }
  >();

  for (const row of rows) {
    const exercise = exerciseMap.get(row.workoutExerciseId) ?? {
      id: row.workoutExerciseId,
      exerciseId: row.exerciseId,
      name: row.name,
      muscleGroup: row.muscleGroup,
      position: row.exercisePosition,
      variation: row.variation, progressionSteps: row.progressionSteps, progressionStep: row.progressionStep,
        measurement: row.measurement, loadType: row.loadType, targetSeconds: row.targetSeconds,
      targetSets: row.targetSets,
      targetRepsMin: row.targetRepsMin,
      targetRepsMax: row.targetRepsMax,
      sets: [],
    };

    if (row.setId && row.reps !== null && row.weight !== null) {
      exercise.sets.push({
        id: row.setId,
        durationSeconds: row.durationSeconds, loadType: row.setLoadType ?? undefined, assistanceNote: row.assistanceNote,
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
    <main className="mx-auto min-h-dvh w-full max-w-md md:max-w-3xl lg:max-w-5xl px-5 pb-12 pt-6">
      <AppHeader backHref="/history" eyebrow="Entrenamiento completado" title={workout.planName ?? "Sesión libre"} />

      <section className="mt-7 rounded-3xl bg-primary p-5 text-primary-foreground">
        <p className="capitalize font-extrabold">{dateLabel}</p>
        <p className="mt-2 text-sm font-semibold text-primary-foreground/75">
      {workoutExerciseList.length} {workoutExerciseList.length === 1 ? "ejercicio" : "ejercicios"}
          {" · "}
          {totalSets} {totalSets === 1 ? "serie" : "series"}
        </p>
      </section>

          {workout.blocks.filter((block) => block.format !== "sets").map((block) => <section key={block.id} className="mt-6 border-b border-border pb-5">
        <h2 className="text-xl font-bold">{block.name}</h2><p className="mt-1 text-sm text-muted-foreground">{describeBlock(block)}</p>
        {block.prescription && <p className="mt-2 text-sm">{block.prescription}</p>}
        <p className="mt-3 font-semibold">{workout.blockProgress[block.id]?.result ? describeResult(block, workout.blockProgress[block.id].result!) : "Sin resultado registrado"}</p>
      </section>)}


      <section className="mt-6 grid items-start gap-4 md:grid-cols-2">
        {workoutExerciseList.map((exercise, exerciseIndex) => (
          <Card
            key={exercise.id}
            className="gap-0 overflow-hidden py-0"
          >
            <div className="flex items-center gap-3 border-b border-border p-5">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-sm font-black text-primary-foreground">
                {String(exerciseIndex + 1).padStart(2, "0")}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/exercises/${exercise.exerciseId}`}
                  className="block truncate font-extrabold text-foreground underline-offset-4 hover:text-primary hover:underline"
                >
                  {exercise.name}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">{exercise.muscleGroup}</p>
                {exercise.targetSets !== null && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {formatTarget(exercise)}
                    </Badge>
                    <Badge
                      variant={
                        exercise.sets.length >= exercise.targetSets
                          ? "default"
                          : "outline"
                      }
                    >
                      {exercise.sets.length >= exercise.targetSets
                        ? "Cumplido"
                        : `Quedaron ${exercise.targetSets - exercise.sets.length}`}
                    </Badge>
                  </div>
                )}
              </div>
              <Badge variant="outline">
                {exercise.sets.length} {exercise.sets.length === 1 ? "serie" : "series"}
              </Badge>
            </div>

            <div className="px-5"><WeightView defaultUnit={trainingUnit} storageKey={`${userId}:${workout.id}:${exercise.id}`} selectable={exercise.loadType !== "bodyweight"}>
            {exercise.sets.length > 0 ? (
              <div className="px-5 pb-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Registro</TableHead>
                      <TableHead>Esfuerzo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exercise.sets.map((set, setIndex) => (
                      <TableRow key={set.id}>
                        <TableCell className="text-muted-foreground">
                          {setIndex + 1}
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          <WeightSet value={{ ...set, weight: Number(set.weight) }} from={workout.weightUnit} />
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          {set.rpe ? (
                            <span className="ml-2 font-normal text-muted-foreground">
                              RPE {Number(set.rpe)}
                            </span>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="p-5 text-sm text-muted-foreground">
                No se registraron series.
              </p>
            )}
            </WeightView></div>
          </Card>
        ))}
      </section>
    </main>
  );
}
