"use client";

import { useActionState } from "react";
import { createProgramFromTemplate } from "@/app/actions/plans";
import { Button } from "@/components/ui/button";

export function ProgramTemplateForm({ programId, microcycle }: { programId: string; microcycle?: number }) {
  const [state, action, pending] = useActionState(createProgramFromTemplate, null);
  return (
    <form action={action} className="mt-6">
      <input type="hidden" name="programId" value={programId} />
      {microcycle !== undefined && <input type="hidden" name="microcycle" value={microcycle} />}
      <Button type="submit" disabled={pending} className="min-h-12 w-full" aria-describedby={state?.error ? "program-error" : undefined}>
        {pending ? "Añadiendo todas las sesiones…" : "Añadir programa completo"}
      </Button>
      {state?.error && <p id="program-error" role="alert" className="mt-3 text-sm leading-6 text-destructive">{state.error}</p>}
    </form>
  );
}
