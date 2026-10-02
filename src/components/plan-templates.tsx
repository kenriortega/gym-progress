import { createPlanFromTemplate } from "@/app/actions/plans";
import { PendingButton } from "@/components/pending-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PLAN_TEMPLATES } from "@/lib/plan-templates";

const DIAS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

/**
 * Planes listos para copiar. Lo que frena a alguien que entra por primera vez
 * no es la app, es tener que decidir qué ejercicios hacer y en qué orden.
 */
export function PlanTemplates({ titulo }: { titulo?: string }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-foreground">
        {titulo ?? "Empieza con un plan hecho"}
      </h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Lo copias y lo editas a tu gusto: quitar ejercicios, cambiar series o
        mover el día. Nada queda fijo.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {PLAN_TEMPLATES.map((plantilla) => (
          <Card key={plantilla.id} className="gap-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base">{plantilla.name}</CardTitle>
                <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {plantilla.audience}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0">
                {plantilla.weekday === null
                  ? "Sin día"
                  : DIAS[plantilla.weekday].slice(0, 3)}
              </Badge>
            </div>

            <CardDescription>{plantilla.description}</CardDescription>

            <ul className="space-y-1 text-sm text-muted-foreground">
              {plantilla.exercises.map((ejercicio) => (
                <li key={ejercicio.name} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">{ejercicio.name}</span>
                  <span className="shrink-0 tabular-nums">
                    {ejercicio.sets}×{ejercicio.repsMin}–{ejercicio.repsMax}
                  </span>
                </li>
              ))}
            </ul>

            <form action={createPlanFromTemplate}>
              <input type="hidden" name="templateId" value={plantilla.id} />
              <PendingButton
                type="submit"
                variant="outline"
                className="h-11 w-full"
                pendingLabel="Creando…"
              >
                Usar este plan
              </PendingButton>
            </form>
          </Card>
        ))}
      </div>
    </section>
  );
}
