"use client";
import { describeBlock, DISCIPLINES } from "@/lib/training-blocks";
import { formatTarget, formatSet } from "@/lib/training-metrics";

import { useState, useSyncExternalStore } from "react";
import { DocumentLink } from "@/components/document-link";
import { OfflineSyncStatus } from "@/components/offline-sync-status";
import { StartWorkoutButton } from "@/components/start-workout-button";
import { useOfflinePlans } from "@/components/offline-plans-provider";
import { OfflinePlansStatus } from "@/components/offline-plans-status";
import { Input } from "@/components/ui/input";
import { dayOf, localDate } from "@/lib/dates";
import { plansOn } from "@/lib/schedule";

const weekdays = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const today = () => dayOf(new Date());
function subscribeDay(callback: () => void) {
  const timer = window.setInterval(callback, 60_000);
  window.addEventListener("focus", callback);
  return () => { window.clearInterval(timer); window.removeEventListener("focus", callback); };
}

export default function SavedPlansPage() {
  const { catalog, loading } = useOfflinePlans();
  const localToday = useSyncExternalStore(subscribeDay, today, () => "");
  const [selectedDay, setSelectedDay] = useState("");
  const date = selectedDay || localToday;
  const scheduled = catalog && date ? plansOn(catalog.data.plans, catalog.data.reschedules, date) : [];
  const scheduledIds = new Set(scheduled.map((item) => item.plan.id));

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-12 pt-8 md:max-w-3xl lg:max-w-5xl">
      <nav aria-label="Navegación" className="mb-6 flex flex-wrap gap-6 text-sm font-semibold">
        <DocumentLink href="/" className="inline-flex min-h-11 items-center underline underline-offset-4">Inicio</DocumentLink>
        <a href="/entreno" className="inline-flex min-h-11 items-center underline underline-offset-4">Entrenamiento en curso</a>
      </nav>
      <h1 className="text-3xl font-black tracking-tight">Planes guardados</h1>
      <p className="mt-3 max-w-prose text-sm leading-6 text-muted-foreground">
        Elige un plan, empieza tu sesión y registra tus series con o sin conexión. Todo se guarda primero en este dispositivo.
      </p>
      <OfflinePlansStatus showLink={false} />
      <OfflineSyncStatus />
      {!loading && !catalog && (
        <p className="mt-8 max-w-prose text-sm leading-6 text-muted-foreground">
          Abre la app con conexión e inicia sesión para descargar todos tus planes activos automáticamente. No necesitas abrirlos uno por uno.
        </p>
      )}
      {catalog && catalog.data.plans.length > 0 && (
        <>
          <section aria-labelledby="scheduled-heading" className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 id="scheduled-heading" className="text-xl font-bold">{date === localToday ? "Para hoy" : "Para la fecha elegida"}</h2>
              <label className="grid gap-2 text-sm font-medium">
                Consultar otro día
                <Input type="date" value={date} onChange={(event) => setSelectedDay(event.target.value)} className="min-h-11 w-auto" />
              </label>
            </div>
            {scheduled.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {scheduled.map(({ plan, movedFrom }) => (
                  <li key={plan.id}>
                    <a href={`#plan-${plan.id}`} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">{plan.name} · {DISCIPLINES[plan.discipline ?? "strength"]}</a>
                    {movedFrom && <p className="text-sm text-muted-foreground">Movido desde el {localDate(movedFrom).toLocaleDateString("es", { day: "numeric", month: "long" })}.</p>}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-4 text-sm text-muted-foreground">No tienes un plan programado para este día. Puedes consultar cualquiera de los guardados.</p>}
          </section>
          <section aria-labelledby="all-plans-heading" className="mt-10">
            <h2 id="all-plans-heading" className="text-xl font-bold">Todos tus planes</h2>
            <div className="mt-4 divide-y divide-border border-y border-border">
              {catalog.data.plans.map((plan) => (
                <details key={plan.id} id={`plan-${plan.id}`} open={scheduledIds.has(plan.id) || undefined} className="scroll-mt-16 py-5">
                  <summary className="min-h-11 cursor-pointer break-words text-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                    {plan.name}
                    <span className="mt-1 block text-sm font-normal text-muted-foreground">
                      {plan.weekday === null ? "Sin día fijo" : weekdays[plan.weekday]} · {plan.exercises.length} {plan.exercises.length === 1 ? "ejercicio" : "ejercicios"}
                    </span>
                  </summary>
                  <StartWorkoutButton userId={catalog.userId} planId={plan.id} disabled={plan.exercises.length === 0} className="mt-4 min-h-12">
                    Empezar {plan.name}
                  </StartWorkoutButton>
                  {plan.description && <p className="mt-3 max-w-prose whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{plan.description}</p>}
                  {plan.exercises.length === 0 && <p className="mt-4 text-sm text-muted-foreground">Este plan todavía no tiene ejercicios.</p>}
                  {(plan.blocks ?? []).map((block) => <p key={block.id} className="mt-3 text-sm font-semibold">{block.name} · {describeBlock(block)}{block.prescription ? ` · ${block.prescription}` : ""}</p>)}
                  <ol className="mt-5 space-y-6">
                    {plan.exercises.map((exercise) => (
                      <li key={exercise.id} className="break-words">
                        <h3 className="font-semibold">{exercise.name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{exercise.muscleGroup} · {formatTarget(exercise)}</p>
                        {exercise.notes && <p className="mt-2 max-w-prose whitespace-pre-wrap text-sm leading-6">{exercise.notes}</p>}
                        {exercise.previous && exercise.previous.sets.length > 0 && <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
                          Última sesión ({new Date(exercise.previous.performedAt).toLocaleDateString("es")}): {exercise.previous.sets.map((set) => formatSet(set, exercise.previous!.weightUnit)).join(" · ")}.
                        </p>}
                      </li>
                    ))}
                  </ol>
                </details>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
