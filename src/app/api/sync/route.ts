import { isDeepStrictEqual } from "node:util";
import { validBlocks, validProgress, validDiscipline } from "@/lib/training-blocks";
import { validMetrics, validSet, matchesExercise } from "@/lib/training-metrics";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/db";
import { exercises, trainingPlans, users, workoutExercises, workoutSets, workouts } from "@/db/schema";
import type { QueuedMutation } from "@/lib/offline/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const integer = (value: unknown, min: number, max: number) => typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
const timestamp = (value: unknown) => typeof value === "number" && Number.isFinite(value) && Number.isFinite(new Date(value).getTime());
const failure = (error: string, status = 409, extra = {}) => NextResponse.json({ error, ...extra }, { status });
const ok = () => NextResponse.json({ ok: true });

type StartMutation = Extract<QueuedMutation, { kind: "startWorkout" }>;
function validStart(m: Record<string, unknown>): m is StartMutation {
  if (!validDiscipline(m.discipline ?? "strength") || !UUID.test(String(m.planId)) || (m.weightUnit !== "kg" && m.weightUnit !== "lb") ||
      typeof m.performedAt !== "string" || !Number.isFinite(Date.parse(m.performedAt)) ||
      !Array.isArray(m.exercises) || m.exercises.length === 0 || m.exercises.length > 200) return false;
  const ids = new Set<string>();
  const exercisesIds = new Set<string>();
  if (!validBlocks(m.blocks ?? [], m.exercises.map((value) => String((value as Record<string, unknown>)?.exerciseId)))) return false;
  return m.exercises.every((value: unknown, position) => {
    if (!value || typeof value !== "object") return false;
    const exercise = value as Record<string, unknown>;
    if (!UUID.test(String(exercise.workoutExerciseId)) || !UUID.test(String(exercise.exerciseId)) ||
        !validMetrics(exercise) ||
        (exercise.measurement === "time" && (exercise.targetRepsMin !== null || exercise.targetRepsMax !== null)) ||
        exercise.position !== position || ids.has(String(exercise.workoutExerciseId)) || exercisesIds.has(String(exercise.exerciseId)) ||
        !(exercise.targetSets === null || integer(exercise.targetSets, 1, 20)) ||
        !((exercise.targetRepsMin === null && exercise.targetRepsMax === null) ||
          (integer(exercise.targetRepsMin, 1, 1000) && integer(exercise.targetRepsMax, Number(exercise.targetRepsMin), 1000))) ||
        !(exercise.notes === null || (typeof exercise.notes === "string" && exercise.notes.length <= 1000))) return false;
    ids.add(String(exercise.workoutExerciseId));
    exercisesIds.add(String(exercise.exerciseId));
    return true;
  });
}

