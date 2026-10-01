import { and, countDistinct, desc, eq, max } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import { exercises, workoutExercises, workouts, workoutSets } from "@/db/schema";
import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ProgressPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const summaries = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      muscleGroup: exercises.muscleGroup,
      workoutCount: countDistinct(workouts.id),
      bestWeight: max(workoutSets.weight),
      lastPerformedAt: max(workouts.performedAt),
    })
    .from(workoutSets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, workoutSets.workoutExerciseId))
    .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(and(eq(workouts.userId, session.user.id), eq(workouts.status, "completed")))
    .groupBy(exercises.id)
    .orderBy(desc(max(workouts.performedAt)));

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md md:max-w-3xl lg:max-w-5xl px-5 pb-12 pt-6">
      <AppHeader backHref="/" eyebrow="Marcas personales" title="Progreso por ejercicio" />

      {summaries.length > 0 ? (
        <section className="mt-8 grid gap-3 md:grid-cols-2">
          {summaries.map((exercise) => (
            <Link key={exercise.id} href={`/exercises/${exercise.id}`}>
              <Card className="flex-row items-center gap-4 p-4 transition hover:border-foreground/25">
                <Badge variant="secondary" className="size-12 shrink-0 justify-center rounded-xl text-xs font-black">
                  PR
                </Badge>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold text-foreground">{exercise.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{exercise.muscleGroup} · {exercise.workoutCount} {exercise.workoutCount === 1 ? "sesión" : "sesiones"}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-foreground">{Number(exercise.bestWeight)} kg</p>
                  <p className="mt-1 text-xs text-muted-foreground">máximo</p>
                </div>
              </Card>
            </Link>
          ))}
        </section>
      ) : (
        <Card className="mt-10 border-dashed px-6 py-12 text-center">
          <CardHeader>
            <CardTitle>Aún no hay progreso calculado</CardTitle>
            <CardDescription>
              Finaliza una sesión para comenzar a ver tus récords y evolución.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </main>
  );
}
