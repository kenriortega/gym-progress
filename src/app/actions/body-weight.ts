"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import { bodyWeights, users } from "@/db/schema";

/** Los extremos del check de la tabla, para fallar aquí con un mensaje legible. */
const MIN_KG = 20;
const MAX_KG = 500;

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session.user.id;
}

function parseWeight(value: FormDataEntryValue | null, field: string) {
  // Una báscula española escribe "78,4" y el input numérico del móvil lo deja pasar.
  const weight = Number(String(value ?? "").trim().replace(",", "."));

  if (!Number.isFinite(weight) || weight < MIN_KG || weight > MAX_KG) {
    throw new Error(`El ${field} debe estar entre ${MIN_KG} y ${MAX_KG} kg.`);
  }

  return weight.toFixed(2);
}

/** El día de hoy en la zona del navegador, que es la báscula que el usuario mira. */
function parseDay(value: FormDataEntryValue | null) {
  const day = String(value ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error("La fecha no es válida.");
  }

  return day;
}

export async function logBodyWeight(formData: FormData) {
  const userId = await requireUserId();
  const weight = parseWeight(formData.get("weight"), "peso");
  const measuredOn = parseDay(formData.get("measuredOn"));

  // Una pesada al día: la segunda del mismo día sustituye a la primera.
  await db
    .insert(bodyWeights)
    .values({ userId, weight, measuredOn })
    .onConflictDoUpdate({
      target: [bodyWeights.userId, bodyWeights.measuredOn],
      set: { weight, updatedAt: sql`now()` },
    });

  revalidatePath("/");
}

export async function updateGoalWeight(formData: FormData) {
  const userId = await requireUserId();
  const raw = String(formData.get("goalWeight") ?? "").trim();
  // Vaciar el campo quita el objetivo: la gráfica se queda sin línea de meta.
  const goalWeight = raw === "" ? null : parseWeight(raw, "objetivo");

  await db.update(users).set({ goalWeight, updatedAt: new Date() }).where(eq(users.id, userId));

  revalidatePath("/ajustes");
  revalidatePath("/");
}
