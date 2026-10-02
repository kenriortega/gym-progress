import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { updateWeightUnit } from "@/app/actions/settings";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { AppHeader } from "@/components/app-header";
import { PendingButton } from "@/components/pending-button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { FormSelect } from "@/components/form-select";

export default async function AjustesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [usuario] = await db
    .select({ unit: users.preferredWeightUnit })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md md:max-w-3xl lg:max-w-5xl px-5 pb-12 pt-6">
      <AppHeader backHref="/" eyebrow="Tu cuenta" title="Ajustes" />

      <Card className="mt-8 p-5 md:max-w-xl">
        <CardTitle className="text-lg">Unidad de peso</CardTitle>
        <CardDescription>
          Se usa en los entrenamientos nuevos. Los que ya registraste conservan
          la unidad con la que los guardaste, así que tu historial no cambia.
        </CardDescription>

        <form action={updateWeightUnit} className="mt-4 flex gap-2">
          <FormSelect
            name="weightUnit"
            defaultValue={usuario?.unit ?? "kg"}
            placeholder="Elige una unidad"
            options={[
              { value: "kg", label: "Kilos (kg)" },
              { value: "lb", label: "Libras (lb)" },
            ]}
            className="h-12 flex-1 rounded-xl px-4 text-base font-semibold"
            aria-label="Unidad de peso"
          />
          <PendingButton type="submit" className="h-12">
            Guardar
          </PendingButton>
        </form>
      </Card>
    </main>
  );
}
