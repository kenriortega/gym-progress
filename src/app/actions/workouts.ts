"use server";

import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { db } from "@/db";
import {
  exercises,
  trainingPlanExercises,
  trainingPlans,
  users,
  workoutExercises,
  workouts,
  workoutSets,
} from "@/db/schema";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireUserId() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return session.user.id;
}

function requiredUuid(formData: FormData, field: string) {
  const value = formData.get(field);

  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new Error(`El campo ${field} no es válido.`);
  }

  return value;
}

/** Id generado en el móvil. Si falta, lo pone Postgres como hasta ahora. */
function optionalUuid(formData: FormData, field: string) {
  const value = formData.get(field);

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new Error(`El campo ${field} no es válido.`);
  }

  return value;
}

function parseSetValues(formData: FormData) {
  const reps = Number(formData.get("reps"));
  const weight = Number(formData.get("weight"));
  const rawRpe = formData.get("rpe");
  const rpe = rawRpe === "" || rawRpe === null ? null : Number(rawRpe);

  if (!Number.isInteger(reps) || reps < 1 || reps > 1000) {
    throw new Error("Las repeticiones deben ser un número entero mayor que cero.");
  }

  if (!Number.isFinite(weight) || weight < 0 || weight > 99999) {
    throw new Error("El peso no es válido.");
  }

  if (rpe !== null && (!Number.isFinite(rpe) || rpe < 1 || rpe > 10)) {
    throw new Error("El RPE debe estar entre 1 y 10.");
  }

  return { reps, weight, rpe };
}

export async function startWorkout(formData?: FormData) {
  const userId = await requireUserId();
  const rawPlanId = formData?.get("planId");
  const planId =
    typeof rawPlanId === "string" && rawPlanId !== ""
      ? requiredUuid(formData!, "planId")
      : null;

  const [existingWorkout] = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(and(eq(workouts.userId, userId), eq(workouts.status, "active")))
    .limit(1);

  if (existingWorkout) {
    redirect(`/workout/${existingWorkout.id}`);
  }

  const [user] = await db
    .select({ preferredWeightUnit: users.preferredWeightUnit })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const createdWorkout = await db.transaction(async (transaction) => {
    if (planId) {
      const [ownedPlan] = await transaction
        .select({ id: trainingPlans.id })
        .from(trainingPlans)
        .where(
          and(
            eq(trainingPlans.id, planId),
            eq(trainingPlans.userId, userId),
            isNull(trainingPlans.archivedAt),
          ),
        )
        .limit(1);

      if (!ownedPlan) {
        throw new Error("No tienes acceso a este plan.");
      }
    }

    const [created] = await transaction
      .insert(workouts)
      .values({
        userId,
        trainingPlanId: planId,
        weightUnit: user?.preferredWeightUnit ?? "kg",
      })
      .onConflictDoNothing()
      .returning({ id: workouts.id });

    if (!created || !planId) {
      return created;
    }

    const plannedExercises = await transaction
      .select({
        exerciseId: trainingPlanExercises.exerciseId,
        position: trainingPlanExercises.position,
        targetSets: trainingPlanExercises.targetSets,
        targetRepsMin: trainingPlanExercises.targetRepsMin,
        targetRepsMax: trainingPlanExercises.targetRepsMax,
        notes: trainingPlanExercises.notes,
      })
      .from(trainingPlanExercises)
      .where(eq(trainingPlanExercises.planId, planId))
      .orderBy(asc(trainingPlanExercises.position));

    if (plannedExercises.length > 0) {
      await transaction.insert(workoutExercises).values(
        plannedExercises.map((exercise) => ({
          workoutId: created.id,
          exerciseId: exercise.exerciseId,
          position: exercise.position,
          targetSets: exercise.targetSets,
          targetRepsMin: exercise.targetRepsMin,
          targetRepsMax: exercise.targetRepsMax,
          notes: exercise.notes,
        })),
      );
    }

    return created;
  });

  if (createdWorkout) {
    redirect(`/workout/${createdWorkout.id}`);
  }

  const [concurrentWorkout] = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(and(eq(workouts.userId, userId), eq(workouts.status, "active")))
    .limit(1);

  if (!concurrentWorkout) {
    throw new Error("No se pudo crear el entrenamiento.");
  }

  redirect(`/workout/${concurrentWorkout.id}`);
}

