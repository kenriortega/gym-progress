"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session.user.id;
}

export async function updateWeightUnit(formData: FormData) {
  const userId = await requireUserId();
  const unit = String(formData.get("weightUnit") ?? "");

  if (unit !== "kg" && unit !== "lb") {
    throw new Error("La unidad debe ser kg o lb.");
  }

  await db
    .update(users)
    .set({ preferredWeightUnit: unit, updatedAt: new Date() })
    .where(eq(users.id, userId));

  // Los entrenamientos ya guardados conservan la unidad con la que se
  // registraron: cambiar la preferencia no reescribe el historial.
  revalidatePath("/ajustes");
  revalidatePath("/");
}
