import {
  CalculatorIcon,
  ClipboardListIcon,
  FlagIcon,
  HistoryIcon,
  PlayIcon,
  PlusIcon,
  TimerIcon,
  TrendingUpIcon,
  type LucideIcon,
} from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
type Step = {
  Icon: LucideIcon;
  title: string;
  body: string;
};
const STEPS: Step[] = [
  {
    Icon: ClipboardListIcon,
    title: "Arma tus días",
    body: "Solo la primera vez. Creas un plan por día, por ejemplo «Lunes: pierna», y le pones los ejercicios en el orden en que los haces.",
  },
  {
    Icon: PlayIcon,
    title: "Abre la app y empieza",
    body: "Al entrar te sale el plan que toca hoy. Le das a Empezar y ya tienes todos los ejercicios cargados.",
  },
  {
    Icon: PlusIcon,
    title: "Anota cada serie",
    body: "Son dos números: el peso y las repeticiones que hiciste. Le das a «+ Serie» y a por la siguiente.",
  },
  {
    Icon: FlagIcon,
    title: "Termina",
    body: "Le das a Finalizar sesión y listo. La próxima vez que toque ese ejercicio verás estos números.",
  },
];
const HELPERS: Step[] = [
  {
    Icon: HistoryIcon,
    title: "Te recuerda la última vez",
    body: "Encima de cada ejercicio aparece lo que hiciste el día anterior, serie por serie. No tienes que acordarte de nada.",
  },
  {
    Icon: TrendingUpIcon,
    title: "Te avisa cuándo subir peso",
    body: "Cuando llevas al menos una semana completando todas las series en el tope de repeticiones, te propone el peso siguiente. Espera esa semana a propósito: subir carga cada dos días es como se llega a las lesiones.",
  },
  {
    Icon: CalculatorIcon,
    title: "Te calcula el peso",
    body: "Le dices qué discos tienes puestos, en kilos o en libras, y te da el total. Sirve igual para una mancuerna o un disco suelto.",
  },
  {
    Icon: TimerIcon,
    title: "Te cronometra el descanso",
    body: "En cuanto guardas una serie arranca solo. Eliges si quieres uno, uno y medio, dos o tres minutos.",
  },
];
function StepCard({ Icon, title, body }: Step) {
  return (
    <Card className="flex-row items-start gap-4 p-4">
      <Badge
        variant="secondary"
        className="size-10 shrink-0 justify-center rounded-xl"
      >
        <Icon className="size-4" />
      </Badge>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
      </div>
    </Card>
  );
}
export default async function HelpPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return (
    <main className="mx-auto min-h-dvh w-full max-w-md md:max-w-3xl lg:max-w-5xl px-5 pb-12 pt-6">
      <AppHeader backHref="/" eyebrow="Guía rápida" title="Cómo usarla" />
      <Card className="mt-7 bg-primary p-5 text-primary-foreground">
        <CardHeader className="p-0">
          <CardTitle className="text-xl leading-snug">
            Una libreta de gimnasio que se acuerda por ti
          </CardTitle>
          <CardDescription className="text-primary-foreground/75">
            Antes de cada serie te enseña lo que levantaste la última vez, y te
            avisa cuando ya toca subir peso.
          </CardDescription>
        </CardHeader>
      </Card>
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">
          Tu día, en cuatro pasos
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {STEPS.map((step, index) => (
            <div key={step.title} className="relative">
              <Badge className="absolute -left-1 -top-1 z-10 size-6 justify-center rounded-full p-0 text-[11px]">
                {index + 1}
              </Badge>
              <StepCard {...step} />
            </div>
          ))}
        </div>
      </section>
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">
          Lo que hace por ti
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {HELPERS.map((helper) => (
            <StepCard key={helper.title} {...helper} />
          ))}
        </div>
      </section>
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">
          Dos cosas que conviene saber
        </h2>
        <Card className="mt-4 gap-3 p-5">
          <CardDescription>
            Los entrenamientos siempre salen de un plan. Si quieres entrenar algo
            distinto, crea un plan nuevo o añade el ejercicio sobre la marcha
            desde la propia sesión.
          </CardDescription>
          <CardDescription>
            Todos los pesos se guardan en kilos. Si tu gimnasio tiene discos en
            libras, usa la calculadora y ella los convierte.
          </CardDescription>
        </Card>
      </section>
    </main>
  );
}
