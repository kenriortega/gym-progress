import { and, asc, eq, isNull, or } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import { exercises, workoutExercises, workouts, workoutSets } from "@/db/schema";
import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ExerciseProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const [exercise] = await db
    .select({ id: exercises.id, name: exercises.name, muscleGroup: exercises.muscleGroup })
    .from(exercises)
    .where(and(eq(exercises.id, id), or(isNull(exercises.userId), eq(exercises.userId, session.user.id))))
    .limit(1);
  if (!exercise) notFound();

  const rows = await db
    .select({
      workoutId: workouts.id,
      performedAt: workouts.performedAt,
      weight: workoutSets.weight,
      reps: workoutSets.reps,
      position: workoutSets.position,
    })
    .from(workoutSets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, workoutSets.workoutExerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(and(eq(workoutExercises.exerciseId, exercise.id), eq(workouts.userId, session.user.id), eq(workouts.status, "completed")))
    .orderBy(asc(workouts.performedAt), asc(workoutSets.position));

  const sessions = new Map<string, { id: string; date: Date; sets: Array<{ weight: number; reps: number }>; maxWeight: number; volume: number }>();
  for (const row of rows) {
    const current = sessions.get(row.workoutId) ?? { id: row.workoutId, date: row.performedAt, sets: [], maxWeight: 0, volume: 0 };
    const weight = Number(row.weight);
    current.sets.push({ weight, reps: row.reps });
    current.maxWeight = Math.max(current.maxWeight, weight);
    current.volume += weight * row.reps;
    sessions.set(row.workoutId, current);
  }

  const sessionList = Array.from(sessions.values());
  const bestSet = rows.reduce<{ weight: number; reps: number } | null>((best, row) => {
    const candidate = { weight: Number(row.weight), reps: row.reps };
    return !best || candidate.weight > best.weight || (candidate.weight === best.weight && candidate.reps > best.reps) ? candidate : best;
  }, null);
  const maxChartWeight = Math.max(...sessionList.map((item) => item.maxWeight), 1);
  const bestVolume = Math.max(...sessionList.map((item) => item.volume), 0);
  const dateFormatter = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "2-digit" });

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md md:max-w-3xl lg:max-w-5xl px-5 pb-12 pt-6">
      <AppHeader backHref="/progress" eyebrow={exercise.muscleGroup} title={exercise.name} />

      {bestSet ? (
        <>
          <section className="mt-7 grid grid-cols-2 gap-3 md:gap-4">
            <Card className="gap-1 bg-primary p-4 text-primary-foreground">
              <p className="text-xs font-medium uppercase tracking-wider text-primary-foreground/75">Récord de peso</p>
              <p className="text-3xl font-bold tabular-nums">{bestSet.weight} kg</p>
              <p className="text-sm text-primary-foreground/75">× {bestSet.reps} reps</p>
            </Card>
            <Card className="gap-1 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Mejor volumen</p>
              <p className="text-3xl font-bold tabular-nums text-foreground">{Math.round(bestVolume)}</p>
              <p className="text-sm text-muted-foreground">kg por sesión</p>
            </Card>
          </section>

          <Card className="mt-6 p-5">
            <CardHeader className="flex-row items-end justify-between p-0">
              <div>
                <CardDescription>Peso máximo</CardDescription>
                <CardTitle className="mt-1 text-lg">Evolución</CardTitle>
              </div>
              <Badge variant="outline">
                {sessionList.length} {sessionList.length === 1 ? "sesión" : "sesiones"}
              </Badge>
            </CardHeader>
            <div className="mt-6 flex h-44 items-end gap-2 overflow-x-auto pb-1">
              {sessionList.map((item) => (
                <div key={item.id} className="flex min-w-12 flex-1 flex-col items-center justify-end gap-2">
                  <span className="text-[11px] font-bold text-muted-foreground">{item.maxWeight}</span>
                  <div className="w-full rounded-t-md bg-foreground" style={{ height: `${Math.max(10, (item.maxWeight / maxChartWeight) * 120)}px` }} />
                  <span className="whitespace-nowrap text-[10px] text-muted-foreground">{dateFormatter.format(item.date)}</span>
                </div>
              ))}
            </div>
          </Card>

          <section className="mt-6">
            <h2 className="text-lg font-semibold text-foreground">Sesiones</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {[...sessionList].reverse().map((item) => (
                <Link key={item.id} href={`/history/${item.id}`} className="block min-w-0">
                  <Card className="gap-2 p-4 transition hover:border-foreground/25">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold capitalize text-foreground">{dateFormatter.format(item.date)}</p>
                      <Badge variant="secondary">máx. {item.maxWeight} kg</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.sets.map((set) => `${set.weight}×${set.reps}`).join(" · ")}</p>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        </>
      ) : (
        <Card className="mt-10 border-dashed px-6 py-12 text-center">
          <CardHeader>
            <CardTitle>Sin series completadas</CardTitle>
            <CardDescription>
              Este ejercicio todavía no tiene entrenamientos terminados.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </main>
  );
}
