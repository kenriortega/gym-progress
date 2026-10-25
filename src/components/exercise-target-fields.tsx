"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { LOAD_LABELS, type ExerciseMetrics } from "@/lib/training-metrics";

/** Un único editor para añadir y actualizar los objetivos del plan. */
export function ExerciseTargetFields({ value }: { value?: ExerciseMetrics & { targetSets: number; targetRepsMin: number | null; targetRepsMax: number | null } }) {
  const id = useId();
  const [measurement, setMeasurement] = useState(value?.measurement ?? "reps");
  const selectClass = "mt-2 h-12 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring";
  return <fieldset className="space-y-3">
    <legend className="sr-only">Medición y objetivo del ejercicio</legend>
    <div className="grid gap-3 sm:grid-cols-2">
      <label htmlFor={`${id}-measurement`} className="text-sm font-medium">Registrar por
        <select id={`${id}-measurement`} name="measurement" aria-label="Registrar por" value={measurement} onChange={(event) => setMeasurement(event.target.value as "reps" | "time")} className={selectClass}>
          <option value="reps">Repeticiones</option><option value="time">Tiempo en segundos</option>
        </select>
      </label>
      <label htmlFor={`${id}-load`} className="text-sm font-medium">Tipo de carga
        <select id={`${id}-load`} name="loadType" aria-label="Tipo de carga" defaultValue={value?.loadType ?? "external"} className={selectClass}>
          {Object.entries(LOAD_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
    </div>
    <div className={`grid gap-2 ${measurement === "time" ? "grid-cols-2" : "grid-cols-3"}`}>
      <label className="text-xs font-semibold text-muted-foreground">Series<Input name="targetSets" type="number" min="1" max="20" required defaultValue={value?.targetSets ?? 3} className="mt-2 h-12 text-center" /></label>
      {measurement === "time" ? <label className="text-xs font-semibold text-muted-foreground">Segundos por serie<Input name="targetSeconds" type="number" min="1" max="86400" required defaultValue={value?.targetSeconds ?? 30} className="mt-2 h-12 text-center" /></label> : <>
        <label className="text-xs font-semibold text-muted-foreground">Reps mín.<Input name="targetRepsMin" type="number" min="1" max="1000" required defaultValue={value?.targetRepsMin ?? 8} className="mt-2 h-12 text-center" /></label>
        <label className="text-xs font-semibold text-muted-foreground">Reps máx.<Input name="targetRepsMax" type="number" min="1" max="1000" required defaultValue={value?.targetRepsMax ?? 12} className="mt-2 h-12 text-center" /></label>
      </>}
    </div>
    <details className="border-t border-border pt-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">Variante y progresión personal</summary>
      <label className="mt-3 grid gap-2 text-sm">Variante<Input name="variation" maxLength={120} defaultValue={value?.variation ?? ""} placeholder="Ej.: estricta, negativa o con apoyo" /></label>
      <label className="mt-3 grid gap-2 text-sm">Pasos de tu progresión, uno por línea<textarea name="progressionSteps" maxLength={1500} defaultValue={value?.progressionSteps?.join("\n") ?? ""} rows={4} className="rounded-lg border border-input bg-background p-3 focus-visible:outline-2 focus-visible:outline-ring" placeholder={"Con apoyo\nNegativa\nEstricta"} /></label>
      <label className="mt-3 grid gap-2 text-sm">Paso actual (desde 1)<Input name="progressionStep" type="number" min="1" max="12" defaultValue={value?.progressionStep ?? 1} /></label>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">Si defines pasos, el paso actual determina la variante. Tú decides cuándo avanzar editando el plan; las sesiones anteriores conservan su variante.</p>
    </details>
  </fieldset>;
}