/** El cliente aporta IDs y fechas; el servidor verifica propietario y estado. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return failure("Sin sesión", 401);
  let body: unknown;
  try { body = await request.json(); } catch { return failure("JSON inválido", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return failure("Operación inválida", 400);
  const m = body as Record<string, unknown>;
  const userId = session.user.id;
  // Impide enviar una cola de A usando las cookies de B, incluso si cambian
  // entre la lectura local y esta petición.
  if (m.userId !== userId) return failure("La cuenta ha cambiado. Inicia sesión con la cuenta propietaria.", 403);
  if (!UUID.test(String(m.id)) || !UUID.test(String(m.workoutId)) || !timestamp(m.createdAt)) return failure("Identificadores o fecha inválidos", 400);
  try {
    if (m.kind === "startWorkout") {
      if (!validStart(m)) return failure("Sesión inicial inválida", 400);
      return await startWorkout(userId, m);
    }
    const workoutId = String(m.workoutId);
    if (m.kind === "discardWorkout") {
      return await db.transaction(async (tx) => {
        // Serializar con startWorkout, incluso si el inicio aún está en vuelo.
        await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
        const [workout] = await tx.select().from(workouts)
          .where(eq(workouts.id, workoutId)).limit(1).for("update");
        if (workout && workout.userId !== userId) return failure("La sesión no está disponible");
        if (workout?.status === "completed") return failure("El entrenamiento ya fue completado y no puede cancelarse");
        if (workout?.status === "abandoned") return ok();
        if (workout) {
          await tx.update(workouts).set({ status: "abandoned", updatedAt: new Date() }).where(eq(workouts.id, workoutId));
        } else {
          // Marca terminal: un inicio que llegue después nunca podrá reabrirla.
          await tx.insert(workouts).values({ id: workoutId, userId, status: "abandoned" });
        }
        return ok();
      });
    }
    if (m.kind === "finishWorkout") {
      return await db.transaction(async (tx) => {
        const [workout] = await tx.select().from(workouts)
          .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId))).limit(1).for("update");
        if (!workout || workout.status === "abandoned") return failure("La sesión no puede finalizarse");
        if (workout.status === "completed") return ok();
        await tx.update(workouts).set({ status: "completed", completedAt: new Date(Number(m.createdAt)), updatedAt: new Date() })
          .where(eq(workouts.id, workoutId));
        return ok();
      });
    }
    if (m.kind === "blockProgress") {
      return await db.transaction(async (tx) => {
        const [workout] = await tx.select().from(workouts).where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId))).limit(1).for("update");
        const block = workout?.blocks.find((item) => item.id === m.blockId);
        if (!workout || !block || !validProgress(m.progress, block) || m.progress.mutationId !== m.id || m.progress.updatedAt !== m.createdAt) return failure("Progreso de bloque inválido", 400);
        const previous = workout.blockProgress[block.id];
        if (previous?.mutationId === m.id) return isDeepStrictEqual(previous, m.progress) ? ok() : failure("Este identificador de progreso ya contiene otros datos");
        if (previous && (previous.updatedAt > m.progress.updatedAt || previous.updatedAt === m.progress.updatedAt && previous.mutationId >= m.progress.mutationId)) return ok();
        if (workout.status !== "active") return failure("El entrenamiento ya no acepta cambios");
        await tx.update(workouts).set({ blockProgress: { ...workout.blockProgress, [block.id]: m.progress }, updatedAt: new Date() }).where(eq(workouts.id, workoutId));
        return ok();
      });
    }
    if (m.kind !== "addSet" && m.kind !== "deleteSet") return failure("Operación no soportada", 400);
    const setId = String(m.setId);
    if (!UUID.test(setId)) return failure("Serie inválida", 400);
    if (m.kind === "addSet" && (!UUID.test(String(m.workoutExerciseId)) || !validSet(m) ||
        !(m.rpe == null || (typeof m.rpe === "number" && Number.isFinite(m.rpe) && m.rpe >= 1 && m.rpe <= 10)))) return failure("Valores de serie inválidos", 400);
    return await db.transaction(async (tx) => {
      const [workout] = await tx.select().from(workouts)
        .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId))).limit(1).for("update");
      if (!workout) return failure("La sesión no está disponible");
      const [existing] = await tx.select().from(workoutSets).where(eq(workoutSets.id, setId)).limit(1);
      if (m.kind === "deleteSet") {
        if (!existing) return ok(); // Reintento de un borrado ya aplicado.
        if (workout.status !== "active") return failure("El entrenamiento ya no acepta cambios");
        const [exercise] = await tx.select({ id: workoutExercises.id }).from(workoutExercises)
          .where(and(eq(workoutExercises.id, existing.workoutExerciseId), eq(workoutExercises.workoutId, workoutId))).limit(1);
        if (!exercise) return failure("La serie no pertenece a esta sesión");
        await tx.delete(workoutSets).where(eq(workoutSets.id, setId));
        return ok();
      }
      if (existing) {
        // Una respuesta perdida se puede reintentar incluso tras finalizar en
        // otro dispositivo. Un ID reutilizado con otro contenido es conflicto.
        return existing.workoutExerciseId === m.workoutExerciseId && existing.reps === m.reps &&
          existing.loadType === (m.loadType ?? "external") && existing.durationSeconds === (m.durationSeconds ?? null) && existing.assistanceNote === (m.assistanceNote ?? null) &&
          Number(existing.weight) === Number(Number(m.weight).toFixed(2)) &&
          (existing.rpe === null ? null : Number(existing.rpe)) === (m.rpe == null ? null : Number(Number(m.rpe).toFixed(1)))
          ? ok() : failure("Este identificador de serie ya contiene otros datos");
      }
      if (workout.status !== "active") return failure("El entrenamiento ya no acepta series");
      const workoutExerciseId = String(m.workoutExerciseId);
      const [exercise] = await tx.select().from(workoutExercises)
        .where(and(eq(workoutExercises.id, workoutExerciseId), eq(workoutExercises.workoutId, workoutId))).limit(1);
      if (!exercise) return failure("El ejercicio no pertenece a la sesión");
      if (!matchesExercise(m as unknown as import("@/lib/training-metrics").SetMetrics, exercise)) return failure("La medición o carga no coincide con el ejercicio");
      const [last] = await tx.select({ value: sql<number>`coalesce(max(${workoutSets.position}), -1)` }).from(workoutSets)
        .where(eq(workoutSets.workoutExerciseId, workoutExerciseId));
      await tx.insert(workoutSets).values({
        id: setId, workoutExerciseId, position: Number(last?.value ?? -1) + 1,
        reps: Number(m.reps), weight: Number(m.weight).toFixed(2),
        durationSeconds: m.durationSeconds == null ? null : Number(m.durationSeconds), loadType: (m.loadType ?? "external") as import("@/lib/training-metrics").LoadType, assistanceNote: m.assistanceNote == null ? null : String(m.assistanceNote),
        rpe: m.rpe == null ? null : Number(m.rpe).toFixed(1), completedAt: new Date(Number(m.createdAt)),
      });
      return ok();
    });
  } catch (error) {
    console.error("Fallo al sincronizar el entrenamiento", error);
    return failure("Error del servidor", 500);
  }
}

async function startWorkout(userId: string, m: StartMutation) {
  return db.transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
    const [existing] = await tx.select().from(workouts).where(eq(workouts.id, m.workoutId)).limit(1);
    if (existing?.userId === userId && existing.status === "abandoned") return ok();
    if (existing) return existing.userId === userId && existing.trainingPlanId === m.planId && existing.weightUnit === m.weightUnit
      ? ok() : failure("Este identificador de sesión ya está en uso");
    const [active] = await tx.select({ id: workouts.id }).from(workouts)
      .where(and(eq(workouts.userId, userId), eq(workouts.status, "active"))).limit(1);
    if (active) return failure("Hay otra sesión activa en el servidor", 409, { code: "ACTIVE_WORKOUT", workoutId: active.id });
    // Una rutina archivada después de entrenar sigue siendo una referencia válida.
    const [plan] = await tx.select({ id: trainingPlans.id }).from(trainingPlans)
      .where(and(eq(trainingPlans.id, m.planId), eq(trainingPlans.userId, userId))).limit(1);
    if (!plan) return failure("El plan ya no está disponible", 409, { code: "PLAN_UNAVAILABLE" });
    const allowed = await tx.select({ id: exercises.id }).from(exercises)
      .where(and(inArray(exercises.id, m.exercises.map((exercise) => exercise.exerciseId)), or(isNull(exercises.userId), eq(exercises.userId, userId))));
    if (allowed.length !== m.exercises.length) return failure("Algún ejercicio ya no está disponible");
    const [usedId] = await tx.select({ id: workoutExercises.id }).from(workoutExercises)
      .where(inArray(workoutExercises.id, m.exercises.map((exercise) => exercise.workoutExerciseId))).limit(1);
    if (usedId) return failure("Un identificador de ejercicio ya está en uso");
    const [created] = await tx.insert(workouts).values({
      id: m.workoutId, userId, blocks: m.blocks ?? [], discipline: m.discipline ?? "strength", trainingPlanId: m.planId,
      weightUnit: m.weightUnit, performedAt: new Date(m.performedAt),
    }).onConflictDoNothing().returning({ id: workouts.id });
    if (!created) {
      const [concurrent] = await tx.select({ id: workouts.id }).from(workouts)
        .where(and(eq(workouts.userId, userId), eq(workouts.status, "active"))).limit(1);
      return failure("Otra sesión se inició mientras sincronizabas", 409,
        concurrent ? { code: "ACTIVE_WORKOUT", workoutId: concurrent.id } : {});
    }
    await tx.insert(workoutExercises).values(m.exercises.map((exercise) => ({
      id: exercise.workoutExerciseId, workoutId: m.workoutId, exerciseId: exercise.exerciseId,
      position: exercise.position, variation: exercise.variation ?? null, progressionSteps: exercise.progressionSteps ?? [], progressionStep: exercise.progressionStep ?? null, measurement: exercise.measurement ?? "reps", loadType: exercise.loadType ?? "external", targetSeconds: exercise.targetSeconds ?? null, targetSets: exercise.targetSets,
      targetRepsMin: exercise.targetRepsMin, targetRepsMax: exercise.targetRepsMax, notes: exercise.notes,
    })));
    return ok();
  });
}
