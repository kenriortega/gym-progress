import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/db";
import { workoutExercises, workoutSets, workouts } from "@/db/schema";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Recibe una operación de la cola del móvil. Es idempotente: reenviar la misma
 * serie no la duplica, porque el id viene del cliente y el insert ignora el
 * conflicto.
 *
 * Códigos: 200 aceptada, 4xx rechazada para siempre (la cola la descarta),
 * 5xx fallo temporal (la cola reintenta).
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }
  const userId = session.user.id;

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const m = cuerpo as Record<string, unknown>;

  if (m?.kind !== "addSet") {
    return NextResponse.json({ error: "Operación no soportada" }, { status: 400 });
  }

  const workoutId = String(m.workoutId ?? "");
  const workoutExerciseId = String(m.workoutExerciseId ?? "");
  const setId = String(m.setId ?? "");
  const reps = Number(m.reps);
  const weight = Number(m.weight);

  if (!UUID.test(workoutId) || !UUID.test(workoutExerciseId) || !UUID.test(setId)) {
    return NextResponse.json({ error: "Identificadores inválidos" }, { status: 400 });
  }

  if (!Number.isInteger(reps) || reps < 1 || reps > 1000) {
    return NextResponse.json({ error: "Repeticiones inválidas" }, { status: 400 });
  }

  if (!Number.isFinite(weight) || weight < 0 || weight > 99999) {
    return NextResponse.json({ error: "Peso inválido" }, { status: 400 });
  }

  try {
    const aceptada = await db.transaction(async (tx) => {
      const [propio] = await tx
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

      if (!propio) {
        return false;
      }

      const [ultima] = await tx
        .select({ value: sql<number>`coalesce(max(${workoutSets.position}), -1)` })
        .from(workoutSets)
        .where(eq(workoutSets.workoutExerciseId, workoutExerciseId));

      await tx
        .insert(workoutSets)
        .values({
          id: setId,
          workoutExerciseId,
          position: Number(ultima?.value ?? -1) + 1,
          reps,
          weight: weight.toFixed(2),
          completedAt: new Date(),
        })
        .onConflictDoNothing({ target: workoutSets.id });

      return true;
    });

    if (!aceptada) {
      // La sesión ya no está activa o no es suya: no tiene sentido reintentar.
      return NextResponse.json(
        { error: "El entrenamiento ya no acepta series" },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Fallo al sincronizar una serie", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
