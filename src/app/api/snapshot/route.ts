import { and, asc, desc, eq, ne, isNull } from "drizzle-orm";
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

import type { WorkoutSnapshot, SnapshotExercise } from "@/lib/offline/types";

export const dynamic = "force-dynamic";

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
      id: workouts.id, blocks: workouts.blocks, discipline: workouts.discipline, blockProgress: workouts.blockProgress,
      trainingPlanId: workouts.trainingPlanId,
      weightUnit: workouts.weightUnit,
      performedAt: workouts.performedAt,
      planName: trainingPlans.name,
    })
    .from(workouts)
    .leftJoin(trainingPlans, eq(trainingPlans.id, workouts.trainingPlanId))
    .where(and(eq(workouts.userId, userId), eq(workouts.status, "active")))
    .limit(1);

  if (!activo) {
    return NextResponse.json({ userId, workout: null }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const filas = await db
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
      notes: workoutExercises.notes,
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
          durationSeconds: workoutSets.durationSeconds, loadType: workoutSets.loadType, assistanceNote: workoutSets.assistanceNote,
          reps: workoutSets.reps,
          weight: workoutSets.weight,
          rpe: workoutSets.rpe,
        })
        .from(workoutSets)
        .where(eq(workoutSets.workoutExerciseId, fila.workoutExerciseId))
        .orderBy(asc(workoutSets.position));

      const [anterior] = await db
        .select({ id: workoutExercises.id, weightUnit: workouts.weightUnit })
        .from(workoutExercises)
        .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
        .where(
          and(
            eq(workoutExercises.exerciseId, fila.exerciseId),
            fila.variation === null ? isNull(workoutExercises.variation) : eq(workoutExercises.variation, fila.variation),
            eq(workoutExercises.measurement, fila.measurement), eq(workoutExercises.loadType, fila.loadType),
            eq(workouts.userId, userId),
            eq(workouts.status, "completed"),
            ne(workouts.id, activo.id),
          ),
        )
        .orderBy(desc(workouts.performedAt))
        .limit(1);

      const previas = anterior
        ? await db
            .select({ reps: workoutSets.reps, weight: workoutSets.weight, durationSeconds: workoutSets.durationSeconds, loadType: workoutSets.loadType, assistanceNote: workoutSets.assistanceNote })
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
        variation: fila.variation, progressionSteps: fila.progressionSteps, progressionStep: fila.progressionStep,
        measurement: fila.measurement, loadType: fila.loadType, targetSeconds: fila.targetSeconds,
        targetSets: fila.targetSets,
        targetRepsMin: fila.targetRepsMin,
        targetRepsMax: fila.targetRepsMax,
        completed: fila.completedAt !== null,
        notes: fila.notes,
        previousWeightUnit: anterior?.weightUnit,
        sets: series.map((s) => ({
          id: s.id,
          position: s.position,
          reps: s.reps,
          weight: Number(s.weight),
          durationSeconds: s.durationSeconds, loadType: s.loadType, assistanceNote: s.assistanceNote,
          rpe: s.rpe === null ? null : Number(s.rpe),
        })),
        previous: previas.map((s) => ({ ...s, weight: Number(s.weight) })),
      };
    }),
  );

  const snapshot: WorkoutSnapshot = {
    userId, blocks: activo.blocks, discipline: activo.discipline, blockProgress: activo.blockProgress,
    trainingPlanId: activo.trainingPlanId,
    workoutId: activo.id,
    planName: activo.planName,
    weightUnit: activo.weightUnit,
    performedAt: activo.performedAt.toISOString(),
    exercises: ejercicios,
    fetchedAt: Date.now(),
  };

  return NextResponse.json({ userId, workout: snapshot }, { headers: { "Cache-Control": "private, no-store" } });
}
