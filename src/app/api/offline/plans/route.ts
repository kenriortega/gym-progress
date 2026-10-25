import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/db";
import {
  exercises, planReschedules, trainingPlanExercises, trainingPlans,
  users, workoutExercises, workouts, workoutSets,
} from "@/db/schema";
import type { OfflinePlans, PreviousPerformance } from "@/lib/offline/plan-types";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

/** Paquete completo del usuario: no requiere visitar cada plan ni crear sesión. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers });
  }
  const userId = session.user.id;
  try {
    const data = await db.transaction(async (tx): Promise<OfflinePlans> => {
      const [profile] = await tx.select({ weightUnit: users.preferredWeightUnit })
        .from(users).where(eq(users.id, userId)).limit(1);
      const plans = await tx.select({
        id: trainingPlans.id, name: trainingPlans.name,
        description: trainingPlans.description, weekday: trainingPlans.weekday,
      }).from(trainingPlans)
        .where(and(eq(trainingPlans.userId, userId), isNull(trainingPlans.archivedAt)))
        .orderBy(asc(trainingPlans.weekday), asc(trainingPlans.name));
      const ids = plans.map((plan) => plan.id);
      const rows = ids.length === 0 ? [] : await tx.select({
        id: trainingPlanExercises.id, planId: trainingPlanExercises.planId,
        exerciseId: exercises.id, name: exercises.name, muscleGroup: exercises.muscleGroup,
        position: trainingPlanExercises.position, targetSets: trainingPlanExercises.targetSets,
        targetRepsMin: trainingPlanExercises.targetRepsMin, targetRepsMax: trainingPlanExercises.targetRepsMax,
        notes: trainingPlanExercises.notes,
      }).from(trainingPlanExercises)
        .innerJoin(exercises, eq(exercises.id, trainingPlanExercises.exerciseId))
        .where(inArray(trainingPlanExercises.planId, ids))
        .orderBy(asc(trainingPlanExercises.position));
      // Se conservan también movimientos hacia el pasado: la fecha original
      // puede seguir en el futuro y debe continuar excluida del calendario.
      const reschedules = ids.length === 0 ? [] : await tx.select({
        planId: planReschedules.planId, fromDate: planReschedules.fromDate, toDate: planReschedules.toDate,
      }).from(planReschedules)
        .where(and(eq(planReschedules.userId, userId), inArray(planReschedules.planId, ids)));
      const exerciseIds = [...new Set(rows.map((row) => row.exerciseId))];
      const previousRows = exerciseIds.length === 0 ? [] : await tx
        .selectDistinctOn([workoutExercises.exerciseId], {
          id: workoutExercises.id, exerciseId: workoutExercises.exerciseId,
          performedAt: workouts.performedAt, weightUnit: workouts.weightUnit,
        }).from(workoutExercises)
        .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
        .where(and(eq(workouts.userId, userId), eq(workouts.status, "completed"),
          inArray(workoutExercises.exerciseId, exerciseIds)))
        .orderBy(asc(workoutExercises.exerciseId), desc(workouts.performedAt), desc(workouts.id));
      const previousIds = previousRows.map((row) => row.id);
      const previousSets = previousIds.length === 0 ? [] : await tx.select({
        workoutExerciseId: workoutSets.workoutExerciseId, reps: workoutSets.reps,
        weight: workoutSets.weight, rpe: workoutSets.rpe,
      }).from(workoutSets).where(inArray(workoutSets.workoutExerciseId, previousIds))
        .orderBy(asc(workoutSets.position));
      const previous = new Map<string, PreviousPerformance>(previousRows.map((row) => [row.exerciseId, {
        performedAt: row.performedAt.toISOString(), weightUnit: row.weightUnit,
        sets: previousSets.filter((set) => set.workoutExerciseId === row.id).map((set) => ({
          reps: set.reps, weight: Number(set.weight), rpe: set.rpe === null ? null : Number(set.rpe),
        })),
      }]));
      return {
        schemaVersion: 1, userId, weightUnit: profile?.weightUnit ?? "kg", generatedAt: Date.now(),
        plans: plans.map((plan) => ({
          ...plan,
          exercises: rows.filter((row) => row.planId === plan.id).map((exercise) => ({
            id: exercise.id, exerciseId: exercise.exerciseId, name: exercise.name,
            muscleGroup: exercise.muscleGroup, position: exercise.position,
            targetSets: exercise.targetSets, targetRepsMin: exercise.targetRepsMin,
            targetRepsMax: exercise.targetRepsMax, notes: exercise.notes,
            previous: previous.get(exercise.exerciseId) ?? null,
          })),
        })),
        reschedules,
      };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error("No se pudieron descargar los planes offline", error);
    return NextResponse.json({ error: "No se pudieron descargar los planes" }, { status: 500, headers });
  }
}
