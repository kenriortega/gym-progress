import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { workouts } from "@/db/schema";

/** Verificación de solo lectura para recuperar la cola anterior sin propietario. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  const ids = (body as { workoutIds?: unknown })?.workoutIds;
  if (!Array.isArray(ids) || ids.length > 200 || !ids.every((id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
    return NextResponse.json({ error: "Identificadores inválidos" }, { status: 400 });
  }
  const userId = session.user.id;
  const owned = ids.length === 0 ? [] : await db.select({ id: workouts.id }).from(workouts)
    .where(and(eq(workouts.userId, userId), inArray(workouts.id, ids)));
  return NextResponse.json({ userId, workoutIds: owned.map((row) => row.id) }, { headers: { "Cache-Control": "private, no-store" } });
}
