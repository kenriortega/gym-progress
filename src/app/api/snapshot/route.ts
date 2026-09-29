import { and, asc, desc, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/db";
import {
  exercises,
  trainingPlans,
  workoutExercises,
  workoutSets,
  workouts,
} from "@/db/schema";

export type SnapshotSet = {
  id: string;
  position: number;
  reps: number;
  weight: number;
};

export type SnapshotExercise = {
  workoutExerciseId: string;
  exerciseId: string;
  name: string;
  muscleGroup: string;
  position: number;
  targetSets: number | null;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  completed: boolean;
  sets: SnapshotSet[];
  /** Series de la última sesión completada con este ejercicio. */
  previous: Array<{ reps: number; weight: number }>;
};

export type WorkoutSnapshot = {
  workoutId: string;
  planName: string | null;
  weightUnit: string;
  performedAt: string;
  exercises: SnapshotExercise[];
  /** Momento en que se descargó, para avisar de datos viejos. */
  fetchedAt: number;
};

/**
 * Entrega la sesión activa completa para guardarla en el móvil. Es lo que
 * permite abrir la app sin cobertura y seguir viendo el entrenamiento.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }
  const userId = session.user.id;

  const [activo] = await db
    .select({
      id: workouts.id,
      weightUnit: workouts.weightUnit,
      performedAt: workouts.performedAt,
      planName: trainingPlans.name,
    })
    .from(workouts)
    .leftJoin(trainingPlans, eq(trainingPlans.id, workouts.trainingPlanId))
    .where(and(eq(workouts.userId, userId), eq(workouts.status, "active")))
    .limit(1);

  if (!activo) {
    return NextResponse.json({ workout: null });
  }

  const filas = await db
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
    .where(eq(workoutExercises.workoutId, activo.id))
    .orderBy(asc(workoutExercises.position));

  const ejercicios: SnapshotExercise[] = await Promise.all(
    filas.map(async (fila) => {
      const series = await db
        .select({
          id: workoutSets.id,
          position: workoutSets.position,
          reps: workoutSets.reps,
          weight: workoutSets.weight,
        })
        .from(workoutSets)
        .where(eq(workoutSets.workoutExerciseId, fila.workoutExerciseId))
        .orderBy(asc(workoutSets.position));

      const [anterior] = await db
        .select({ id: workoutExercises.id })
        .from(workoutExercises)
        .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
        .where(
          and(
            eq(workoutExercises.exerciseId, fila.exerciseId),
            eq(workouts.userId, userId),
            eq(workouts.status, "completed"),
            ne(workouts.id, activo.id),
          ),
        )
        .orderBy(desc(workouts.performedAt))
        .limit(1);

      const previas = anterior
        ? await db
            .select({ reps: workoutSets.reps, weight: workoutSets.weight })
            .from(workoutSets)
            .where(eq(workoutSets.workoutExerciseId, anterior.id))
            .orderBy(asc(workoutSets.position))
        : [];

      return {
        workoutExerciseId: fila.workoutExerciseId,
        exerciseId: fila.exerciseId,
        name: fila.name,
        muscleGroup: fila.muscleGroup,
        position: fila.position,
        targetSets: fila.targetSets,
        targetRepsMin: fila.targetRepsMin,
        targetRepsMax: fila.targetRepsMax,
        completed: fila.completedAt !== null,
        sets: series.map((s) => ({
          id: s.id,
          position: s.position,
          reps: s.reps,
          weight: Number(s.weight),
        })),
        previous: previas.map((s) => ({ reps: s.reps, weight: Number(s.weight) })),
      };
    }),
  );

  const snapshot: WorkoutSnapshot = {
    workoutId: activo.id,
    planName: activo.planName,
    weightUnit: activo.weightUnit,
    performedAt: activo.performedAt.toISOString(),
    exercises: ejercicios,
    fetchedAt: Date.now(),
  };

  return NextResponse.json({ workout: snapshot });
}
