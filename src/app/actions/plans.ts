"use server";

import { and, eq, isNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import {
  exercises,
  trainingPlanExercises,
  trainingPlans,
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

function parseWeekday(value: FormDataEntryValue | null) {
  if (value === "" || value === null) return null;
  const weekday = Number(value);

  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    throw new Error("El día de la semana no es válido.");
  }

  return weekday;
}

export async function createPlan(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const weekday = parseWeekday(formData.get("weekday"));

  if (name.length < 2 || name.length > 100) {
    throw new Error("El nombre del plan debe tener entre 2 y 100 caracteres.");
  }

  const [plan] = await db
    .insert(trainingPlans)
    .values({
      userId,
      name,
      description: description || null,
      weekday,
    })
    .returning({ id: trainingPlans.id });

  redirect(`/plans/${plan.id}`);
}

export async function updatePlan(formData: FormData) {
  const userId = await requireUserId();
  const planId = requiredUuid(formData, "planId");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const weekday = parseWeekday(formData.get("weekday"));

  if (name.length < 2 || name.length > 100) {
    throw new Error("El nombre del plan debe tener entre 2 y 100 caracteres.");
  }

  await db
    .update(trainingPlans)
    .set({
      name,
      description: description || null,
      weekday,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(trainingPlans.id, planId),
        eq(trainingPlans.userId, userId),
        isNull(trainingPlans.archivedAt),
      ),
    );

  revalidatePath("/");
  revalidatePath("/plans");
  revalidatePath(`/plans/${planId}`);
}

export async function addPlanExercise(formData: FormData) {
  const userId = await requireUserId();
  const planId = requiredUuid(formData, "planId");
  const exerciseId = requiredUuid(formData, "exerciseId");
  const targetSets = Number(formData.get("targetSets"));
  const targetRepsMin = Number(formData.get("targetRepsMin"));
  const targetRepsMax = Number(formData.get("targetRepsMax"));

  if (!Number.isInteger(targetSets) || targetSets < 1 || targetSets > 20) {
    throw new Error("El objetivo de series debe estar entre 1 y 20.");
  }

  if (
    !Number.isInteger(targetRepsMin) ||
    !Number.isInteger(targetRepsMax) ||
    targetRepsMin < 1 ||
    targetRepsMax < targetRepsMin ||
    targetRepsMax > 1000
  ) {
    throw new Error("El rango de repeticiones no es válido.");
  }

  await db.transaction(async (transaction) => {
    const [plan] = await transaction
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

    if (!plan || !exercise) {
      throw new Error("El plan o el ejercicio no están disponibles.");
    }

    const [lastPosition] = await transaction
      .select({
        value: sql<number>`coalesce(max(${trainingPlanExercises.position}), -1)`,
      })
      .from(trainingPlanExercises)
      .where(eq(trainingPlanExercises.planId, planId));

    await transaction
      .insert(trainingPlanExercises)
      .values({
        planId,
        exerciseId,
        position: Number(lastPosition?.value ?? -1) + 1,
        targetSets,
        targetRepsMin,
        targetRepsMax,
      })
      .onConflictDoNothing();
  });

  revalidatePath("/");
  revalidatePath("/plans");
  revalidatePath(`/plans/${planId}`);
}

export async function removePlanExercise(formData: FormData) {
  const userId = await requireUserId();
  const planId = requiredUuid(formData, "planId");
  const planExerciseId = requiredUuid(formData, "planExerciseId");

  await db
    .delete(trainingPlanExercises)
    .where(
      and(
        eq(trainingPlanExercises.id, planExerciseId),
        eq(trainingPlanExercises.planId, planId),
        sql`exists (
          select 1 from ${trainingPlans}
          where ${trainingPlans.id} = ${trainingPlanExercises.planId}
            and ${trainingPlans.userId} = ${userId}
        )`,
      ),
    );

  revalidatePath("/");
  revalidatePath("/plans");
  revalidatePath(`/plans/${planId}`);
}

export async function updatePlanExercise(formData: FormData) {
  const userId = await requireUserId();
  const planId = requiredUuid(formData, "planId");
  const planExerciseId = requiredUuid(formData, "planExerciseId");
  const targetSets = Number(formData.get("targetSets"));
  const targetRepsMin = Number(formData.get("targetRepsMin"));
  const targetRepsMax = Number(formData.get("targetRepsMax"));

  if (!Number.isInteger(targetSets) || targetSets < 1 || targetSets > 20) {
    throw new Error("El objetivo de series debe estar entre 1 y 20.");
  }

  if (
    !Number.isInteger(targetRepsMin) ||
    !Number.isInteger(targetRepsMax) ||
    targetRepsMin < 1 ||
    targetRepsMax < targetRepsMin ||
    targetRepsMax > 1000
  ) {
    throw new Error("El rango de repeticiones no es válido.");
  }

  await db
    .update(trainingPlanExercises)
    .set({ targetSets, targetRepsMin, targetRepsMax, updatedAt: new Date() })
    .where(
      and(
        eq(trainingPlanExercises.id, planExerciseId),
        eq(trainingPlanExercises.planId, planId),
        sql`exists (
          select 1 from ${trainingPlans}
          where ${trainingPlans.id} = ${trainingPlanExercises.planId}
            and ${trainingPlans.userId} = ${userId}
            and ${trainingPlans.archivedAt} is null
        )`,
      ),
    );

  revalidatePath("/");
  revalidatePath(`/plans/${planId}`);
}

export async function movePlanExercise(formData: FormData) {
  const userId = await requireUserId();
  const planId = requiredUuid(formData, "planId");
  const planExerciseId = requiredUuid(formData, "planExerciseId");
  const direction = String(formData.get("direction"));

  if (direction !== "up" && direction !== "down") {
    throw new Error("La dirección no es válida.");
  }

  await db.transaction(async (transaction) => {
    const [plan] = await transaction
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

    if (!plan) throw new Error("No tienes acceso a este plan.");

    const items = await transaction
      .select({ id: trainingPlanExercises.id, position: trainingPlanExercises.position })
      .from(trainingPlanExercises)
      .where(eq(trainingPlanExercises.planId, planId))
      .orderBy(trainingPlanExercises.position);
    const currentIndex = items.findIndex((item) => item.id === planExerciseId);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= items.length) return;

    const current = items[currentIndex];
    const target = items[targetIndex];
    const temporaryPosition = Math.max(...items.map((item) => item.position)) + 1;

    await transaction
      .update(trainingPlanExercises)
      .set({ position: temporaryPosition })
      .where(eq(trainingPlanExercises.id, current.id));
    await transaction
      .update(trainingPlanExercises)
      .set({ position: current.position })
      .where(eq(trainingPlanExercises.id, target.id));
    await transaction
      .update(trainingPlanExercises)
      .set({ position: target.position })
      .where(eq(trainingPlanExercises.id, current.id));
  });

  revalidatePath("/");
  revalidatePath(`/plans/${planId}`);
}

