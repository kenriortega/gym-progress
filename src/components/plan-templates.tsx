"use client";

import { UsersIcon, VenusIcon } from "lucide-react";
import { ButtonLink } from "@/components/button-link";

import { createPlanFromTemplate } from "@/app/actions/plans";
import { PendingButton } from "@/components/pending-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PLAN_TEMPLATES, type TemplateAudience } from "@/lib/plan-templates";

import { DISCIPLINES, describeBlock } from "@/lib/training-blocks";
import { prioritizePlans } from "@/lib/plan-order";
import { usePlansDiscipline } from "@/components/plans-discipline";

const ENFOQUE: Record<TemplateAudience, { etiqueta: string; Icon: typeof VenusIcon }> = {
  mixto: { etiqueta: "Mixto", Icon: UsersIcon },
  mujeres: { etiqueta: "Mujeres", Icon: VenusIcon },
};

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
function EnfoqueBadge({ enfoque }: { enfoque: TemplateAudience }) {
  const { etiqueta, Icon } = ENFOQUE[enfoque];
  return (
    <Badge variant={enfoque === "mujeres" ? "default" : "secondary"}>
      <Icon className="size-3" />
      {etiqueta}
    </Badge>
  );
}

export function PlanTemplates({ titulo }: { titulo?: string }) {
  const discipline = usePlansDiscipline();
  const templates = prioritizePlans(PLAN_TEMPLATES, discipline);
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
        {templates.map((plantilla) => (
          <Card key={plantilla.id} className="gap-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base"><a href={`/plans/templates/${plantilla.id}`} className="underline-offset-4 hover:underline">{plantilla.name}</a></CardTitle>
                <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {plantilla.audience}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge variant="outline">{DISCIPLINES[plantilla.discipline ?? "strength"]}</Badge>
                <EnfoqueBadge enfoque={plantilla.gender} />
                <Badge variant="outline">
                  {plantilla.weekday === null
                    ? "Sin día"
                    : DIAS[plantilla.weekday].slice(0, 3)}
                </Badge>
              </div>
            </div>

            <CardDescription>{plantilla.description}</CardDescription>
            {plantilla.block && (
              <p className="text-sm font-medium text-foreground">
                {describeBlock({ ...plantilla.block, id: plantilla.id, exerciseIds: [] })}
              </p>
            )}
            {plantilla.instructions && <p className="text-sm leading-6 text-muted-foreground">{plantilla.instructions}</p>}
            {plantilla.block?.prescription && <p className="text-sm leading-6 text-muted-foreground">{plantilla.block.prescription}</p>}

            <ul className="space-y-1 text-sm text-muted-foreground">
              {plantilla.exercises.map((ejercicio) => (
                <li key={ejercicio.name} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">{ejercicio.name}</span>
                  <span className="shrink-0 tabular-nums">
                    {ejercicio.measurement === "time" ? `${ejercicio.sets} × ${ejercicio.targetSeconds} s` : `${plantilla.block ? "" : `${ejercicio.sets} × `}${ejercicio.repsMin}${ejercicio.repsMin === ejercicio.repsMax ? "" : `–${ejercicio.repsMax}`} reps`}
                  </span>
                </li>
              ))}
            </ul>

            <ButtonLink href={`/plans/templates/${plantilla.id}`} variant="outline" className="min-h-11 w-full">Ver detalle</ButtonLink>
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
