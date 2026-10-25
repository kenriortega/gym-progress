import { dayOf } from "@/lib/dates";

/** Un día entrenado: la fecha y el volumen total movido, en kg. */
export type TrainedDay = { day: string; volume: number };

export type HeatCell = {
  day: string;
  volume: number;
  /** 0 sin entrenar, 1 a 4 de menos a más volumen. */
  level: 0 | 1 | 2 | 3 | 4;
};

export const WEEKS = 53;
const DAYS = WEEKS * 7;

/**
 * Los cortes salen de los cuartiles de tus propios días entrenados, no del
 * máximo. Una sesión de piernas mueve el triple que una de brazos, y con una
 * escala sobre el máximo esa única sesión dejaría el resto del año en el tono
 * más bajo: el mapa diría "entrenaste un día" cuando entrenaste cien.
 */
function cutsOf(volumes: number[]) {
  const sorted = [...volumes].sort((a, b) => a - b);
  const at = (fraction: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]!;
  return [at(0.25), at(0.5), at(0.75)];
}

const levelOf = (volume: number, cuts: number[]): HeatCell["level"] => {
  if (volume <= 0) return 0;
  if (volume <= cuts[0]!) return 1;
  if (volume <= cuts[1]!) return 2;
  if (volume <= cuts[2]!) return 3;
  return 4;
};

/**
 * La rejilla de las últimas 53 semanas, por columnas de lunes a domingo. La
 * última columna es la semana en curso, así que hoy cae siempre a la derecha.
 */
export function heatmapOf(trained: TrainedDay[], today = new Date()): HeatCell[][] {
  const volumes = new Map(trained.map((item) => [item.day, item.volume]));
  const cuts = cutsOf(trained.map((item) => item.volume).filter((volume) => volume > 0));

  // El domingo de esta semana: así la última columna queda completa y hoy no
  // se sale de la rejilla.
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const weekday = (end.getDay() + 6) % 7; // lunes = 0
  end.setDate(end.getDate() + (6 - weekday));

  // El cursor avanza con setDate, no restando milisegundos: el último domingo
  // de octubre dura 25 horas, y con días de 86.400.000 ms fijos la rejilla
  // entera se corría un día y las filas empezaban en domingo.
  const cursor = new Date(end);
  cursor.setDate(cursor.getDate() - (WEEKS * 7 - 1));

  const weeks: HeatCell[][] = [];
  for (let week = 0; week < WEEKS; week++) {
    const column: HeatCell[] = [];
    for (let weekday = 0; weekday < 7; weekday++) {
      const day = dayOf(cursor);
      const volume = volumes.get(day) ?? 0;
      column.push({ day, volume, level: volumes.has(day) && volume === 0 ? 1 : levelOf(volume, cuts) });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(column);
  }
  return weeks;
}

/** Cuántos días de los últimos 365 entrenaste, para el titular de la tarjeta. */
export const trainedDaysIn = (weeks: HeatCell[][]) =>
  weeks.flat().filter((cell) => cell.level > 0).length;

/** La racha de semanas seguidas con al menos un entreno, contando hacia atrás. */
export function weekStreakOf(weeks: HeatCell[][]) {
  let streak = 0;
  for (let index = weeks.length - 1; index >= 0; index--) {
    if (!weeks[index]!.some((cell) => cell.level > 0)) break;
    streak++;
  }
  return streak;
}

export { DAYS };
