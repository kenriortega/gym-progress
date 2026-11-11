import { dayOf, localDate } from "@/lib/dates";
import { plansOn, type Reschedule, type SchedulablePlan } from "@/lib/schedule";
import { shortPlanName } from "@/lib/plan-name";

/**
 * La semana en curso: qué tocaba cada día y qué hiciste.
 *
 * El mapa de constancia responde por el año y no dice nada del lunes que
 * tienes delante. Esto responde «qué llevo de esta semana y qué me toca hoy»,
 * que es la pregunta con la que se abre la aplicación.
 *
 * Mira si hubo entrenamiento, no cuántos kilos: un día de dominadas y fondos
 * mueve cero kilos de carga externa y es un día entrenado como cualquier otro.
 *
 * Y mira cuál: un día no está hecho porque entrenaras, sino porque entrenaras
 * lo que tocaba. Cambiar de programa dejaba los entrenos del anterior
 * marcando los días del nuevo, que decía «4 de 5» de un plan sin estrenar.
 */
export type StripState =
  /** Tocaba y lo hiciste. */
  | "hecho"
  /** Tocaba, entrenaste, pero otra cosa. */
  | "otro"
  /** Toca hoy y aún no. Un día no ha fallado hasta que termina. */
  | "hoy"
  /** Toca más adelante esta semana. */
  | "pendiente"
  /** Tocaba, pasó, y no fue. */
  | "perdido"
  /** No tocaba nada. */
  | "libre"
  /** No tocaba y entrenaste igual. */
  | "extra";

/** Un día entrenado y a qué planes se vincularon sus sesiones. */
export type TrainedSession = { day: string; planId: string | null };

export type StripDay = {
  day: string;
  /** Inicial para la cabecera, de lunes a domingo. */
  label: string;
  state: StripState;
  /** Nombres cortos de los planes de ese día, en orden. */
  plans: string[];
};

/** Lunes primero: es como van las columnas del mapa de constancia. */
const LABELS = ["L", "M", "X", "J", "V", "S", "D"];

/** El lunes de la semana a la que pertenece `today`. */
export function mondayOf(today: Date): Date {
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

export function weekStripOf<T extends SchedulablePlan>({
  plans,
  reschedules,
  sessions,
  today = new Date(),
}: {
  plans: T[];
  reschedules: Reschedule[];
  /** Entrenamientos terminados, con el plan del que salió cada uno. */
  sessions: Iterable<TrainedSession>;
  today?: Date;
}): StripDay[] {
  const porDia = new Map<string, Set<string | null>>();
  for (const session of sessions) {
    const planes = porDia.get(session.day) ?? new Set<string | null>();
    planes.add(session.planId);
    porDia.set(session.day, planes);
  }
  const hoy = dayOf(today);
  // El cursor avanza con setDate y no sumando milisegundos: el domingo del
  // cambio de hora dura 25 horas y la semana entera se correría un día.
  const cursor = mondayOf(today);

  const days: StripDay[] = [];
  for (let index = 0; index < 7; index++) {
    const day = dayOf(cursor);
    const scheduled = plansOn(plans, reschedules, day);
    const entrenados = porDia.get(day);
    const entrenaste = entrenados !== undefined;
    const tocaba = scheduled.length > 0;
    // Hecho es haber entrenado alguno de los planes que tocaban ese día.
    const cumplido = Boolean(entrenados) && scheduled.some((item) => entrenados!.has(item.plan.id));

    const state: StripState = !tocaba
      ? entrenaste
        ? "extra"
        : "libre"
      : cumplido
        ? "hecho"
        : entrenaste
          ? "otro"
          : day === hoy
            ? "hoy"
            : day < hoy
              ? "perdido"
              : "pendiente";

    days.push({
      day,
      label: LABELS[index]!,
      state,
      plans: scheduled.map((item) => shortPlanName(item.plan.name)),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/**
 * «3 de 5»: lo hecho sobre lo que la semana pedía. Ni los días extra ni los
 * que entrenaste otra cosa cuentan como cumplidos; los previstos sí los
 * incluyen, porque el plan seguía tocando.
 */
export function weekTally(days: StripDay[]) {
  const previstos = days.filter((item) => item.state !== "libre" && item.state !== "extra").length;
  const hechos = days.filter((item) => item.state === "hecho").length;
  return {
    hechos,
    previstos,
    extras: days.filter((item) => item.state === "extra").length,
    otros: days.filter((item) => item.state === "otro").length,
  };
}

/** Comparar cadenas "YYYY-MM-DD" ordena por fecha; esto solo lo documenta. */
export const sameWeek = (day: string, today: Date) => {
  const monday = dayOf(mondayOf(today));
  const sunday = dayOf(new Date(localDate(monday).getFullYear(), localDate(monday).getMonth(), localDate(monday).getDate() + 6));
  return day >= monday && day <= sunday;
};
