import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { updateGoalWeight } from "@/app/actions/body-weight";
import { updateWeightUnit } from "@/app/actions/settings";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { AppHeader } from "@/components/app-header";
import { PendingButton } from "@/components/pending-button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { FormSelect } from "@/components/form-select";
import { bodyWeightUnit, convertWeight } from "@/lib/weight-units";
import { Input } from "@/components/ui/input";

export default async function AjustesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [usuario] = await db
    .select({ unit: users.preferredWeightUnit, goalWeight: users.goalWeight, bodySystem: users.preferredBodySystem })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const bodyUnit = bodyWeightUnit(usuario?.bodySystem ?? "metric");

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md md:max-w-3xl lg:max-w-5xl px-5 pb-12 pt-6">
      <AppHeader backHref="/" eyebrow="Tu cuenta" title="Ajustes" />

      <Card className="mt-8 p-5 md:max-w-xl">
        <CardTitle className="text-lg">Unidades de medida</CardTitle>
        <CardDescription>
          Elige por separado las unidades corporales y las de entrenamiento.
          En cada ejercicio podrás cambiar la visualización sin modificar estas preferencias.
        </CardDescription>

        <form action={updateWeightUnit} className="mt-4 grid gap-4">
          <label className="grid gap-2 text-sm font-medium">
            Medidas corporales
            <FormSelect name="bodySystem" defaultValue={usuario?.bodySystem ?? "metric"}
              placeholder="Elige un sistema" aria-label="Medidas corporales"
              className="w-full data-[size=default]:h-12 rounded-xl px-4 text-base font-semibold"
              options={[{ value: "metric", label: "Métrico (kg)" }, { value: "imperial", label: "Imperial (lb)" }]} />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Pesos de entrenamiento
            <FormSelect
              name="weightUnit"
              defaultValue={usuario?.unit ?? "kg"}
              placeholder="Elige una unidad"
              options={[
                { value: "kg", label: "Kilos (kg)" },
                { value: "lb", label: "Libras (lb)" },
              ]}
              className="w-full data-[size=default]:h-12 rounded-xl px-4 text-base font-semibold"
              aria-label="Pesos de entrenamiento"
            />
          </label>
          <PendingButton type="submit" className="h-12">
            Guardar
          </PendingButton>
        </form>
      </Card>

      <Card className="mt-4 p-5 md:max-w-xl">
        <CardTitle className="text-lg">Objetivo de peso</CardTitle>
        <CardDescription>
          Sale como línea en la gráfica de peso de Inicio, en {bodyUnit}. Déjalo vacío para quitarlo.
        </CardDescription>

        <form action={updateGoalWeight} className="mt-4 flex gap-2">
          <input type="hidden" name="unit" value={bodyUnit} />
          <Input
            name="goalWeight"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={Number(convertWeight(20, "kg", bodyUnit).toFixed(2))}
            max={Number(convertWeight(500, "kg", bodyUnit).toFixed(2))}
            key={bodyUnit}
            defaultValue={usuario?.goalWeight ? Number(convertWeight(Number(usuario.goalWeight), "kg", bodyUnit).toFixed(2)) : undefined}
            placeholder="77"
            aria-label={`Objetivo de peso en ${bodyUnit}`}
            className="h-12 flex-1 rounded-xl px-4 text-base font-semibold tabular-nums"
          />
          <PendingButton type="submit" className="h-12">
            Guardar
          </PendingButton>
        </form>
      </Card>
    </main>
  );
}
