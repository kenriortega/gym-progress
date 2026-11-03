import { ButtonLink } from "@/components/button-link";
import { Badge } from "@/components/ui/badge";
import { TemplateAudienceBadge } from "@/components/template-audience-badge";
import { PROGRAM_TEMPLATES, PROGRAM_WEEKDAYS } from "@/lib/program-templates";

export function ProgramTemplates() {
  return (
    <section className="mt-10" aria-labelledby="programs-heading">
      <h2 id="programs-heading" className="text-xl font-semibold">Elige un programa completo</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Encuentra programas orientados a mujeres y propuestas generales. Todos están disponibles para ti: elige según tu experiencia, los días que puedes mantener y tu objetivo.</p>
      <div className="mt-5 divide-y divide-border border-y border-border">
        {PROGRAM_TEMPLATES.map((program) => (
          <article key={program.id} className="grid gap-4 py-6 md:grid-cols-[1fr_auto] md:gap-6">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <TemplateAudienceBadge audience={program.audience === "Para mujeres" ? "mujeres" : "general"} />
                <Badge variant="secondary">{program.sessions.length} días por semana</Badge>
                <Badge variant="outline">{program.level}</Badge>
              </div>
              <h3 className="mt-3 text-lg font-semibold">{program.name}</h3>
              <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">{program.description}</p>
              <p className="mt-3 text-sm">{program.duration} · estimado</p>
              <p className="mt-1 text-sm text-muted-foreground">{program.sessions.map((session) => PROGRAM_WEEKDAYS[session.weekday]).join(" · ")}</p>
            </div>
            <ButtonLink href={`/plans/programs/${program.id}`} variant="outline" className="min-h-11 self-center">
              Ver programa
            </ButtonLink>
          </article>
        ))}
      </div>
    </section>
  );
}
