import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { createPlanFromTemplate } from "@/app/actions/plans";
import { AppHeader } from "@/components/app-header";
import { PendingButton } from "@/components/pending-button";
import { Card } from "@/components/ui/card";
import { findTemplate } from "@/lib/plan-templates";
import { DISCIPLINES, describeBlock } from "@/lib/training-blocks";
import { formatTarget } from "@/lib/training-metrics";

export default async function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const template = findTemplate((await params).id);
  if (!template) notFound();
  return <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-12 pt-6 md:max-w-3xl">
    <AppHeader backHref="/plans" title={template.name} />
    <p className="mt-5 text-sm font-semibold">Plantilla · {DISCIPLINES[template.discipline ?? "strength"]}</p>
    <p className="mt-3 leading-7">{template.description}</p>
    <p className="mt-2 text-sm text-muted-foreground">{template.audience}</p>
    {template.instructions && <Card className="mt-6 whitespace-pre-wrap p-5 leading-7">{template.instructions}</Card>}
    {template.block && <section className="mt-6">
      <h2 className="text-xl font-semibold">Formato del entrenamiento</h2>
      <p className="mt-3">{describeBlock({ ...template.block, id: template.id, exerciseIds: [] })}</p>
      {template.block.prescription && <p className="mt-2 leading-7">{template.block.prescription}</p>}
    </section>}
    <section className="mt-8">
      <h2 className="text-xl font-semibold">Ejercicios y objetivos</h2>
      <ol className="mt-4 divide-y divide-border">
        {template.exercises.map((exercise, index) => <li key={`${index}:${exercise.name}`} className="py-4">
          <h3 className="font-semibold">{index + 1}. {exercise.name}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{formatTarget({ ...exercise, targetSets: exercise.sets, targetRepsMin: exercise.repsMin, targetRepsMax: exercise.repsMax })}</p>
        </li>)}
      </ol>
    </section>
    <form action={createPlanFromTemplate} className="mt-8">
      <input type="hidden" name="templateId" value={template.id} />
      <PendingButton type="submit" className="min-h-12 w-full" pendingLabel="Creando…">Usar este plan</PendingButton>
    </form>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">Al usarlo se creará una copia que podrás editar. Consultar esta página no añade planes a tu cuenta.</p>
  </main>;
}
