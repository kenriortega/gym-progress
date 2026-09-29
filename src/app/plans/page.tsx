import { and, asc, count, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createPlan } from "@/app/actions/plans";
import { auth } from "@/auth";
import { db } from "@/db";
import { trainingPlanExercises, trainingPlans } from "@/db/schema";

const weekdays = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

export default async function PlansPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

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

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-12 pt-6">
      <header className="flex items-center gap-4">
        <Link
          href="/"
          className="grid size-11 place-items-center rounded-full border border-white/10 text-xl text-zinc-300"
          aria-label="Volver al inicio"
        >
          ←
        </Link>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-lime-300">
            Organización
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
            Planes de entrenamiento
          </h1>
        </div>
      </header>

      <section className="mt-8 rounded-3xl bg-lime-300 p-5 text-zinc-950">
        <h2 className="text-xl font-black">Crear un día de entrenamiento</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-700">
          Ponle un nombre, asigna un día y después añade los ejercicios en orden.
        </p>
        <form action={createPlan} className="mt-5 space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700">
            Nombre
            <input
              name="name"
              required
              minLength={2}
              maxLength={100}
              placeholder="Ej. Piernas y core"
              className="mt-2 h-12 w-full rounded-xl border border-zinc-950/15 bg-white/70 px-4 text-base font-bold text-zinc-950 outline-none placeholder:text-zinc-500 focus:border-zinc-950"
            />
          </label>
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700">
            Día de la semana
            <select
              name="weekday"
              defaultValue=""
              className="mt-2 h-12 w-full rounded-xl border border-zinc-950/15 bg-white/70 px-4 text-base font-bold text-zinc-950 outline-none focus:border-zinc-950"
            >
              <option value="">Sin día fijo</option>
              {weekdays.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700">
            Nota opcional
            <input
              name="description"
              maxLength={500}
              placeholder="Ej. Fuerza y técnica"
              className="mt-2 h-12 w-full rounded-xl border border-zinc-950/15 bg-white/70 px-4 text-base font-medium text-zinc-950 outline-none placeholder:text-zinc-500 focus:border-zinc-950"
            />
          </label>
          <button
            type="submit"
            className="h-12 w-full rounded-xl bg-zinc-950 text-sm font-black text-white"
          >
            Crear y añadir ejercicios
          </button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-extrabold text-white">Tus planes</h2>
        {plans.length > 0 ? (
          <div className="mt-4 space-y-3">
            {plans.map((plan) => (
              <Link
                key={plan.id}
                href={`/plans/${plan.id}`}
                className="flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.035] p-4 transition hover:border-lime-300/30"
              >
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/5 text-lg font-black text-lime-300">
                  {plan.exerciseCount}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-extrabold text-white">{plan.name}</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    {plan.weekday === null ? "Sin día fijo" : weekdays[plan.weekday]}
                    {plan.exerciseCount === 1
                      ? " · 1 ejercicio"
                      : ` · ${plan.exerciseCount} ejercicios`}
                  </p>
                </div>
                <span className="text-zinc-600">→</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-white/12 p-6 text-center text-sm leading-6 text-zinc-500">
            Crea tu primer plan para que la app prepare automáticamente los ejercicios del día.
          </p>
        )}
      </section>
    </main>
  );
}
