import { dayOf, localDate } from "@/lib/dates";

/** Lo mínimo que la resolución necesita saber de un plan. */
export type SchedulablePlan = {
  id: string;
  name: string;
  /** 0 es domingo, como `Date.getDay()`. Null si el plan no tiene día fijo. */
  weekday: number | null;
};

export type Reschedule = {
  planId: string;
  /** "YYYY-MM-DD". */
  fromDate: string;
  toDate: string;
};

export type ScheduledPlan<T extends SchedulablePlan> = {
  plan: T;
  /** El día del que viene, cuando llega movido. Null si le toca de verdad. */
  movedFrom: string | null;
};

/** Los próximos siete días a partir de mañana, para elegir destino. */
export function nextDays(from: Date, count = 7) {
  const days: string[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let index = 0; index < count; index++) {
    cursor.setDate(cursor.getDate() + 1);
    days.push(dayOf(cursor));
  }
  return days;
}

/**
 * El próximo día en que toca un plan, hoy incluido. Es el `fromDate` de un
 * movimiento: mover "el martes" significa mover el martes que viene, no todos.
 */
export function nextOccurrence(weekday: number | null, from: Date) {
  if (weekday === null) return null;
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  cursor.setDate(cursor.getDate() + ((weekday - cursor.getDay() + 7) % 7));
  return dayOf(cursor);
}

/**
 * Qué planes tocan un día concreto, resuelto en dos pasos: los que le tocan por
 * su día de la semana y no se han movido fuera, más los que llegan movidos
 * desde otro día.
 *
 * Permite que coincidan varios: mover el martes a un jueves que ya tiene plan
 * es "esta semana hago doble", que es el caso real, y no algo que impedir.
 */
export function plansOn<T extends SchedulablePlan>(
  plans: T[],
  reschedules: Reschedule[],
  day: string,
): ScheduledPlan<T>[] {
  const movedAway = new Set(
    reschedules
      .filter((item) => item.fromDate === day)
      .map((item) => item.planId),
  );
  const movedIn = new Map(
    reschedules
      .filter((item) => item.toDate === day)
      .map((item) => [item.planId, item.fromDate]),
  );
  const weekday = localDate(day).getDay();

  const native = plans
    .filter(
      (plan) =>
        plan.weekday === weekday &&
        !movedAway.has(plan.id) &&
        !movedIn.has(plan.id),
    )
    .map((plan) => ({ plan, movedFrom: null }));

  const arriving = plans
    .filter((plan) => movedIn.has(plan.id))
    .map((plan) => ({ plan, movedFrom: movedIn.get(plan.id) ?? null }));

  return [...native, ...arriving];
}

/** El movimiento vigente de un plan, si lo tiene por delante. */
export const rescheduleOf = (
  reschedules: Reschedule[],
  planId: string,
  today: string,
) =>
  reschedules.find((item) => item.planId === planId && item.toDate >= today) ??
  null;
