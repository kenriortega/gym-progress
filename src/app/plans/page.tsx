import { and, asc, count, desc, eq, isNotNull, isNull } from "drizzle-orm";
import Link from "next/link";
import { ArchiveIcon, ArchiveRestoreIcon, ChevronRightIcon } from "lucide-react";
import { redirect } from "next/navigation";

import { createPlan, unarchivePlan } from "@/app/actions/plans";
import { auth } from "@/auth";
import { db } from "@/db";
import { trainingPlanExercises, trainingPlans } from "@/db/schema";
import { FormSelect } from "@/components/form-select";
import { PendingButton } from "@/components/pending-button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AppHeader } from "@/components/app-header";

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

  const archivados = await db
    .select({
      id: trainingPlans.id,
      name: trainingPlans.name,
      weekday: trainingPlans.weekday,
      archivedAt: trainingPlans.archivedAt,
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
        isNotNull(trainingPlans.archivedAt),
      ),
    )
    .groupBy(trainingPlans.id)
    .orderBy(desc(trainingPlans.archivedAt));

  const formatoFecha = new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-12 pt-6">
      <AppHeader backHref="/" eyebrow="Organización" title="Planes de entrenamiento" />

      <Card className="mt-8 bg-primary p-5 text-primary-foreground">
        <CardHeader className="p-0">
          <CardTitle className="text-xl">Crear un día de entrenamiento</CardTitle>
          <CardDescription className="text-primary-foreground/75">
            Ponle un nombre, asigna un día y después añade los ejercicios en orden.
          </CardDescription>
        </CardHeader>
        <form action={createPlan} className="mt-5 space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-primary-foreground/75">
            Nombre
            <Input
              name="name"
              required
              minLength={2}
              maxLength={100}
              placeholder="Ej. Piernas y core"
              className="mt-2 h-12 border-primary-foreground/20 bg-primary-foreground/10 text-base text-primary-foreground placeholder:text-primary-foreground/50"
            />
          </label>
          <label className="block text-xs font-bold uppercase tracking-wider text-primary-foreground/75">
            Día de la semana
            <FormSelect
              name="weekday"
              placeholder="Sin día fijo"
              options={weekdays.map((day, index) => ({ value: String(index), label: day }))}
              className="mt-2 h-12 w-full rounded-xl border-primary-foreground/20 bg-primary-foreground/10 px-4 text-base font-bold text-primary-foreground"
              aria-label="Día de la semana"
            />
          </label>
          <label className="block text-xs font-bold uppercase tracking-wider text-primary-foreground/75">
            Nota opcional
            <Input
              name="description"
              maxLength={500}
              placeholder="Ej. Fuerza y técnica"
              className="mt-2 h-12 border-primary-foreground/20 bg-primary-foreground/10 text-base text-primary-foreground placeholder:text-primary-foreground/50"
            />
          </label>
          <PendingButton
            type="submit"
            className="h-12 w-full bg-background font-semibold text-foreground hover:bg-background/90"
          >
            Crear y añadir ejercicios
          </PendingButton>
        </form>
      </Card>

      <section className="mt-8">
        <h2 className="text-lg font-extrabold text-foreground">Tus planes</h2>
        {plans.length > 0 ? (
          <div className="mt-4 space-y-3">
            {plans.map((plan) => (
              <Link key={plan.id} href={`/plans/${plan.id}`} className="block">
                <Card className="flex-row items-center gap-4 p-4 transition hover:border-foreground/25">
                  <Badge variant="secondary" className="size-11 shrink-0 justify-center rounded-xl text-base font-bold">
                    {plan.exerciseCount}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-foreground">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {plan.weekday === null ? "Sin día fijo" : weekdays[plan.weekday]}
                    {plan.exerciseCount === 1
                      ? " · 1 ejercicio"
                      : ` · ${plan.exerciseCount} ejercicios`}
                  </p>
                </div>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="mt-4 border-dashed p-6 text-center">
            <CardDescription>
              Crea tu primer plan para que la app prepare automáticamente los ejercicios del día.
            </CardDescription>
          </Card>
        )}
      </section>

      {archivados.length > 0 && (
        <section className="mt-10">
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center gap-2 text-left text-sm font-medium text-muted-foreground">
              <ArchiveIcon className="size-4" />
              Planes archivados
              <Badge variant="outline" className="ml-auto">
                {archivados.length}
              </Badge>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-4 space-y-3">
                {archivados.map((plan) => (
                  <Card key={plan.id} className="gap-3 p-4">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold text-foreground">
                          {plan.name}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {plan.weekday === null
                            ? "Sin día fijo"
                            : weekdays[plan.weekday]}
                          {" · "}
                          {plan.exerciseCount}{" "}
                          {plan.exerciseCount === 1 ? "ejercicio" : "ejercicios"}
                        </p>
                        {plan.archivedAt && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Archivado el {formatoFecha.format(plan.archivedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                    <form action={unarchivePlan}>
                      <input type="hidden" name="planId" value={plan.id} />
                      <PendingButton
                        type="submit"
                        variant="outline"
                        className="h-10 w-full"
                        pendingLabel="Restaurando…"
                      >
                        <ArchiveRestoreIcon className="size-4" />
                        Restaurar plan
                      </PendingButton>
                    </form>
                  </Card>
                ))}
              </div>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                Archivar un plan no borra nada: sus entrenamientos anteriores
                siguen en el historial. Al restaurarlo vuelve a aparecer en tu
                semana.
              </p>
            </CollapsibleContent>
          </Collapsible>
        </section>
      )}
    </main>
  );
}
