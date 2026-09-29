export type ProgressionSession = {
  targetSets: number | null;
  targetRepsMax: number | null;
  sets: Array<{ reps: number; weight: number }>;
};

export type ProgressionSuggestion = {
  fromWeight: number;
  toWeight: number;
  increment: number;
};

/** Sesiones seguidas en el tope del rango antes de sugerir más peso. */
export const SESSIONS_TO_PROGRESS = 2;

/** Salto más pequeño que se puede montar con discos de 1.25 kg por lado. */
export function weightIncrementFor(weight: number): number {
  return weight < 20 ? 1.25 : 2.5;
}

/**
 * Peso con el que se completaron todas las series objetivo en el tope del
 * rango, o null si la sesión no llegó ahí. Se toma el peso más bajo de esas
 * series: es el que se sostuvo durante todo el ejercicio.
 */
function weightClearingTopOfRange(session: ProgressionSession): number | null {
  const { targetSets, targetRepsMax } = session;
  if (targetSets === null || targetRepsMax === null) {
    return null;
  }

  const atTop = session.sets.filter((set) => set.reps >= targetRepsMax);
  if (atTop.length < targetSets) {
    return null;
  }

  return Math.min(...atTop.map((set) => set.weight));
}

/**
 * Progresión doble: las repeticiones suben dentro del rango y, cuando el rango
 * se agota durante SESSIONS_TO_PROGRESS sesiones seguidas, lo que sube es el
 * peso. El objetivo del plan no se toca.
 *
 * `sessions` llega de la más reciente a la más antigua.
 */
export function suggestProgression(
  sessions: ProgressionSession[],
): ProgressionSuggestion | null {
  if (sessions.length < SESSIONS_TO_PROGRESS) {
    return null;
  }

  const weights = sessions
    .slice(0, SESSIONS_TO_PROGRESS)
    .map(weightClearingTopOfRange);

  if (weights.some((weight) => weight === null)) {
    return null;
  }

  const fromWeight = weights[0] as number;
  const increment = weightIncrementFor(fromWeight);

  return {
    fromWeight,
    increment,
    toWeight: Math.round((fromWeight + increment) * 100) / 100,
  };
}
