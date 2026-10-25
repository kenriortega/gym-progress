"use client";
import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { PendingButton } from "@/components/pending-button";
import { BLOCK_LABELS, type TrainingBlock, type BlockFormat } from "@/lib/training-blocks";
import { savePlanBlock } from "@/app/actions/plans";

export function PlanBlockEditor({ planId, exercises, block }: { planId: string; exercises: Array<{ exerciseId: string; name: string }>; block?: TrainingBlock }) {
  const id = useId();
  const [format, setFormat] = useState<BlockFormat>(block?.format ?? "circuit");
  return <form action={savePlanBlock} className="mt-4 space-y-4">
    <input type="hidden" name="planId" value={planId} />
    {block && <input type="hidden" name="blockId" value={block.id} />}
    <label className="grid gap-2 text-sm font-medium">Nombre del bloque<Input name="name" required maxLength={100} defaultValue={block?.name ?? ""} placeholder="Ej.: Fuerza, técnica o circuito final" className="h-12" /></label>
    <label className="grid gap-2 text-sm font-medium">Formato<select aria-label="Formato" name="format" value={format} onChange={(event) => setFormat(event.target.value as BlockFormat)} className="h-12 w-full rounded-lg border border-input bg-background px-3 focus-visible:outline-2 focus-visible:outline-ring">
      {Object.entries(BLOCK_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select></label>
    <div className="grid gap-3 sm:grid-cols-2">
      {(format === "circuit" || format === "for-time") && <label className="grid gap-2 text-sm">Rondas<Input name="rounds" type="number" min="1" max="1000" required defaultValue={block?.rounds ?? 3} /></label>}
      {(format === "amrap" || format === "emom") && <label className="grid gap-2 text-sm">Duración (segundos)<Input name="durationSeconds" type="number" min="1" max="86400" required defaultValue={block?.durationSeconds ?? 600} /></label>}
      {format === "for-time" && <label className="grid gap-2 text-sm">Límite en segundos (opcional)<Input name="timeCapSeconds" type="number" min="1" max="86400" defaultValue={block?.timeCapSeconds ?? ""} /></label>}
      {format === "emom" && <label className="grid gap-2 text-sm">Intervalo (segundos)<Input name="intervalSeconds" type="number" min="1" max="3600" required defaultValue={block?.intervalSeconds ?? 60} /></label>}
    </div>
    <label className="grid gap-2 text-sm">Cargas, variantes y material<Input name="prescription" maxLength={2000} defaultValue={block?.prescription ?? ""} placeholder="Ej.: dominadas estrictas; lastre de 10 kg" /></label>
    <fieldset><legend className="text-sm font-semibold">Ejercicios, en el orden del plan</legend>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">Cada ejercicio pertenece a un bloque. Los que no selecciones se entrenan como series individuales. En circuitos, el objetivo de cada ejercicio se realiza una vez por ronda.</p>
      {exercises.map((exercise, index) => <label key={exercise.exerciseId} htmlFor={`${id}-${index}`} className="flex min-h-11 items-center gap-3 text-sm">
        <input id={`${id}-${index}`} name="exerciseIds" type="checkbox" value={exercise.exerciseId} defaultChecked={block?.exerciseIds.includes(exercise.exerciseId)} className="size-5 accent-primary" />{exercise.name}
      </label>)}
    </fieldset>
    <PendingButton type="submit" className="min-h-12 w-full" disabled={!exercises.length}>{block ? "Guardar bloque" : "Añadir bloque"}</PendingButton>
  </form>;
}
