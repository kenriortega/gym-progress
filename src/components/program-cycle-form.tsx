"use client";

import { useActionState, useEffect, useState } from "react";
import { changeProgramMicrocycle } from "@/app/actions/plans";
import { Button } from "@/components/ui/button";
import { useOfflinePlans } from "@/components/offline-plans-provider";
import { OfflinePlansStatus } from "@/components/offline-plans-status";
import { microcycleDiff, rirLabel, type MicrocycleSummary } from "@/lib/microcycle-summary";
import { cn } from "cn";

/**
 * El programa es una tabla de ocho columnas que solo se veía de una en una.
 * Aquí se ve entera: dónde estás, qué pide este microciclo y a qué te apuntas
 * si cambias, antes de aplicarlo.
 *
 * Los resúmenes llegan calculados desde el servidor. Calcularlos aquí metería
 * `pdf-programs.json` entero en el paquete del navegador para mostrar tres
 * números.
 */
export function ProgramCycleForm({
  planId,
  microcycle,
  summaries = [],
  cameFrom = null,
}: {
  planId: string;
  microcycle: number;
  summaries?: MicrocycleSummary[];
  /** El microciclo que acabas de dejar, si vienes de aplicar un cambio. */
  cameFrom?: number | null;
}) {
  const [state, action, pending] = useActionState(changeProgramMicrocycle, null);
  const { refresh } = useOfflinePlans();
  useEffect(() => { void refresh(); }, [microcycle, refresh]);

  // La elección vuelve al microciclo aplicado cuando el servidor confirma el
  // cambio. Ajustar el estado durante el render, y no en un efecto: así no hay
  // un parpadeo con la vista previa del microciclo anterior.
  const [choice, setChoice] = useState(microcycle);
  const [applied, setApplied] = useState(microcycle);
  if (applied !== microcycle) {
    setApplied(microcycle);
    setChoice(microcycle);
  }

  const total = summaries.length || 8;
  const current = summaries.find((item) => item.microcycle === microcycle) ?? null;
  const target = summaries.find((item) => item.microcycle === choice) ?? null;
  const diff = current && target ? microcycleDiff(current, target) : [];
  // El hito, sin medallas: una línea con lo que acabas de dejar atrás.
  const left = cameFrom !== null && cameFrom !== microcycle
    ? summaries.find((item) => item.microcycle === cameFrom) ?? null
    : null;

  return (
    <section className="mt-6 border-y border-border py-5" aria-label="Programa de 8 microciclos">
      <h2 className="font-semibold">
        Programa de {total} microciclos · Microciclo {microcycle} de {total}
      </h2>

      {/* Ocho segmentos: dónde estás en la secuencia. No es un porcentaje de
          cumplimiento — un microciclo no se completa, se decide cambiarlo. */}
      <ol className="mt-3 flex gap-1" aria-hidden>
        {Array.from({ length: total }, (_, index) => index + 1).map((step) => (
          <li
            key={step}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              step < microcycle ? "bg-primary/40" : step === microcycle ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </ol>

      {current ? (
        <p className="mt-2 text-sm font-medium tabular-nums text-foreground">
          {current.sets} series · {rirLabel(current)}
          {current.dropSets > 0 ? ` · ${current.dropSets} drop sets` : ""}
        </p>
      ) : null}

      {left && current ? (
        <p className="mt-3 rounded-xl bg-primary/10 px-4 py-3 text-sm leading-6 text-foreground">
          Dejas atrás el microciclo {left.microcycle}: {left.sets} series a {rirLabel(left)}
          {left.dropSets > 0 ? ` con ${left.dropSets} drop sets` : ""}. Ahora toca{" "}
          {current.sets} series a {rirLabel(current)}
          {current.dropSets > 0 ? ` con ${current.dropSets} drop sets` : ""}.
        </p>
      ) : null}

      <p className="mt-2 text-sm leading-6 text-muted-foreground">Aplica el microciclo elegido a las sesiones activas de esta copia. Los ejercicios con objetivos editados personalmente se conservan. Las sesiones iniciadas y el historial mantienen sus objetivos.</p>

      <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="planId" value={planId} />
        <label className="grid gap-2 text-sm font-medium">Microciclo
          <select
            name="microcycle"
            value={choice}
            onChange={(event) => setChoice(Number(event.target.value))}
            className="min-h-11 rounded-lg border border-input bg-background px-3 text-foreground"
          >
            {Array.from({ length: total }, (_, index) => <option key={index} value={index + 1}>Microciclo {index + 1}</option>)}
          </select>
        </label>
        <Button type="submit" disabled={pending} className="min-h-11">{pending ? "Aplicando…" : "Aplicar a esta copia"}</Button>
      </form>

      {/* Elegir un número del 1 al 8 a ciegas era la parte más opaca del
          programa: esto dice a qué te apuntas antes de aplicarlo. */}
      {diff.length > 0 ? (
        <div className="mt-4 rounded-xl border border-border p-4" aria-live="polite">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Si pasas al {choice}
          </p>
          <ul className="mt-2 grid gap-1.5 text-sm leading-6 text-foreground">
            {diff.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </div>
      ) : null}

      {state?.error && <p role="alert" className="mt-3 text-sm text-destructive">{state.error}</p>}
      <OfflinePlansStatus />
    </section>
  );
}
