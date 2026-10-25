import { OfflineSyncStatus } from "@/components/offline-sync-status";
import { OfflinePlansStatus } from "@/components/offline-plans-status";
import { and, asc, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { redirect } from "next/navigation";

import { StartWorkoutButton } from "@/components/start-workout-button";
import { auth } from "@/auth";
import { db } from "@/db";
import { AppHeader } from "@/components/app-header";
import { dayOf, localDate } from "@/lib/dates";
import { plansOn } from "@/lib/schedule";
import { greetingName } from "@/lib/display-name";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/button-link";
import { ChangelogDialog } from "@/components/changelog-dialog";
import { ActivityHeatmap } from "@/components/activity-heatmap";
import { BodyWeightCard } from "@/components/body-weight-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  bodyWeights,
  exercises,
  trainingPlanExercises,
  trainingPlans,
  workoutExercises,
  workouts,
  workoutSets,
  users,
  planReschedules,
} from "@/db/schema";

const weekdays = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

function relativeDate(date: Date) {
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);

  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  return `Hace ${days} días`;
}

export default async function Home() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;
  const displayName = session.user.name ?? session.user.email ?? "Atleta";

  const [activeWorkout] = await db
    .select({
      id: workouts.id,
      planName: trainingPlans.name,
      performedAt: workouts.performedAt,
    })
    .from(workouts)
    .leftJoin(trainingPlans, eq(trainingPlans.id, workouts.trainingPlanId))
    .where(
      and(eq(workouts.userId, session.user.id), eq(workouts.status, "active")),
    )
    .limit(1);

  const plans = await db
    .select({
      id: trainingPlans.id,
      name: trainingPlans.name,
      description: trainingPlans.description,
      weekday: trainingPlans.weekday,
      exerciseCount: count(trainingPlanExercises.id),
    })
    .from(trainingPlans)
    .leftJoin(
      trainingPlanExercises,
      eq(trainingPlanExercises.planId, trainingPlans.id),
    )
    .where(
      and(
        eq(trainingPlans.userId, session.user.id),
        isNull(trainingPlans.archivedAt),
      ),
    )
    .groupBy(trainingPlans.id)
    .orderBy(asc(trainingPlans.weekday), asc(trainingPlans.name));

  const reschedules = await db
    .select({
      planId: planReschedules.planId,
      fromDate: planReschedules.fromDate,
      toDate: planReschedules.toDate,
    })
    .from(planReschedules)
    .where(
      and(
        eq(planReschedules.userId, session.user.id),
        gte(planReschedules.toDate, sql`current_date`),
      ),
    );

  // "Qué toca hoy" ya no sale solo del día de la semana: un plan movido fuera
  // de hoy no cuenta, y uno movido a hoy sí aunque no le tocara.
  const today = dayOf(new Date());
  const todaysPlans = plansOn(plans, reschedules, today);
  const todayPlan = todaysPlans[0]?.plan ?? null;
  const todayMovedFrom = todaysPlans[0]?.movedFrom ?? null;
  const alsoToday = todaysPlans.slice(1);

  // Una sesión abierta de otro día es casi siempre un olvido, no algo que
  // quieras continuar. Hasta ahora secuestraba Inicio: el botón decía
  // "Continuar entreno" y no había forma de empezar el plan de hoy.
  const staleWorkout =
    activeWorkout && dayOf(activeWorkout.performedAt) !== dayOf(new Date())
      ? activeWorkout
      : null;

  // Las 90 últimas pesadas, de la más antigua a la más reciente, que es como
  // las dibuja la gráfica. Con una al día son tres meses de serie.
  const weighInRows = await db
    .select({ measuredOn: bodyWeights.measuredOn, weight: bodyWeights.weight })
    .from(bodyWeights)
    .where(eq(bodyWeights.userId, session.user.id))
    .orderBy(desc(bodyWeights.measuredOn))
    .limit(90);
  const weighIns = weighInRows
    .map((row) => ({ measuredOn: row.measuredOn, weight: Number(row.weight) }))
    .reverse();

  const [profile] = await db
    .select({ goalWeight: users.goalWeight })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const goalWeight = profile?.goalWeight ? Number(profile.goalWeight) : null;

  // Volumen movido por día del último año. El día sale de la fecha del
  // entreno en la zona del servidor, igual que el resto de fechas de la app.
  const trainedRows = await db
    .select({
      day: sql<string>`to_char(${workouts.performedAt}, 'YYYY-MM-DD')`,
      volume: sql<string>`coalesce(sum(${workoutSets.weight} * ${workoutSets.reps}), 0)`,
    })
    .from(workouts)
    .innerJoin(workoutExercises, eq(workoutExercises.workoutId, workouts.id))
    .innerJoin(workoutSets, eq(workoutSets.workoutExerciseId, workoutExercises.id))
    .where(
      and(
        eq(workouts.userId, session.user.id),
        eq(workouts.status, "completed"),
        sql`${workouts.performedAt} >= now() - interval '53 weeks'`,
      ),
    )
    .groupBy(sql`to_char(${workouts.performedAt}, 'YYYY-MM-DD')`);
  const trained = trainedRows.map((row) => ({ day: row.day, volume: Number(row.volume) }));

  const [lastWorkout] = await db
    .select({
      id: workouts.id,
      performedAt: workouts.performedAt,
      weightUnit: workouts.weightUnit,
    })
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, session.user.id),
        eq(workouts.status, "completed"),
      ),
    )
    .orderBy(desc(workouts.performedAt))
    .limit(1);

  const lastRows = lastWorkout
    ? await db
        .select({
          workoutExerciseId: workoutExercises.id,
          exerciseId: exercises.id,
          name: exercises.name,
          position: workoutExercises.position,
          setPosition: workoutSets.position,
          weight: workoutSets.weight,
        })
        .from(workoutExercises)
        .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
        .leftJoin(
          workoutSets,
          eq(workoutSets.workoutExerciseId, workoutExercises.id),
        )
        .where(eq(workoutExercises.workoutId, lastWorkout.id))
        .orderBy(asc(workoutExercises.position), asc(workoutSets.position))
    : [];

  const exerciseSummary = Array.from(
    lastRows
      .reduce(
        (summary, row) => {
          const current = summary.get(row.workoutExerciseId) ?? {
            id: row.workoutExerciseId,
            exerciseId: row.exerciseId,
            name: row.name,
            position: row.position,
            sets: 0,
            maxWeight: 0,
          };

          if (row.setPosition !== null) {
            current.sets += 1;
            current.maxWeight = Math.max(current.maxWeight, Number(row.weight));
          }

          summary.set(row.workoutExerciseId, current);
          return summary;
        },
        new Map<
          string,
          {
            id: string;
            /** El del catálogo, para enlazar a su ficha. No el de esta sesión. */
            exerciseId: string;
            name: string;
            position: number;
            sets: number;
            maxWeight: number;
          }
        >(),
      )
      .values(),
  ).sort((a, b) => a.position - b.position);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md md:max-w-3xl lg:max-w-5xl flex-col px-5 pb-10 pt-6">
      <ChangelogDialog />

      <AppHeader
        eyebrow="Tu progreso, serie a serie"
        title={`Hola, ${greetingName(displayName)}`}
      />
      <OfflinePlansStatus userId={userId} />
      <OfflineSyncStatus userId={userId} />

      <Card className="mt-8 gap-0 overflow-hidden bg-primary p-6 text-primary-foreground">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary-foreground/75">
          {activeWorkout
            ? "Sesión en curso"
            : todayPlan
              ? `Plan de ${weekdays[todayPlan.weekday!]}`
              : "Tu entrenamiento"}
        </p>
        <h2 className="mt-3 max-w-[12ch] text-4xl font-black leading-[0.95] tracking-[-0.05em] md:max-w-[16ch] md:text-5xl lg:text-6xl">
          {activeWorkout
            ? (activeWorkout.planName ?? "Sigue donde lo dejaste.")
            : todayPlan
              ? todayPlan.name
              : plans.length > 0
                ? "Elige tu plan de hoy."
                : "Organiza tu semana."}
        </h2>
        <p className="mt-4 max-w-xs text-sm font-medium leading-6 text-primary-foreground/75 md:max-w-lg md:text-base md:leading-7">
          {staleWorkout
            ? `Dejaste esta sesión abierta ${relativeDate(staleWorkout.performedAt).toLowerCase()}. Mientras siga así no puedes empezar otra.`
            : activeWorkout
              ? "Tus series están guardadas. Continúa desde el siguiente ejercicio."
              : todayPlan
                ? `${todayPlan.exerciseCount} ${todayPlan.exerciseCount === 1 ? "ejercicio preparado" : "ejercicios preparados"} para registrar tu progreso.${
                    todayMovedFrom
                      ? ` Lo moviste desde el ${weekdays[localDate(todayMovedFrom).getDay()].toLowerCase()}.`
                      : ""
                  }${alsoToday.length > 0 ? ` Hoy tienes también ${alsoToday.map((item) => item.plan.name).join(" y ")}.` : ""}`
                : plans.length > 0
                  ? "Puedes comenzar cualquiera de tus planes desde la lista de abajo."
                  : "Crea un plan por día con tus ejercicios, series y repeticiones objetivo."}
        </p>
        {activeWorkout ? (
          <div className="mt-7 grid gap-2">
            {staleWorkout && todayPlan ? (
              <ButtonLink href={`/workout/${activeWorkout.id}`} className="h-14 w-full rounded-2xl bg-background text-base font-semibold text-foreground hover:bg-background/90">
                Resolver la sesión pendiente
              </ButtonLink>
            ) : null}
            <ButtonLink
              href="/entreno"
              size="lg"
              className={
                staleWorkout && todayPlan
                  ? "h-12 w-full rounded-2xl border border-primary-foreground/25 bg-transparent text-base font-semibold text-primary-foreground hover:bg-primary-foreground/10"
                  : "h-14 w-full rounded-2xl bg-background text-base font-semibold text-foreground hover:bg-background/90"
              }
            >
              Continuar entreno
            </ButtonLink>
            <ButtonLink
              href={`/workout/${activeWorkout.id}`}
              variant="ghost"
              className="h-10 w-full text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              Ajustes de la sesión
            </ButtonLink>
          </div>
        ) : todayPlan ? (
          <StartWorkoutButton userId={userId} planId={todayPlan.id}
            size="lg" disabled={todayPlan.exerciseCount === 0}
            className="mt-7 h-14 w-full rounded-2xl bg-background text-base font-semibold text-foreground hover:bg-background/90">
            Empezar {todayPlan.name}
          </StartWorkoutButton>
        ) : (
          <ButtonLink
            href={plans.length > 0 ? "#planes" : "/plans"}
            size="lg"
            className="mt-7 h-14 w-full rounded-2xl bg-background text-base font-semibold text-foreground hover:bg-background/90"
          >
            {plans.length > 0 ? "Elegir un plan" : "Crear mi primer plan"}
          </ButtonLink>
        )}
      </Card>

      <BodyWeightCard history={weighIns} goal={goalWeight} />

      {/*
        Solo con historial. El componente dibuja la rejilla vacía con un texto
        de bienvenida, que en Progreso está bien porque entraste a ver progreso,
        pero en portada le ocupa media pantalla a quien acaba de instalar la app
        para no decirle nada.
      */}
      {trained.length > 0 ? <ActivityHeatmap trained={trained} /> : null}

      <section id="planes" className="mt-8 scroll-mt-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Tu semana
            </p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight text-foreground">
              Planes de entrenamiento
            </h2>
          </div>
          <Link href="/plans" className="text-sm font-bold text-primary">
            Gestionar
          </Link>
        </div>

        {plans.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`p-4 ${
                  plan.id === todayPlan?.id
                    ? "border-foreground/30 bg-muted/40"
                    : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <Badge
                    variant="secondary"
                    className="size-11 shrink-0 justify-center rounded-xl text-xs font-bold uppercase"
                  >
                    {plan.weekday === null
                      ? "Libre"
                      : weekdays[plan.weekday].slice(0, 3)}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-foreground">
                      {plan.name}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {plan.exerciseCount}{" "}
                      {plan.exerciseCount === 1 ? "ejercicio" : "ejercicios"}
                    </p>
                  </div>
                  {!activeWorkout && plan.exerciseCount > 0 ? (
                    <StartWorkoutButton userId={userId} planId={plan.id} size="sm">Iniciar</StartWorkoutButton>
                  ) : (
                    <ButtonLink
                      href={`/plans/${plan.id}`}
                      variant="ghost"
                      size="icon"
                      aria-label={`Editar ${plan.name}`}
                    >
                      <ChevronRightIcon className="size-4" />
                    </ButtonLink>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="mt-4 border-dashed px-5 py-7 text-center">
            <CardHeader>
              <CardTitle className="text-base">
                Aún no tienes ningún plan
              </CardTitle>
              <CardDescription>
                Puedes crear uno desde cero o copiar uno ya hecho y ajustarlo.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap justify-center gap-2">
              <ButtonLink href="/plans">Ver planes de ejemplo</ButtonLink>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Tu referencia rápida
            </p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight text-foreground">
              Último entrenamiento
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {lastWorkout && (
              <Badge variant="secondary">
                {relativeDate(lastWorkout.performedAt)}
              </Badge>
            )}
            <Link
              href="/history"
              className="text-sm font-bold text-muted-foreground transition hover:text-foreground"
            >
              Ver historial
            </Link>
          </div>
        </div>

        {exerciseSummary.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {exerciseSummary.map((exercise, index) => (
              <Card
                key={exercise.id}
                className="flex-row items-center gap-4 p-4"
              >
                <Badge
                  variant="secondary"
                  className="size-11 shrink-0 justify-center rounded-xl font-bold"
                >
                  {String(index + 1).padStart(2, "0")}
                </Badge>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/exercises/${exercise.exerciseId}`}
                    className="block truncate font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline"
                  >
                    {exercise.name}
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {exercise.sets} {exercise.sets === 1 ? "serie" : "series"}
                    {exercise.sets > 0 && lastWorkout
                      ? ` · hasta ${exercise.maxWeight} ${lastWorkout.weightUnit}`
                      : ""}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-border px-5 py-8 text-center">
            <p className="font-bold text-muted-foreground">
              Aún no hay entrenamientos terminados
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Tu primera sesión aparecerá aquí como referencia para la
              siguiente.
            </p>
          </div>
        )}
      </section>

      <footer className="mt-auto pt-10 text-center text-xs leading-5 text-muted-foreground">
        Tu progreso se guarda automáticamente después de cada serie
      </footer>
    </main>
  );
}
