import { and, asc, eq } from "drizzle-orm";
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
      <AppHeader backHref="/history" eyebrow="Entrenamiento completado" title={workout.planName ?? "Sesión libre"} />

      <section className="mt-7 rounded-3xl bg-primary p-5 text-primary-foreground">
        <p className="capitalize font-extrabold">{dateLabel}</p>
        <p className="mt-2 text-sm font-semibold text-primary-foreground/75">
          {workoutExerciseList.length} {workoutExerciseList.length === 1 ? "ejercicio" : "ejercicios"}
          {" · "}
          {totalSets} {totalSets === 1 ? "serie" : "series"}
        </p>
      </section>

      <section className="mt-6 space-y-4">
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
                <h2 className="truncate font-extrabold text-foreground">{exercise.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{exercise.muscleGroup}</p>
                {exercise.targetSets !== null && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      Objetivo {exercise.targetSets}×{exercise.targetRepsMin}
                      {exercise.targetRepsMax !== exercise.targetRepsMin
                        ? `–${exercise.targetRepsMax}`
                        : ""}
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

            {exercise.sets.length > 0 ? (
              <div className="px-5 pb-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Peso</TableHead>
                      <TableHead>Reps</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exercise.sets.map((set, setIndex) => (
                      <TableRow key={set.id}>
                        <TableCell className="text-muted-foreground">
                          {setIndex + 1}
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          {Number(set.weight)} {workout.weightUnit}
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          {set.reps}
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
          </Card>
        ))}
      </section>
    </main>
  );
}
