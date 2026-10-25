"use server";

import { randomUUID } from "node:crypto";
import { validBlocks, validDiscipline, type TrainingBlock, type BlockFormat } from "@/lib/training-blocks";
import { parseTargets } from "@/lib/training-metrics";

import { and, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { findTemplate } from "@/lib/plan-templates";
import { db } from "@/db";
import {
  exercises,
  planReschedules,
  trainingPlanExercises,
  trainingPlans,
} from "@/db/schema";
import { localDate } from "@/lib/dates";
import { nextOccurrence } from "@/lib/schedule";

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
  const discipline = String(formData.get("discipline") ?? "strength");
  if (!validDiscipline(discipline)) throw new Error("Disciplina inválida.");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const weekday = parseWeekday(formData.get("weekday"));

  if (name.length < 2 || name.length > 100) {
    throw new Error("El nombre del plan debe tener entre 2 y 100 caracteres.");
  }

  const [plan] = await db
    .insert(trainingPlans)
    .values({
      userId, discipline,
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
  const discipline = String(formData.get("discipline") ?? "strength");
  if (!validDiscipline(discipline)) throw new Error("Disciplina inválida.");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const weekday = parseWeekday(formData.get("weekday"));

  if (name.length < 2 || name.length > 100) {
    throw new Error("El nombre del plan debe tener entre 2 y 100 caracteres.");
  }

  await db
    .update(trainingPlans)
    .set({
      name, discipline,
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

/**
 * Resuelve el ejercicio del formulario: o viene elegido del catálogo, o viene
 * escrito a mano y hay que crearlo.
 *
 * Si ya existe uno con ese nombre —del sistema o tuyo— se reutiliza en vez de
 * duplicarlo: el índice único lo impediría de todas formas, y acabar con dos
 * "Press Smith" rompería el historial en dos mitades.
 */
async function resolverEjercicio(
  transaction: typeof db,
  userId: string,
  formData: FormData,
): Promise<string> {
  const idElegido = formData.get("exerciseId");
  if (typeof idElegido === "string" && idElegido !== "") {
    if (!UUID_PATTERN.test(idElegido)) {
      throw new Error("El ejercicio elegido no es válido.");
    }
    return idElegido;
  }

  const nombre = String(formData.get("exerciseName") ?? "").trim();
  const grupo = String(formData.get("muscleGroup") ?? "").trim();

  if (nombre.length < 2 || nombre.length > 100) {
    throw new Error("El nombre del ejercicio debe tener entre 2 y 100 caracteres.");
  }

  if (grupo.length < 2 || grupo.length > 60) {
    throw new Error("Elige un grupo muscular para el ejercicio.");
  }

  const [existente] = await transaction
    .select({ id: exercises.id })
    .from(exercises)
    .where(
      and(
        isNull(exercises.archivedAt),
        or(isNull(exercises.userId), eq(exercises.userId, userId)),
        sql`lower(${exercises.name}) = lower(${nombre})`,
      ),
    )
    .limit(1);

  if (existente) {
    return existente.id;
  }

  const [creado] = await transaction
    .insert(exercises)
    .values({ userId, name: nombre, muscleGroup: grupo })
    .returning({ id: exercises.id });

  return creado.id;
}

export async function addPlanExercise(formData: FormData) {
  const userId = await requireUserId();
  const planId = requiredUuid(formData, "planId");
  const { targetSets, targetRepsMin, targetRepsMax, measurement, loadType, targetSeconds, variation, progressionSteps, progressionStep } = parseTargets(formData);

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

    const exerciseId = await resolverEjercicio(
      transaction as unknown as typeof db,
      userId,
      formData,
    );

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
        measurement, loadType, targetSeconds, variation, progressionSteps, progressionStep,
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

  await db.transaction(async (tx) => {
    const [plan] = await tx.select().from(trainingPlans).where(and(eq(trainingPlans.id, planId), eq(trainingPlans.userId, userId))).limit(1).for("update");
    if (!plan) throw new Error("El plan no está disponible.");
    const removed = await tx.delete(trainingPlanExercises).where(and(eq(trainingPlanExercises.id, planExerciseId), eq(trainingPlanExercises.planId, planId))).returning({ exerciseId: trainingPlanExercises.exerciseId });
    if (removed.length) await tx.update(trainingPlans).set({ blocks: plan.blocks.map((block) => ({ ...block, exerciseIds: block.exerciseIds.filter((id) => id !== removed[0].exerciseId) })).filter((block) => block.exerciseIds.length > 0) }).where(eq(trainingPlans.id, planId));
  });

  revalidatePath("/");
  revalidatePath("/plans");
  revalidatePath(`/plans/${planId}`);
}

export async function updatePlanExercise(formData: FormData) {
  const userId = await requireUserId();
  const planId = requiredUuid(formData, "planId");
  const planExerciseId = requiredUuid(formData, "planExerciseId");
  const { targetSets, targetRepsMin, targetRepsMax, measurement, loadType, targetSeconds, variation, progressionSteps, progressionStep } = parseTargets(formData);

  await db
    .update(trainingPlanExercises)
    .set({ measurement, loadType, targetSeconds, variation, progressionSteps, progressionStep, targetSets, targetRepsMin, targetRepsMax, updatedAt: new Date() })
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
        name: copyName, discipline: source.discipline,
        description: source.description,
        blocks: source.blocks.map((block) => ({ ...block, id: randomUUID() })),
        weekday: null,
      })
      .returning({ id: trainingPlans.id });

    const exercisesToCopy = await transaction
      .select({
        exerciseId: trainingPlanExercises.exerciseId,
        position: trainingPlanExercises.position,
        variation: trainingPlanExercises.variation, progressionSteps: trainingPlanExercises.progressionSteps, progressionStep: trainingPlanExercises.progressionStep,
      measurement: trainingPlanExercises.measurement, loadType: trainingPlanExercises.loadType, targetSeconds: trainingPlanExercises.targetSeconds,
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

export async function unarchivePlan(formData: FormData) {
  const userId = await requireUserId();
  const planId = requiredUuid(formData, "planId");

  const [plan] = await db
    .select({ id: trainingPlans.id, name: trainingPlans.name })
    .from(trainingPlans)
    .where(
      and(
        eq(trainingPlans.id, planId),
        eq(trainingPlans.userId, userId),
        isNotNull(trainingPlans.archivedAt),
      ),
    )
    .limit(1);

  if (!plan) {
    throw new Error("Ese plan no está archivado o no es tuyo.");
  }

  // El nombre solo puede repetirse entre planes archivados: la restricción de
  // unicidad se aplica únicamente a los activos. Sin esta comprobación, la
  // restauración fallaría con un error de base de datos poco entendible.
  const [choque] = await db
    .select({ id: trainingPlans.id })
    .from(trainingPlans)
    .where(
      and(
        eq(trainingPlans.userId, userId),
        isNull(trainingPlans.archivedAt),
        sql`lower(${trainingPlans.name}) = lower(${plan.name})`,
      ),
    )
    .limit(1);

  if (choque) {
    throw new Error(
      `Ya tienes un plan activo llamado "${plan.name}". Renómbralo antes de restaurar este.`,
    );
  }

  await db
    .update(trainingPlans)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(and(eq(trainingPlans.id, planId), eq(trainingPlans.userId, userId)));

  revalidatePath("/");
  revalidatePath("/plans");
  redirect(`/plans/${planId}`);
}

export async function createPlanFromTemplate(formData: FormData) {
  const userId = await requireUserId();
  const templateId = String(formData.get("templateId") ?? "");
  const template = findTemplate(templateId);

  if (!template) {
    throw new Error("Esa plantilla no existe.");
  }

  // El nombre debe ser único entre los planes activos. Si ya usaste la
  // plantilla, se numera en vez de fallar.
  const existentes = await db
    .select({ name: trainingPlans.name })
    .from(trainingPlans)
    .where(
      and(eq(trainingPlans.userId, userId), isNull(trainingPlans.archivedAt)),
    );

  const usados = new Set(existentes.map((p) => p.name.toLowerCase()));
  let name = template.name;
  for (let n = 2; usados.has(name.toLowerCase()); n += 1) {
    name = `${template.name} ${n}`;
  }

  const planId = await db.transaction(async (transaction) => {
    const [plan] = await transaction
      .insert(trainingPlans)
      .values({
        userId,
        name,
        description: template.description, discipline: template.discipline ?? "strength",
        weekday: template.weekday,
      })
      .returning({ id: trainingPlans.id });

    // Los ejercicios se buscan por nombre en el catálogo. Si alguno no está,
    // se omite: un plan con un ejercicio menos sigue sirviendo.
    const catalogo = await transaction
      .select({ id: exercises.id, name: exercises.name })
      .from(exercises)
      .where(
        and(
          isNull(exercises.archivedAt),
          or(isNull(exercises.userId), eq(exercises.userId, userId)),
        ),
      );

    const porNombre = new Map(
      catalogo.map((e) => [e.name.toLowerCase(), e.id]),
    );

    // Las plantillas nuevas son completas: un movimiento ausente se crea en
    // el catálogo privado del usuario; nunca se publica un WOD incompleto.
    if (template.discipline) for (const exercise of template.exercises) {
      if (!porNombre.has(exercise.name.toLowerCase())) {
        const [created] = await transaction.insert(exercises).values({ userId, name: exercise.name, muscleGroup: exercise.muscleGroup ?? "Otros" }).returning({ id: exercises.id });
        porNombre.set(exercise.name.toLowerCase(), created.id);
      }
    }

    const filas = template.exercises
      .map((ejercicio, indice) => {
        const exerciseId = porNombre.get(ejercicio.name.toLowerCase());
        if (!exerciseId) return null;
        return {
          planId: plan.id,
          exerciseId,
          position: indice,
          measurement: ejercicio.measurement ?? "reps", loadType: ejercicio.loadType ?? "external", targetSeconds: ejercicio.targetSeconds ?? null,
          targetSets: ejercicio.sets,
          targetRepsMin: ejercicio.measurement === "time" ? null : ejercicio.repsMin,
          targetRepsMax: ejercicio.measurement === "time" ? null : ejercicio.repsMax,
        };
      })
      .filter((fila) => fila !== null)
      // Las posiciones deben ser consecutivas aunque se haya omitido alguno.
      .map((fila, indice) => ({ ...fila, position: indice }));

    if (filas.length > 0) {
      await transaction.insert(trainingPlanExercises).values(filas);
      if (template.block) await transaction.update(trainingPlans).set({ blocks: [{ ...template.block, id: randomUUID(), exerciseIds: filas.map((item) => item.exerciseId) }] }).where(eq(trainingPlans.id, plan.id));
    }

    return plan.id;
  });

  revalidatePath("/");
  revalidatePath("/plans");
  redirect(`/plans/${planId}`);
}

/**
 * Mueve la próxima sesión de un plan a otro día, sin tocar su día de la semana.
 * El origen no se pide: es la próxima vez que toca, porque mover "el martes"
 * significa mover el martes que viene y no todos los martes.
 */
export async function reschedulePlan(formData: FormData) {
  const userId = await requireUserId();
  const planId = requiredUuid(formData, "planId");
  const toDate = String(formData.get("toDate") ?? "").trim();
  const today = String(formData.get("today") ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(toDate) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    throw new Error("La fecha no es válida.");
  }

  const [plan] = await db
    .select({ id: trainingPlans.id, weekday: trainingPlans.weekday })
    .from(trainingPlans)
    .where(
      and(
        eq(trainingPlans.id, planId),
        eq(trainingPlans.userId, userId),
        isNull(trainingPlans.archivedAt),
      ),
    )
    .limit(1);

  if (!plan) {
    throw new Error("No tienes acceso a este plan.");
  }

  const fromDate = nextOccurrence(plan.weekday, localDate(today));

  if (fromDate === null) {
    throw new Error("Un plan sin día fijo no se mueve: ya puedes empezarlo cualquier día.");
  }

  if (fromDate === toDate) {
    throw new Error("Ese es el día que ya le toca.");
  }

  // Mover otra vez el mismo día sustituye al movimiento anterior.
  await db
    .insert(planReschedules)
    .values({ userId, planId, fromDate, toDate })
    .onConflictDoUpdate({
      target: [planReschedules.planId, planReschedules.fromDate],
      set: { toDate, updatedAt: new Date() },
    });

  revalidatePath("/plans");
  revalidatePath("/");
}

/** Devuelve la sesión a su día. */
export async function cancelReschedule(formData: FormData) {
  const userId = await requireUserId();
  const planId = requiredUuid(formData, "planId");
  const fromDate = String(formData.get("fromDate") ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
    throw new Error("La fecha no es válida.");
  }

  await db
    .delete(planReschedules)
    .where(
      and(
        eq(planReschedules.userId, userId),
        eq(planReschedules.planId, planId),
        eq(planReschedules.fromDate, fromDate),
      ),
    );

  revalidatePath("/plans");
  revalidatePath("/");
}

export async function savePlanBlock(form: FormData) {
  const userId = await requireUserId();
  const planId = requiredUuid(form, "planId");
  const existingId = form.get("blockId") ? requiredUuid(form, "blockId") : null;
  const format = String(form.get("format")) as BlockFormat;
  const block: TrainingBlock = {
    id: existingId ?? randomUUID(), name: String(form.get("name") ?? "").trim(), prescription: String(form.get("prescription") ?? "").trim() || null, format,
    exerciseIds: form.getAll("exerciseIds").map(String),
    rounds: format === "circuit" || format === "for-time" ? Number(form.get("rounds")) : null,
    durationSeconds: format === "amrap" || format === "emom" ? Number(form.get("durationSeconds")) : null,
    intervalSeconds: format === "emom" ? Number(form.get("intervalSeconds")) : null,
    timeCapSeconds: format === "for-time" && form.get("timeCapSeconds") ? Number(form.get("timeCapSeconds")) : null,
  };
  await db.transaction(async (tx) => {
    const [plan] = await tx.select().from(trainingPlans).where(and(eq(trainingPlans.id, planId), eq(trainingPlans.userId, userId), isNull(trainingPlans.archivedAt))).limit(1).for("update");
    if (!plan || existingId && !plan.blocks.some((item) => item.id === existingId)) throw new Error("El bloque no está disponible.");
    const rows = await tx.select({ id: trainingPlanExercises.exerciseId }).from(trainingPlanExercises).where(eq(trainingPlanExercises.planId, planId)).orderBy(trainingPlanExercises.position);
    block.exerciseIds = rows.map((item) => item.id).filter((id) => block.exerciseIds.includes(id));
    const blocks = existingId ? plan.blocks.map((item) => item.id === existingId ? block : item) : [...plan.blocks, block];
    if (!validBlocks(blocks, rows.map((item) => item.id))) throw new Error("Revisa el bloque: selecciona ejercicios disponibles sin repetirlos entre bloques y configura sus rondas o duración. En EMOM, la duración debe ser múltiplo del intervalo.");
    await tx.update(trainingPlans).set({ blocks, updatedAt: new Date() }).where(eq(trainingPlans.id, planId));
  });
  revalidatePath(`/plans/${planId}`); revalidatePath("/");
}

export async function changePlanBlock(form: FormData) {
  const userId = await requireUserId();
  const planId = requiredUuid(form, "planId"), blockId = requiredUuid(form, "blockId");
  const direction = form.get("direction");
  await db.transaction(async (tx) => {
    const [plan] = await tx.select().from(trainingPlans).where(and(eq(trainingPlans.id, planId), eq(trainingPlans.userId, userId), isNull(trainingPlans.archivedAt))).limit(1).for("update");
    if (!plan) throw new Error("El plan no está disponible.");
    const blocks = [...plan.blocks]; const index = blocks.findIndex((item) => item.id === blockId);
    if (index < 0) throw new Error("El bloque no está disponible.");
    if (direction === "remove") blocks.splice(index, 1);
    else if (direction === "up" || direction === "down") {
      const next = index + (direction === "up" ? -1 : 1);
      if (next >= 0 && next < blocks.length) [blocks[index], blocks[next]] = [blocks[next], blocks[index]];
    } else throw new Error("Acción de bloque inválida.");
    await tx.update(trainingPlans).set({ blocks, updatedAt: new Date() }).where(eq(trainingPlans.id, planId));
  });
  revalidatePath(`/plans/${planId}`); revalidatePath("/");
}