export async function addExercise(formData: FormData) {
  const userId = await requireUserId();
  const workoutId = requiredUuid(formData, "workoutId");
  const exerciseId = requiredUuid(formData, "exerciseId");

  await db.transaction(async (transaction) => {
    const [workout] = await transaction
      .select({ id: workouts.id, trainingPlanId: workouts.trainingPlanId })
      .from(workouts)
      .where(
        and(
          eq(workouts.id, workoutId),
          eq(workouts.userId, userId),
          eq(workouts.status, "active"),
        ),
      )
      .limit(1);

    const [exercise] = await transaction
      .select({ id: exercises.id })
      .from(exercises)
      .where(
        and(
          eq(exercises.id, exerciseId),
          isNull(exercises.archivedAt),
          or(isNull(exercises.userId), eq(exercises.userId, userId)),
        ),
      )
      .limit(1);

    if (!workout || !exercise) {
      throw new Error("El entrenamiento o el ejercicio no están disponibles.");
    }

    const [alreadyAdded] = await transaction
      .select({ id: workoutExercises.id })
      .from(workoutExercises)
      .where(
        and(
          eq(workoutExercises.workoutId, workoutId),
          eq(workoutExercises.exerciseId, exerciseId),
        ),
      )
      .limit(1);

    if (alreadyAdded) {
      return;
    }

    const [lastPosition] = await transaction
      .select({ value: sql<number>`coalesce(max(${workoutExercises.position}), -1)` })
      .from(workoutExercises)
      .where(eq(workoutExercises.workoutId, workoutId));

    const [planTarget] = workout.trainingPlanId
      ? await transaction
          .select({
            targetSets: trainingPlanExercises.targetSets,
            targetRepsMin: trainingPlanExercises.targetRepsMin,
            targetRepsMax: trainingPlanExercises.targetRepsMax,
          })
          .from(trainingPlanExercises)
          .where(
            and(
              eq(trainingPlanExercises.planId, workout.trainingPlanId),
              eq(trainingPlanExercises.exerciseId, exerciseId),
            ),
          )
          .limit(1)
      : [];

    await transaction.insert(workoutExercises).values({
      workoutId,
      exerciseId,
      position: Number(lastPosition?.value ?? -1) + 1,
      targetSets: planTarget?.targetSets ?? null,
      targetRepsMin: planTarget?.targetRepsMin ?? null,
      targetRepsMax: planTarget?.targetRepsMax ?? null,
    });
  });

  revalidatePath(`/workout/${workoutId}`);
}

export async function addSet(formData: FormData) {
  const userId = await requireUserId();
  const workoutId = requiredUuid(formData, "workoutId");
  const workoutExerciseId = requiredUuid(formData, "workoutExerciseId");
  const setId = optionalUuid(formData, "setId");
  const { reps, weight, rpe } = parseSetValues(formData);

  await db.transaction(async (transaction) => {
    const [ownedExercise] = await transaction
      .select({ id: workoutExercises.id })
      .from(workoutExercises)
      .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
      .where(
        and(
          eq(workoutExercises.id, workoutExerciseId),
          eq(workoutExercises.workoutId, workoutId),
          eq(workouts.userId, userId),
          eq(workouts.status, "active"),
        ),
      )
      .limit(1);

    if (!ownedExercise) {
      throw new Error("No tienes acceso a este entrenamiento.");
    }

    const [lastPosition] = await transaction
      .select({ value: sql<number>`coalesce(max(${workoutSets.position}), -1)` })
      .from(workoutSets)
      .where(eq(workoutSets.workoutExerciseId, workoutExerciseId));

    // El móvil puede haber generado el id sin conexión. Reenviar la misma
    // serie no debe duplicarla: por eso el insert es idempotente por id.
    await transaction
      .insert(workoutSets)
      .values({
        ...(setId ? { id: setId } : {}),
        workoutExerciseId,
        position: Number(lastPosition?.value ?? -1) + 1,
        reps,
        weight: weight.toFixed(2),
        rpe: rpe?.toFixed(1) ?? null,
        completedAt: new Date(),
      })
      .onConflictDoNothing({ target: workoutSets.id });
  });

  revalidatePath(`/workout/${workoutId}`);
}

