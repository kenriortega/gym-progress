import { and, asc, count, desc, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { startWorkout } from "@/app/actions/workouts";
import { auth, signOut } from "@/auth";
import { db } from "@/db";
import {
  exercises,
  trainingPlanExercises,
  trainingPlans,
  workoutExercises,
  workouts,
  workoutSets,
} from "@/db/schema";

const accents = ["bg-lime-300", "bg-orange-300", "bg-sky-300"];
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
  const initial = displayName.charAt(0).toUpperCase();

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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-400">Tu progreso, serie a serie</p>
          <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-white">
            Hola, {displayName.split(" ")[0]}
          </h1>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="grid size-11 place-items-center rounded-full border border-white/10 bg-white/5 text-lg font-bold transition hover:border-lime-300/50 hover:text-lime-300"
          >
            {initial}
          </button>
        </form>
      </header>

      <section className="mt-8 overflow-hidden rounded-[2rem] bg-lime-300 p-6 text-zinc-950 shadow-[0_24px_70px_-30px_rgba(190,242,100,0.65)]">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-zinc-700">
          {activeWorkout
            ? "Sesión en curso"
            : todayPlan
              ? `Plan de ${weekdays[todayPlan.weekday!]}`
              : "Tu entrenamiento"}
        </p>
        <h2 className="mt-3 max-w-[12ch] text-4xl font-black leading-[0.95] tracking-[-0.05em]">
          {activeWorkout
            ? activeWorkout.planName ?? "Sigue donde lo dejaste."
            : todayPlan
              ? todayPlan.name
              : plans.length > 0
                ? "Elige tu plan de hoy."
                : "Organiza tu semana."}
        </h2>
        <p className="mt-4 max-w-xs text-sm font-medium leading-6 text-zinc-700">
          {activeWorkout
            ? "Tus series están guardadas. Continúa desde el siguiente ejercicio."
            : todayPlan
              ? `${todayPlan.exerciseCount} ${todayPlan.exerciseCount === 1 ? "ejercicio preparado" : "ejercicios preparados"} para registrar tu progreso.`
              : plans.length > 0
                ? "Puedes comenzar cualquiera de tus planes desde la lista de abajo."
                : "Crea un plan por día con tus ejercicios, series y repeticiones objetivo."}
        </p>
        {activeWorkout ? (
          <Link
            href={`/workout/${activeWorkout.id}`}
            className="mt-7 flex h-14 w-full items-center justify-center rounded-2xl bg-zinc-950 px-5 text-base font-bold text-white transition hover:bg-zinc-800"
          >
            Continuar entreno
          </Link>
        ) : todayPlan ? (
          <form action={startWorkout}>
            <input type="hidden" name="planId" value={todayPlan.id} />
            <button
              type="submit"
              disabled={todayPlan.exerciseCount === 0}
              className="mt-7 flex h-14 w-full items-center justify-center rounded-2xl bg-zinc-950 px-5 text-base font-bold text-white transition hover:bg-zinc-800"
            >
              Empezar {todayPlan.name}
            </button>
          </form>
        ) : (
          <Link
            href={plans.length > 0 ? "#planes" : "/plans"}
            className="mt-7 flex h-14 w-full items-center justify-center rounded-2xl bg-zinc-950 px-5 text-base font-bold text-white transition hover:bg-zinc-800"
          >
            {plans.length > 0 ? "Elegir un plan" : "Crear mi primer plan"}
          </Link>
        )}
      </section>

      <section id="planes" className="mt-8 scroll-mt-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">Tu semana</p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight text-white">
              Planes de entrenamiento
            </h2>
          </div>
          <Link href="/plans" className="text-sm font-bold text-lime-300">
            Gestionar
          </Link>
        </div>

        {plans.length > 0 ? (
          <div className="mt-4 space-y-3">
            {plans.map((plan) => (
              <article
                key={plan.id}
                className={`rounded-2xl border p-4 ${
                  plan.id === todayPlan?.id
                    ? "border-lime-300/40 bg-lime-300/[0.07]"
                    : "border-white/8 bg-white/[0.035]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/5 text-xs font-black uppercase text-lime-300">
                    {plan.weekday === null
                      ? "Libre"
                      : weekdays[plan.weekday].slice(0, 3)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-extrabold text-white">{plan.name}</h3>
                    <p className="mt-1 text-sm text-zinc-500">
                      {plan.exerciseCount} {plan.exerciseCount === 1 ? "ejercicio" : "ejercicios"}
                    </p>
                  </div>
                  {!activeWorkout && plan.exerciseCount > 0 ? (
                    <form action={startWorkout}>
                      <input type="hidden" name="planId" value={plan.id} />
                      <button
                        type="submit"
                        className="rounded-xl bg-white px-4 py-2 text-sm font-black text-zinc-950"
                      >
                        Iniciar
                      </button>
                    </form>
                  ) : (
                    <Link
                      href={`/plans/${plan.id}`}
                      className="grid size-10 place-items-center rounded-xl bg-white/5 text-zinc-400"
                      aria-label={`Editar ${plan.name}`}
                    >
                      →
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Link
            href="/plans"
            className="mt-4 block rounded-2xl border border-dashed border-white/12 px-5 py-7 text-center"
          >
            <p className="font-bold text-zinc-300">Crea tu primer plan semanal</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              La app cargará todos sus ejercicios al iniciar la sesión.
            </p>
          </Link>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-500">Tu referencia rápida</p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight text-white">
              Último entrenamiento
            </h2>
          </div>
          <div className="shrink-0 text-right">
            {lastWorkout && (
              <p className="text-sm font-semibold text-lime-300">
                {relativeDate(lastWorkout.performedAt)}
              </p>
            )}
            <Link
              href="/history"
              className="mt-1 inline-block text-sm font-bold text-zinc-400 transition hover:text-white"
            >
              Ver historial
            </Link>
          </div>
        </div>

        {exerciseSummary.length > 0 ? (
          <div className="mt-4 space-y-3">
            {exerciseSummary.map((exercise, index) => (
              <article
                key={exercise.id}
                className="flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.035] p-4"
              >
                <div
                  className={`grid size-11 shrink-0 place-items-center rounded-xl ${accents[index % accents.length]} font-black text-zinc-950`}
                >
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-bold text-white">{exercise.name}</h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    {exercise.sets} {exercise.sets === 1 ? "serie" : "series"}
                    {exercise.sets > 0 && lastWorkout
                      ? ` · hasta ${exercise.maxWeight} ${lastWorkout.weightUnit}`
                      : ""}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-white/12 px-5 py-8 text-center">
            <p className="font-bold text-zinc-300">Aún no hay entrenamientos terminados</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Tu primera sesión aparecerá aquí como referencia para la siguiente.
            </p>
          </div>
        )}
      </section>

      <footer className="mt-auto pt-10 text-center text-xs leading-5 text-zinc-600">
        Tu progreso se guarda automáticamente después de cada serie
      </footer>
    </main>
  );
}
