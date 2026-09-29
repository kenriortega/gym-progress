export type ProgressionSession = {
  performedAt: Date;
  targetSets: number | null;
  targetRepsMax: number | null;
  sets: Array<{ reps: number; weight: number }>;
};

export type ProgressionSuggestion = {
  fromWeight: number;
  toWeight: number;
  increment: number;
  /** Sesiones seguidas cerrando el rango. */
  sessions: number;
  /** Días naturales que llevas con ese peso cerrando el rango. */
  days: number;
};

/** Sesiones seguidas en el tope del rango antes de sugerir más peso. */
export const SESSIONS_TO_PROGRESS = 2;

/**
 * Días naturales mínimos entre la primera y la última sesión en el tope antes
 * de sugerir más peso. Cumplir el rango dos días seguidos no significa que el
 * cuerpo esté listo para más carga: el tejido conectivo tarda más que la
 * fuerza en adaptarse, y subir cada dos días es una vía rápida a la lesión.
 */
export const MIN_DAYS_TO_PROGRESS = 7;

const MS_PER_DAY = 86_400_000;

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
 * Progresión doble con freno temporal: las repeticiones suben dentro del rango
 * y, cuando el rango se agota durante varias sesiones seguidas *y* ha pasado
 * tiempo suficiente, lo que sube es el peso. El objetivo del plan no se toca.
 *
 * `sessions` llega de la más reciente a la más antigua.
 */
export function suggestProgression(
  sessions: ProgressionSession[],
): ProgressionSuggestion | null {
  // Racha de sesiones en el tope, contando desde la más reciente hacia atrás.
  const streak: Array<{ performedAt: Date; weight: number }> = [];
  for (const session of sessions) {
    const weight = weightClearingTopOfRange(session);
    if (weight === null) {
      break;
    }
    streak.push({ performedAt: session.performedAt, weight });
  }

  if (streak.length < SESSIONS_TO_PROGRESS) {
    return null;
  }

  const newest = streak[0].performedAt.getTime();
  const oldest = streak[streak.length - 1].performedAt.getTime();
  const days = Math.floor((newest - oldest) / MS_PER_DAY);

  if (days < MIN_DAYS_TO_PROGRESS) {
    return null;
  }

  const fromWeight = streak[0].weight;
  const increment = weightIncrementFor(fromWeight);

  return {
    fromWeight,
    increment,
    toWeight: Math.round((fromWeight + increment) * 100) / 100,
    sessions: streak.length,
    days,
  };
}
