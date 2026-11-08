import { dayOf, localDate } from "@/lib/dates";
import { plansOn, type Reschedule, type SchedulablePlan } from "@/lib/schedule";

/**
 * La semana en curso: qué tocaba cada día y qué hiciste.
 *
 * El mapa de constancia responde por el año y no dice nada del lunes que
 * tienes delante. Esto responde «qué llevo de esta semana y qué me toca hoy»,
 * que es la pregunta con la que se abre la aplicación.
 *
 * Mira si hubo entrenamiento, no cuántos kilos: un día de dominadas y fondos
 * mueve cero kilos de carga externa y es un día entrenado como cualquier otro.
 */
export type StripState =
  /** Tocaba y lo hiciste. */
  | "hecho"
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

/**
 * «Especialización · Brazos · 8 microciclos · PIERNA 1» no cabe bajo una
 * inicial.
 *
 * El último tramo es el que distingue una sesión del programa de sus hermanas
 * —«Pierna 1», «Torso 2»— y es el que se dice en voz alta. Pero no siempre:
 * en «Día suave · Barras, core y carrera» el último tramo es la lista de lo
 * que hay dentro y el primero es el nombre. Así que el último si cabe, y si no
 * el primero, que en esos nombres es el corto.
 */
export function shortPlanName(name: string, max = 12): string {
  const parts = name.split("·").map((part) => part.trim()).filter(Boolean);
  const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  const last = capitalise(parts.at(-1) ?? name.trim());
  if (last.length <= max) return last;
  const first = capitalise(parts[0] ?? name.trim());
  if (first.length <= max) return first;
  return `${last.slice(0, max - 1).trimEnd()}…`;
}

/** El lunes de la semana a la que pertenece `today`. */
export function mondayOf(today: Date): Date {
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

export function weekStripOf<T extends SchedulablePlan>({
  plans,
  reschedules,
  trainedDays,
  today = new Date(),
}: {
  plans: T[];
  reschedules: Reschedule[];
  /** Días con un entrenamiento terminado, en "YYYY-MM-DD". */
  trainedDays: Iterable<string>;
  today?: Date;
}): StripDay[] {
  const trained = new Set(trainedDays);
  const hoy = dayOf(today);
  // El cursor avanza con setDate y no sumando milisegundos: el domingo del
  // cambio de hora dura 25 horas y la semana entera se correría un día.
  const cursor = mondayOf(today);

  const days: StripDay[] = [];
  for (let index = 0; index < 7; index++) {
    const day = dayOf(cursor);
    const scheduled = plansOn(plans, reschedules, day);
    const hecho = trained.has(day);
    const tocaba = scheduled.length > 0;

    const state: StripState = hecho
      ? tocaba
        ? "hecho"
        : "extra"
      : !tocaba
        ? "libre"
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

/** «3 de 5»: lo hecho sobre lo que la semana pedía. Los extras no inflan el total. */
export function weekTally(days: StripDay[]) {
  const previstos = days.filter((item) => item.state !== "libre" && item.state !== "extra").length;
  const hechos = days.filter((item) => item.state === "hecho").length;
  return { hechos, previstos, extras: days.filter((item) => item.state === "extra").length };
}

/** Comparar cadenas "YYYY-MM-DD" ordena por fecha; esto solo lo documenta. */
export const sameWeek = (day: string, today: Date) => {
  const monday = dayOf(mondayOf(today));
  const sunday = dayOf(new Date(localDate(monday).getFullYear(), localDate(monday).getMonth(), localDate(monday).getDate() + 6));
  return day >= monday && day <= sunday;
};
