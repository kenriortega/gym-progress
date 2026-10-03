import { and, asc, count, desc, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { redirect } from "next/navigation";

import { startWorkout } from "@/app/actions/workouts";
import { auth } from "@/auth";
import { db } from "@/db";
import { AppHeader } from "@/components/app-header";
import { greetingName } from "@/lib/display-name";
import { PendingButton } from "@/components/pending-button";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/button-link";
import { ChangelogDialog } from "@/components/changelog-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  exercises,
  trainingPlanExercises,
  trainingPlans,
  workoutExercises,
  workouts,
  workoutSets,
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

  const displayName = session.user.name ?? session.user.email ?? "Atleta";

  const [activeWorkout] = await db
    .select({
      id: workouts.id,
      planName: trainingPlans.name,
    })
    .from(workouts)
    .leftJoin(trainingPlans, eq(trainingPlans.id, workouts.trainingPlanId))
    .where(
      and(
        eq(workouts.userId, session.user.id),
        eq(workouts.status, "active"),
      ),
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

  const todayPlan = plans.find((plan) => plan.weekday === new Date().getDay());

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
    lastRows.reduce(
      (summary, row) => {
        const current = summary.get(row.workoutExerciseId) ?? {
          id: row.workoutExerciseId,
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
          name: string;
          position: number;
          sets: number;
          maxWeight: number;
        }
      >(),
    ).values(),
  ).sort((a, b) => a.position - b.position);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md md:max-w-3xl lg:max-w-5xl flex-col px-5 pb-10 pt-6">
      <ChangelogDialog />

      <AppHeader
        eyebrow="Tu progreso, serie a serie"
        title={`Hola, ${greetingName(displayName)}`}
      />

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
            ? activeWorkout.planName ?? "Sigue donde lo dejaste."
            : todayPlan
              ? todayPlan.name
              : plans.length > 0
                ? "Elige tu plan de hoy."
                : "Organiza tu semana."}
        </h2>
        <p className="mt-4 max-w-xs text-sm font-medium leading-6 text-primary-foreground/75 md:max-w-lg md:text-base md:leading-7">
          {activeWorkout
            ? "Tus series están guardadas. Continúa desde el siguiente ejercicio."
            : todayPlan
              ? `${todayPlan.exerciseCount} ${todayPlan.exerciseCount === 1 ? "ejercicio preparado" : "ejercicios preparados"} para registrar tu progreso.`
              : plans.length > 0
                ? "Puedes comenzar cualquiera de tus planes desde la lista de abajo."
                : "Crea un plan por día con tus ejercicios, series y repeticiones objetivo."}
        </p>
        {activeWorkout ? (
          <div className="mt-7 grid gap-2">
            <ButtonLink
              href="/entreno"
              size="lg"
              className="h-14 w-full rounded-2xl bg-background text-base font-semibold text-foreground hover:bg-background/90"
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
          <form action={startWorkout}>
            <input type="hidden" name="planId" value={todayPlan.id} />
            <PendingButton
              type="submit"
              size="lg"
              disabled={todayPlan.exerciseCount === 0}
              pendingLabel="Preparando…"
              className="mt-7 h-14 w-full rounded-2xl bg-background text-base font-semibold text-foreground hover:bg-background/90"
            >
              Empezar {todayPlan.name}
            </PendingButton>
          </form>
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

      <section id="planes" className="mt-8 scroll-mt-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Tu semana</p>
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
                  plan.id === todayPlan?.id ? "border-foreground/30 bg-muted/40" : ""
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
                    <h3 className="truncate font-semibold text-foreground">{plan.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {plan.exerciseCount} {plan.exerciseCount === 1 ? "ejercicio" : "ejercicios"}
                    </p>
                  </div>
                  {!activeWorkout && plan.exerciseCount > 0 ? (
                    <form action={startWorkout}>
                      <input type="hidden" name="planId" value={plan.id} />
                      <PendingButton type="submit" size="sm" pendingLabel="…">
                        Iniciar
                      </PendingButton>
                    </form>
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
              <CardTitle className="text-base">Aún no tienes ningún plan</CardTitle>
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
            <p className="text-sm font-medium text-muted-foreground">Tu referencia rápida</p>
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
                  <h3 className="truncate font-semibold text-foreground">{exercise.name}</h3>
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
            <p className="font-bold text-muted-foreground">Aún no hay entrenamientos terminados</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Tu primera sesión aparecerá aquí como referencia para la siguiente.
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
