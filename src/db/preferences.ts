import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function getWeightPreferences(userId: string) {
  const [profile] = await db.select({ trainingUnit: users.preferredWeightUnit, bodySystem: users.preferredBodySystem })
    .from(users).where(eq(users.id, userId)).limit(1);
  return profile ?? { trainingUnit: "kg" as const, bodySystem: "metric" as const };
}
