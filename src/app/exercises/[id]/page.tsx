import { getWeightPreferences } from "@/db/preferences";
import { WeightView, WeightValue, WeightSet } from "@/components/weight-view";
import { CalisthenicsProgress } from "@/components/calisthenics-progress";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import { weightInKgSql } from "@/db/weight";
import { exerciseMuscles, exercises, workoutExercises, workouts, workoutSets } from "@/db/schema";
import { AppHeader } from "@/components/app-header";
import { BodyMap } from "@/components/body-map";
import { ExerciseFigure } from "@/components/exercise-figure";
import { MuscleIcon } from "@/components/muscle-icon";
import { Badge } from "@/components/ui/badge";
import { hasFigure } from "@/lib/exercise-figures";
import { estimatedOneRepMax } from "@/lib/training-metrics";
import { ExerciseProgressChart, type ChartSession } from "@/components/exercise-progress-chart";
import { MUSCLE_LABELS, isMuscleRegion, weightOf, type MuscleRegion } from "@/lib/muscles";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ExerciseProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { trainingUnit } = await getWeightPreferences(session.user.id);
  const { id } = await params;
  const [exercise] = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      muscleGroup: exercises.muscleGroup,
      equipmentKey: exercises.equipmentKey,
    })
    .from(exercises)
    .where(and(eq(exercises.id, id), or(isNull(exercises.userId), eq(exercises.userId, session.user.id))))
    .limit(1);
  if (!exercise) notFound();

  const muscles = await db
    .select({ muscle: exerciseMuscles.muscle, role: exerciseMuscles.role })
    .from(exerciseMuscles)
    .where(eq(exerciseMuscles.exerciseId, exercise.id));
  const intensity: Partial<Record<MuscleRegion, number>> = {};
  for (const row of muscles) {
    if (isMuscleRegion(row.muscle)) intensity[row.muscle] = weightOf(row.role);
  }
  const primary = muscles.filter((row) => row.role === "primary");

  const rows = await db
    .select({
      workoutId: workouts.id,
      performedAt: workouts.performedAt,
      weight: weightInKgSql(workoutSets.weight, workouts.weightUnit),
      reps: workoutSets.reps,
      position: workoutSets.position,
    })
    .from(workoutSets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, workoutSets.workoutExerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(and(eq(workoutExercises.exerciseId, exercise.id), eq(workouts.userId, session.user.id), eq(workouts.status, "completed"), eq(workoutSets.loadType, "external"), isNull(workoutSets.durationSeconds), isNull(workoutExercises.variation)))
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
  const bestVolume = Math.max(...sessionList.map((item) => item.volume), 0);
  const bestOneRepMax = rows.reduce<number | null>((best, row) => {
    const estimate = estimatedOneRepMax({ weight: Number(row.weight), reps: row.reps });
    return estimate !== null && (best === null || estimate > best) ? estimate : best;
  }, null);
  const dateFormatter = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "2-digit" });


  // La gráfica vive en el cliente: el selector de métrica es estado, y las
  // fechas tienen que viajar como texto.
  const chartSessions: ChartSession[] = sessionList.map((item) => ({
    id: item.id,
    date: item.date.toISOString(),
    maxWeight: item.maxWeight,
    volume: item.volume,
    oneRepMax: item.sets.reduce<number | null>((best, set) => {
      const estimate = estimatedOneRepMax(set);
      return estimate !== null && (best === null || estimate > best) ? estimate : best;
    }, null),
  }));

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md md:max-w-3xl lg:max-w-5xl px-5 pb-12 pt-6">
      <AppHeader
        backHref="/progress"
        eyebrow={exercise.muscleGroup}
        title={exercise.name}
        icon={<MuscleIcon group={exercise.muscleGroup} className="h-12 w-auto text-foreground" />}
      />

      <WeightView defaultUnit={trainingUnit} storageKey={`${session.user.id}:detail:${id}`}>
      <CalisthenicsProgress userId={session.user.id} exerciseId={exercise.id} />
      {hasFigure(exercise.equipmentKey, exercise.name) ? (
        <Card className="mt-6 p-5">
          <CardHeader className="p-0">
            <CardDescription>El aparato</CardDescription>
            <CardTitle className="mt-1 text-lg">Cómo funciona</CardTitle>
          </CardHeader>
          <div className="mt-4">
            <ExerciseFigure equipmentKey={exercise.equipmentKey} name={exercise.name} />
          </div>
        </Card>
      ) : null}

      {muscles.length > 0 ? (
        <Card className="mt-6 p-5">
          <CardHeader className="p-0">
            <CardDescription>Qué mueve</CardDescription>
            <CardTitle className="mt-1 text-lg capitalize">
              {primary.map((row) => MUSCLE_LABELS[row.muscle as MuscleRegion]).join(" y ")}
            </CardTitle>
          </CardHeader>
          <BodyMap intensity={intensity} className="mx-auto mt-4 max-w-[15rem]" />
          <p className="mt-3 text-[11px] text-muted-foreground">
            En claro lo que hace el trabajo; en oscuro lo que ayuda.
          </p>
        </Card>
      ) : null}

      {bestSet ? (
        <>
          <section className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
            <Card className="gap-1 bg-primary p-4 text-primary-foreground">
              <p className="text-xs font-medium uppercase tracking-wider text-primary-foreground/75">Récord de peso</p>
              <p className="text-2xl sm:text-3xl font-bold tabular-nums"><WeightValue value={bestSet.weight} /></p>
              <p className="text-sm text-primary-foreground/75">× {bestSet.reps} reps</p>
            </Card>
            <Card className="gap-1 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">1RM estimado</p>
              <p className="text-2xl sm:text-3xl font-bold tabular-nums text-foreground">
                {bestOneRepMax !== null ? <WeightValue value={bestOneRepMax} /> : "—"}
              </p>
              <p className="text-sm text-muted-foreground">
                {bestOneRepMax !== null ? "tu mejor serie, llevada a una repetición" : "necesita una serie de 12 repeticiones o menos"}
              </p>
            </Card>
            <Card className="gap-1 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Mejor volumen</p>
              <p className="text-2xl sm:text-3xl font-bold tabular-nums text-foreground"><WeightValue value={bestVolume} /></p>
              <p className="text-sm text-muted-foreground">de carga acumulada en una sesión</p>
            </Card>
          </section>

          <Card className="mt-6 p-5">
            <CardHeader className="p-0">
              <CardDescription>Progreso</CardDescription>
              <CardTitle className="mt-1 text-lg">Evolución</CardTitle>
            </CardHeader>

            <ExerciseProgressChart sessions={chartSessions} />
          </Card>

          <section className="mt-6">
            <h2 className="text-lg font-semibold text-foreground">Sesiones</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {[...sessionList].reverse().map((item) => (
                <Link key={item.id} href={`/history/${item.id}`} className="block min-w-0">
                  <Card className="gap-2 p-4 transition hover:border-foreground/25">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold capitalize text-foreground">{dateFormatter.format(item.date)}</p>
                      <Badge variant="secondary">máx. <WeightValue value={item.maxWeight} /></Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.sets.map((set, index) => <span key={index}>{index > 0 ? " · " : ""}<WeightSet value={set} from="kg" /></span>)}</p>
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
      </WeightView>
    </main>
  );
}
