import { and, count, countDistinct, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/button-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  trainingPlans,
  workoutExercises,
  workouts,
  workoutSets,
} from "@/db/schema";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default async function HistoryPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const history = await db
    .select({
      id: workouts.id,
      performedAt: workouts.performedAt,
      weightUnit: workouts.weightUnit,
      planName: trainingPlans.name,
      exerciseCount: countDistinct(workoutExercises.id),
      setCount: count(workoutSets.id),
    })
    .from(workouts)
    .leftJoin(trainingPlans, eq(trainingPlans.id, workouts.trainingPlanId))
    .leftJoin(workoutExercises, eq(workoutExercises.workoutId, workouts.id))
    .leftJoin(
      workoutSets,
      eq(workoutSets.workoutExerciseId, workoutExercises.id),
    )
    .where(
      and(
        eq(workouts.userId, session.user.id),
        eq(workouts.status, "completed"),
      ),
    )
    .groupBy(workouts.id, trainingPlans.name)
    .orderBy(desc(workouts.performedAt));

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md md:max-w-3xl lg:max-w-5xl px-5 pb-12 pt-6">
      <AppHeader backHref="/" eyebrow="Tu progreso" title="Historial de entrenamientos" />

      {history.length > 0 ? (
        <section className="mt-8 grid gap-3 md:grid-cols-2">
          {history.map((workout, index) => (
            <Link key={workout.id} href={`/history/${workout.id}`} className="block">
              <Card className="flex-row items-start gap-4 p-5 transition hover:border-foreground/25">
                <Badge className="size-11 shrink-0 justify-center rounded-xl text-sm font-bold">
                  {String(history.length - index).padStart(2, "0")}
                </Badge>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold text-foreground">
                    {workout.planName ?? "Sesión libre"}
                  </h2>
                  <p className="mt-1 capitalize text-sm text-muted-foreground">
                    {formatDate(workout.performedAt)}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-muted-foreground">
                    {workout.exerciseCount} {workout.exerciseCount === 1 ? "ejercicio" : "ejercicios"}
                    {" · "}
                    {workout.setCount} {workout.setCount === 1 ? "serie" : "series"}
                  </p>
                </div>
                <ChevronRightIcon className="mt-2 size-4 shrink-0 text-muted-foreground" />
              </Card>
            </Link>
          ))}
        </section>
      ) : (
        <Card className="mt-10 border-dashed px-6 py-12 text-center">
          <CardHeader>
            <CardTitle>Aún no hay sesiones terminadas</CardTitle>
            <CardDescription>
              Cuando finalices un entrenamiento aparecerá aquí con todas sus series.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ButtonLink href="/">Volver al inicio</ButtonLink>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
