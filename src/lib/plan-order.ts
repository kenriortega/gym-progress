import type { Discipline } from "./training-blocks";

/** Prioriza coincidencias sin mutar ni alterar el orden relativo del listado. */
export function prioritizePlans<T extends { discipline?: Discipline | null }>(
  plans: readonly T[],
  discipline: Discipline,
): T[] {
  const matches = (plan: T) => (plan.discipline ?? "strength") === discipline;
  return [...plans.filter(matches), ...plans.filter((plan) => !matches(plan))];
}
