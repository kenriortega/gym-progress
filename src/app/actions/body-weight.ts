"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import { convertWeight, formatWeight, type WeightUnit } from "@/lib/weight-units";
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

function parseWeight(value: FormDataEntryValue | null, field: string, unit: WeightUnit) {
  // Una báscula española escribe "78,4" y el input numérico del móvil lo deja pasar.
  const weight = convertWeight(Number(String(value ?? "").trim().replace(",", ".")), unit, "kg");

  // La tabla corporal guarda centésimas de kg: validar esa precisión también
  // permite volver a guardar sus límites convertidos (20 kg → 44,09 lb).
  const storedWeight = Number(weight.toFixed(2));
  if (!Number.isFinite(storedWeight) || storedWeight < MIN_KG || storedWeight > MAX_KG) {
    throw new Error(`El ${field} debe estar entre ${formatWeight(convertWeight(MIN_KG, "kg", unit))} y ${formatWeight(convertWeight(MAX_KG, "kg", unit))} ${unit}.`);
  }

  return storedWeight.toFixed(2);
}

function inputUnit(formData: FormData): WeightUnit {
  const unit = formData.get("unit") ?? "kg";
  if (unit !== "kg" && unit !== "lb") throw new Error("La unidad debe ser kg o lb.");
  return unit;
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
  const weight = parseWeight(formData.get("weight"), "peso", inputUnit(formData));
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
  const goalWeight = raw === "" ? null : parseWeight(raw, "objetivo", inputUnit(formData));

  await db.update(users).set({ goalWeight, updatedAt: new Date() }).where(eq(users.id, userId));

  revalidatePath("/ajustes");
  revalidatePath("/");
}
