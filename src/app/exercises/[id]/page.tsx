import { and, asc, eq, isNull, or } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import { exercises, workoutExercises, workouts, workoutSets } from "@/db/schema";
import { AppHeader } from "@/components/app-header";
import { ExerciseFigure } from "@/components/exercise-figure";
import { MuscleIcon } from "@/components/muscle-icon";
import { Badge } from "@/components/ui/badge";
import { hasFigure } from "@/lib/exercise-figures";
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
  const bestVolume = Math.max(...sessionList.map((item) => item.volume), 0);
  const dateFormatter = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "2-digit" });
  const timeFormatter = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" });
  const chartDayFormatter = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });

  /** Pesos con un decimal como mucho: "50.99" no dice nada que no diga "51". */
  const kg = (value: number) => value.toFixed(1).replace(/\.0$/, "");

  // Dos entrenamientos del mismo día daban dos barras con la etiqueta idéntica,
  // porque las sesiones se agrupan por entrenamiento y no por fecha.
  const perDay = new Map<string, number>();
  for (const item of sessionList) {
    const day = dateFormatter.format(item.date);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  // Bajo una barra de 64 px no cabe "29 sept 26 · 19:30": sin año, y solo la hora
  // cuando ese día tiene más de una sesión. La lista de abajo conserva la fecha entera.
  const labelOf = (date: Date) => {
    const day = dateFormatter.format(date);
    return (perDay.get(day) ?? 0) > 1 ? timeFormatter.format(date) : chartDayFormatter.format(date);
  };

  // El eje no arranca en cero a propósito. El rango útil de una serie de fuerza
  // es estrecho, y desde cero una subida de 2.5 kg son dos píxeles: justo la
  // señal que la gráfica existe para mostrar. El pie del gráfico lo advierte.
  const weights = sessionList.map((item) => item.maxWeight);
  const topWeight = Math.max(...weights, 1);
  const spread = topWeight - Math.min(...weights, topWeight);
  const chartFloor = topWeight - spread * 1.5;
  const BAR_MIN = 26;
  const BAR_MAX = 132;
  // Sin variación todas van a media altura: al tope leerían como un buen resultado,
  // y lo que dicen es que llevas tres sesiones con el mismo peso.
  const barHeight = (weight: number) =>
    spread > 0
      ? BAR_MIN + ((weight - chartFloor) / (topWeight - chartFloor)) * (BAR_MAX - BAR_MIN)
      : (BAR_MIN + BAR_MAX) / 2;

  // Dos barras no son una tendencia: con pocas sesiones el dato directo dice más.
  const latest = sessionList.at(-1) ?? null;
  const previous = sessionList.at(-2) ?? null;
  const change = latest && previous ? latest.maxWeight - previous.maxWeight : null;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md md:max-w-3xl lg:max-w-5xl px-5 pb-12 pt-6">
      <AppHeader
        backHref="/progress"
        eyebrow={exercise.muscleGroup}
        title={exercise.name}
        icon={<MuscleIcon group={exercise.muscleGroup} className="h-12 w-auto text-foreground" />}
      />

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

      {bestSet ? (
        <>
          <section className="mt-7 grid grid-cols-2 gap-3 md:gap-4">
            <Card className="gap-1 bg-primary p-4 text-primary-foreground">
              <p className="text-xs font-medium uppercase tracking-wider text-primary-foreground/75">Récord de peso</p>
              <p className="text-3xl font-bold tabular-nums">{kg(bestSet.weight)} kg</p>
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

            {sessionList.length >= 3 ? (
              <>
                <div className="mt-6 flex h-52 items-end gap-2 overflow-x-auto pb-1">
                  {sessionList.map((item) => (
                    <div key={item.id} className="flex min-w-12 max-w-16 flex-1 flex-col items-center justify-end gap-2">
                      <span className="text-[11px] font-bold tabular-nums text-muted-foreground">{kg(item.maxWeight)}</span>
                      <div className="w-full rounded-t-md bg-foreground" style={{ height: `${barHeight(item.maxWeight)}px` }} />
                      <span className="whitespace-nowrap text-[10px] text-muted-foreground">{labelOf(item.date)}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  La más antigua a la izquierda. El eje no empieza en cero, para que se note el
                  cambio de una sesión a otra.
                </p>
              </>
            ) : (
              <div className="mt-5">
                {change !== null && latest && previous ? (
                  <>
                    <p className="text-3xl font-bold tabular-nums text-foreground">
                      {change > 0 ? "+" : ""}
                      {kg(change)} kg
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      desde la sesión anterior · {kg(previous.maxWeight)} → {kg(latest.maxWeight)} kg
                    </p>
                  </>
                ) : latest ? (
                  <>
                    <p className="text-3xl font-bold tabular-nums text-foreground">{kg(latest.maxWeight)} kg</p>
                    <p className="mt-1 text-sm text-muted-foreground">en tu primera sesión registrada</p>
                  </>
                ) : null}
                <p className="mt-4 text-[11px] text-muted-foreground">
                  A partir de la tercera sesión aquí sale la gráfica.
                </p>
              </div>
            )}
          </Card>

          <section className="mt-6">
            <h2 className="text-lg font-semibold text-foreground">Sesiones</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {[...sessionList].reverse().map((item) => (
                <Link key={item.id} href={`/history/${item.id}`} className="block min-w-0">
                  <Card className="gap-2 p-4 transition hover:border-foreground/25">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold capitalize text-foreground">{dateFormatter.format(item.date)}</p>
                      <Badge variant="secondary">máx. {kg(item.maxWeight)} kg</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.sets.map((set) => `${kg(set.weight)}×${set.reps}`).join(" · ")}</p>
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
