"use client";

import { useActionState, useEffect } from "react";
import { changeProgramMicrocycle } from "@/app/actions/plans";
import { Button } from "@/components/ui/button";
import { useOfflinePlans } from "@/components/offline-plans-provider";
import { OfflinePlansStatus } from "@/components/offline-plans-status";

export function ProgramCycleForm({ planId, microcycle }: { planId: string; microcycle: number }) {
  const [state, action, pending] = useActionState(changeProgramMicrocycle, null);
  const { refresh } = useOfflinePlans();
  useEffect(() => { void refresh(); }, [microcycle, refresh]);
  return (
    <section className="mt-6 border-y border-border py-5" aria-label="Programa de 8 microciclos">
      <h2 className="font-semibold">Programa de 8 microciclos · Microciclo {microcycle} de 8</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Aplica el microciclo elegido a las sesiones activas de esta copia. Los ejercicios con objetivos editados personalmente se conservan. Las sesiones iniciadas y el historial mantienen sus objetivos.</p>
      <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="planId" value={planId} />
        <label className="grid gap-2 text-sm font-medium">Microciclo
          <select name="microcycle" defaultValue={microcycle} className="min-h-11 rounded-lg border border-input bg-background px-3 text-foreground">
            {Array.from({ length: 8 }, (_, index) => <option key={index} value={index + 1}>Microciclo {index + 1}</option>)}
          </select>
        </label>
        <Button type="submit" disabled={pending} className="min-h-11">{pending ? "Aplicando…" : "Aplicar a esta copia"}</Button>
      </form>
      {state?.error && <p role="alert" className="mt-3 text-sm text-destructive">{state.error}</p>}
      <OfflinePlansStatus />
    </section>
  );
}
