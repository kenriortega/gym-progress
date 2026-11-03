import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { TemplateAudienceBadge } from "@/components/template-audience-badge";
import { ProgramTemplateForm } from "@/components/program-template-form";
import { findProgramTemplate, PROGRAM_GUIDANCE, PROGRAM_PROGRESSION, PROGRAM_WEEKDAYS } from "@/lib/program-templates";
import { formatTarget } from "@/lib/training-metrics";
import { hasPdfProgram, pdfProgram } from "@/lib/pdf-programs";
import { SetPrescription } from "@/components/set-prescription";
import { ButtonLink } from "@/components/button-link";

export default async function ProgramDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ version?: string; microcycle?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const template = findProgramTemplate((await params).id);
  if (!template) notFound();
  const query = await searchParams;
  const pdf = query.version === "pdf";
  const microcycle = Number(query.microcycle ?? 1);
  if (pdf && (!hasPdfProgram(template.id) || !Number.isInteger(microcycle) || microcycle < 1 || microcycle > 8)) notFound();
  const program = pdf ? pdfProgram(template, microcycle) : template;
  const days = new Set(program.sessions.map((item) => item.weekday));

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-12 pt-6 md:max-w-3xl">
      <div className="[&_h1]:whitespace-normal">
        <AppHeader backHref="/plans" title={program.name} />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <TemplateAudienceBadge audience={program.audience === "Para mujeres" ? "mujeres" : "general"} />
        <Badge variant="secondary">{program.sessions.length} días por semana</Badge>
        <Badge variant="outline">{program.level}</Badge>
        <Badge variant="outline">{program.focus}</Badge>
      </div>
      <p className="mt-4 leading-7">{program.description}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Disponible para cualquier persona que comparta este objetivo. Elige según tu experiencia y el tiempo que puedes dedicar.</p>
      {hasPdfProgram(template.id) && <section className="mt-5 border-y border-border py-4" aria-label="Versión del programa">
        <p className="text-sm font-semibold">{pdf ? `Programa de 8 microciclos · Microciclo ${microcycle} de 8` : "Objetivos estables"}</p>
        <ButtonLink variant="outline" className="mt-3 min-h-11" href={`/plans/programs/${template.id}${pdf ? "" : "?version=pdf&microcycle=1"}`}>
          {pdf ? "Ver versión con objetivos estables" : "Ver programa de 8 microciclos"}
        </ButtonLink>
        {pdf && <form className="mt-4 flex flex-wrap items-end gap-3" method="get">
          <input type="hidden" name="version" value="pdf" />
          <label className="grid gap-2 text-sm">Microciclo a consultar
            <select name="microcycle" defaultValue={microcycle} className="min-h-11 rounded-lg border border-input bg-background px-3 text-foreground">
              {Array.from({ length: 8 }, (_, index) => <option key={index} value={index + 1}>Microciclo {index + 1}</option>)}
            </select>
          </label>
          <button type="submit" className="min-h-11 rounded-lg border border-border px-4 text-sm font-medium">Ver microciclo</button>
        </form>}
      </section>}
      <dl className="mt-5 space-y-3 text-sm leading-6">
        <div><dt className="font-semibold">Tiempo orientativo</dt><dd className="text-muted-foreground">{program.duration}. Depende de tus descansos y del gimnasio.</dd></div>
        <div><dt className="font-semibold">Material</dt><dd className="text-muted-foreground">{program.equipment}</dd></div>
      </dl>

      <section className="mt-8" aria-labelledby="week-heading">
        <h2 id="week-heading" className="text-xl font-semibold">Tu semana</h2>
        <ol className="mt-4 divide-y divide-border border-y border-border">
          {[1, 2, 3, 4, 5, 6, 0].map((day) => (
            <li key={day} className="grid grid-cols-[6rem_1fr] gap-3 py-3 text-sm">
              <span className="font-medium">{PROGRAM_WEEKDAYS[day]}</span>
              {days.has(day) ? <a className="min-h-6 underline underline-offset-4" href={`#session-${day}`}>{program.sessions.find((item) => item.weekday === day)?.name}</a> : <span className="text-muted-foreground">Descanso</span>}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{program.instructions}</p>
      </section>

      <section className="mt-8" aria-labelledby="effort-heading">
        <h2 id="effort-heading" className="text-xl font-semibold">Carga, esfuerzo y progresión</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{pdf ? "RIR indica cuántas repeticiones más podrías realizar. Sigue el esfuerzo de cada serie y ajusta la carga para conservar técnica. Las aproximaciones no cuentan en las series prescritas. Los drop sets se registran como una serie adicional, con la carga reducida que realmente utilices; no hay un objetivo fijo de repeticiones ni de reducción de carga." : PROGRAM_GUIDANCE}</p>
        {!pdf && <p className="mt-3 text-sm leading-7 text-muted-foreground">{PROGRAM_PROGRESSION}</p>}
      </section>

      {program.sessions.map((day) => (
        <section id={`session-${day.weekday}`} key={day.weekday} className="mt-10 scroll-mt-6" aria-labelledby={`heading-${day.weekday}`}>
          <h2 id={`heading-${day.weekday}`} className="text-xl font-semibold">{PROGRAM_WEEKDAYS[day.weekday]} · {day.name}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{day.exercises.length} ejercicios · {day.exercises.reduce((total, exercise) => total + exercise.sets, 0)} series de trabajo</p>
          <ol className="mt-4 divide-y divide-border">
            {day.exercises.map((exercise, index) => (
              <li key={exercise.name} className="py-4">
                <h3 className="font-semibold">{index + 1}. {exercise.name}</h3>
                <p className="mt-1 text-sm font-medium">{formatTarget({ ...exercise, targetSets: exercise.sets, targetRepsMin: exercise.repsMin, targetRepsMax: exercise.repsMax })}</p>
                <SetPrescription value={exercise.prescription} />
                <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">{exercise.notes}</p>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <div className="mt-8 border-t border-border pt-2">
        <ProgramTemplateForm programId={program.id} microcycle={pdf ? microcycle : undefined} />
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Se añadirán las {program.sessions.length} sesiones a tus planes con estos días sugeridos. Podrás editarlas o moverlas por separado. Si ya tienes otros planes, revisa la carga total de tu semana antes de combinarlos.</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Para entrenar sin conexión, espera a que Planes confirme que las sesiones están guardadas en este dispositivo.</p>
      </div>
      <section className="mt-10 border-t border-border pt-6" aria-labelledby="sources-heading">
        <h2 id="sources-heading" className="font-semibold">Sobre este programa</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{pdf ? "Programa de 8 microciclos con objetivos por serie. El cambio de microciclo es manual. Los descansos y días de la semana son orientativos; ajusta la distribución a tu disponibilidad y recuperación." : "Programa con objetivos estables. Es un punto de partida general que puedes ajustar según tu experiencia, disponibilidad y recuperación."}</p>
      </section>
    </main>
  );
}
