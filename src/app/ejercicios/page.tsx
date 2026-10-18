import { and, eq, isNull, or } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import { exercises } from "@/db/schema";
import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasFigure } from "@/lib/exercise-figures";

export default async function ExerciseGlossaryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const rows = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      muscleGroup: exercises.muscleGroup,
      userId: exercises.userId,
      equipmentKey: exercises.equipmentKey,
    })
    .from(exercises)
    .where(
      and(
        or(isNull(exercises.userId), eq(exercises.userId, session.user.id)),
        isNull(exercises.archivedAt),
      ),
    );

  const catalogue = rows.map((row) => ({ ...row, figure: hasFigure(row.equipmentKey, row.name) }));
  const withFigure = catalogue.filter((item) => item.figure).length;

  const groups = new Map<string, typeof catalogue>();
  for (const item of catalogue) {
    const group = groups.get(item.muscleGroup) ?? [];
    group.push(item);
    groups.set(item.muscleGroup, group);
  }
  const sorted = [...groups.entries()]
    .map(([group, items]) => [group, [...items].sort((a, b) => a.name.localeCompare(b.name, "es"))] as const)
    .sort(([a], [b]) => a.localeCompare(b, "es"));

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md md:max-w-3xl lg:max-w-5xl px-5 pb-12 pt-6">
      <AppHeader
        backHref="/"
        eyebrow="Catálogo"
        title="Ejercicios"
        action={
          withFigure > 0 ? (
            <Badge variant="secondary" className="shrink-0">
              {withFigure} con aparato
            </Badge>
          ) : undefined
        }
      />

      {catalogue.length > 0 ? (
        <>
          <p className="mt-4 text-sm text-muted-foreground">
            Todos los ejercicios disponibles, los tuyos incluidos. Los marcados con{" "}
            <span className="font-semibold text-foreground">Aparato</span> traen una figura
            interactiva de la máquina en su página.
          </p>

          {sorted.map(([group, items]) => (
            <section key={group} className="mt-8">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold text-foreground">{group}</h2>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {items.length} {items.length === 1 ? "ejercicio" : "ejercicios"}
                </span>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {items.map((item) => (
                  <Link key={item.id} href={`/exercises/${item.id}`} className="block min-w-0">
                    <Card className="flex-row items-center gap-3 p-4 transition hover:border-foreground/25">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold text-foreground">{item.name}</h3>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {item.userId ? "Ejercicio tuyo" : "Del catálogo"}
                        </p>
                      </div>
                      {item.figure ? (
                        <Badge variant="outline" className="shrink-0">
                          Aparato
                        </Badge>
                      ) : null}
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </>
      ) : (
        <Card className="mt-10 border-dashed px-6 py-12 text-center">
          <CardHeader>
            <CardTitle>Todavía no hay ejercicios</CardTitle>
            <CardDescription>
              Añade uno desde un plan o durante una sesión y aparecerá aquí.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </main>
  );
}