export async function duplicatePlan(formData: FormData) {
  const userId = await requireUserId();
  const planId = requiredUuid(formData, "planId");

  const duplicatedPlan = await db.transaction(async (transaction) => {
    const [source] = await transaction
      .select()
      .from(trainingPlans)
      .where(
        and(
          eq(trainingPlans.id, planId),
          eq(trainingPlans.userId, userId),
          isNull(trainingPlans.archivedAt),
        ),
      )
      .limit(1);

    if (!source) throw new Error("No tienes acceso a este plan.");

    const existingPlans = await transaction
      .select({ name: trainingPlans.name })
      .from(trainingPlans)
      .where(
        and(
          eq(trainingPlans.userId, userId),
          isNull(trainingPlans.archivedAt),
        ),
      );
    const existingNames = new Set(existingPlans.map((plan) => plan.name.toLowerCase()));
    let copyNumber = 1;
    let copyName = `${source.name} copia`;

    while (existingNames.has(copyName.toLowerCase())) {
      copyNumber += 1;
      copyName = `${source.name} copia ${copyNumber}`;
    }

    copyName = copyName.slice(0, 100);
    const [created] = await transaction
      .insert(trainingPlans)
      .values({
        userId,
        name: copyName,
        description: source.description,
        weekday: null,
      })
      .returning({ id: trainingPlans.id });

    const exercisesToCopy = await transaction
      .select({
        exerciseId: trainingPlanExercises.exerciseId,
        position: trainingPlanExercises.position,
        targetSets: trainingPlanExercises.targetSets,
        targetRepsMin: trainingPlanExercises.targetRepsMin,
        targetRepsMax: trainingPlanExercises.targetRepsMax,
        notes: trainingPlanExercises.notes,
      })
      .from(trainingPlanExercises)
      .where(eq(trainingPlanExercises.planId, planId));

    if (exercisesToCopy.length > 0) {
      await transaction.insert(trainingPlanExercises).values(
        exercisesToCopy.map((exercise) => ({ ...exercise, planId: created.id })),
      );
    }

    return created;
  });

  revalidatePath("/");
  revalidatePath("/plans");
  redirect(`/plans/${duplicatedPlan.id}`);
}

export async function archivePlan(formData: FormData) {
  const userId = await requireUserId();
  const planId = requiredUuid(formData, "planId");

  await db
    .update(trainingPlans)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(trainingPlans.id, planId),
        eq(trainingPlans.userId, userId),
        isNull(trainingPlans.archivedAt),
      ),
    );

  revalidatePath("/");
  revalidatePath("/plans");
  redirect("/plans");
}