export type SetActionState = {
  status: "idle" | "success" | "error";
  message: string;
  savedAt: number;
};

export async function addSetWithState(
  _previousState: SetActionState,
  formData: FormData,
): Promise<SetActionState> {
  try {
    await addSet(formData);
    return {
      status: "success",
      message: "Serie guardada",
      savedAt: Date.now(),
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "No se pudo guardar la serie.",
      savedAt: Date.now(),
    };
  }
}

export async function updateSet(formData: FormData) {
  const userId = await requireUserId();
  const workoutId = requiredUuid(formData, "workoutId");
  const setId = requiredUuid(formData, "setId");
  const { reps, weight, rpe } = parseSetValues(formData);

  await db
    .update(workoutSets)
    .set({
      reps,
      weight: weight.toFixed(2),
      rpe: rpe?.toFixed(1) ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(workoutSets.id, setId),
        sql`exists (
          select 1
          from ${workoutExercises}
          join ${workouts} on ${workouts.id} = ${workoutExercises.workoutId}
          where ${workoutExercises.id} = ${workoutSets.workoutExerciseId}
            and ${workouts.id} = ${workoutId}
            and ${workouts.userId} = ${userId}
            and ${workouts.status} = 'active'
        )`,
      ),
    );

  revalidatePath(`/workout/${workoutId}`);
}

export async function toggleExerciseComplete(formData: FormData) {
  const userId = await requireUserId();
  const workoutId = requiredUuid(formData, "workoutId");
  const workoutExerciseId = requiredUuid(formData, "workoutExerciseId");
  const shouldComplete = formData.get("complete") === "true";

  await db
    .update(workoutExercises)
    .set({
      completedAt: shouldComplete ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(workoutExercises.id, workoutExerciseId),
        eq(workoutExercises.workoutId, workoutId),
        sql`exists (
          select 1 from ${workouts}
          where ${workouts.id} = ${workoutExercises.workoutId}
            and ${workouts.userId} = ${userId}
            and ${workouts.status} = 'active'
        )`,
      ),
    );

  revalidatePath(`/workout/${workoutId}`);
}

export async function deleteSet(formData: FormData) {
  const userId = await requireUserId();
  const workoutId = requiredUuid(formData, "workoutId");
  const setId = requiredUuid(formData, "setId");

  await db
    .delete(workoutSets)
    .where(
      and(
        eq(workoutSets.id, setId),
        sql`exists (
          select 1
          from ${workoutExercises}
          join ${workouts} on ${workouts.id} = ${workoutExercises.workoutId}
          where ${workoutExercises.id} = ${workoutSets.workoutExerciseId}
            and ${workouts.id} = ${workoutId}
            and ${workouts.userId} = ${userId}
            and ${workouts.status} = 'active'
        )`,
      ),
    );

  revalidatePath(`/workout/${workoutId}`);
}

export async function finishWorkout(formData: FormData) {
  const userId = await requireUserId();
  const workoutId = requiredUuid(formData, "workoutId");
  const now = new Date();

  await db
    .update(workouts)
    .set({
      status: "completed",
      completedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(workouts.id, workoutId),
        eq(workouts.userId, userId),
        eq(workouts.status, "active"),
      ),
    );

  revalidatePath("/");
  redirect("/");
}
