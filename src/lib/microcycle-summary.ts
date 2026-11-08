import data from "./pdf-programs.json";
import { parsePdfCell } from "./set-prescription";

/**
 * Qué pide cada microciclo de un programa, en tres números.
 *
 * El programa es una tabla de ocho columnas que solo se ve de una en una: al
 * elegir un número en el desplegable no sabes a qué te apuntas, y en la tercera
 * semana a RIR 3 parece que no avanzas aunque el programa esté subiendo.
 *
 * Las celdas las lee `parsePdfCell`, que ya valida la notación del PDF. No
 * escribo otro analizador: una expresión regular propia juntaba el «RIR1» de
 * una línea con el «3x» de la siguiente y contaba trece series donde había una.
 */
export type MicrocycleSummary = {
  microcycle: number;
  /** Series de trabajo de toda la semana, sin contar los drop sets. */
  sets: number;
  dropSets: number;
  /** Series llevadas al fallo (RIR 0). El rango no las distingue: del cuarto al
   *  quinto microciclo sigue siendo «RIR 0–2» y sin embargo hay más. */
  failureSets: number;
  /** Repeticiones en reserva: el rango de la semana y su media ponderada por serie. */
  rirMin: number;
  rirMax: number;
  rirAverage: number;
};

export const MICROCYCLES = 8;

export function microcycleSummaries(programId: string): MicrocycleSummary[] | null {
  const program = data.programs.find((item) => item.id === programId);
  if (!program) return null;

  return Array.from({ length: MICROCYCLES }, (_, index) => {
    const microcycle = index + 1;
    let sets = 0;
    let dropSets = 0;
    const rirs: number[] = [];

    for (const session of program.sessions) {
      for (const exercise of session.exercises) {
        for (const set of parsePdfCell(exercise.microcycles[index]!)) {
          if (set.kind === "drop") {
            dropSets += 1;
            continue;
          }
          sets += 1;
          // El objetivo es el extremo exigente del rango: «RIR 2-3» se trabaja a 2.
          if (set.rirMin !== null) rirs.push(set.rirMin);
        }
      }
    }

    return {
      microcycle,
      sets,
      dropSets,
      failureSets: rirs.filter((rir) => rir === 0).length,
      rirMin: rirs.length ? Math.min(...rirs) : 0,
      rirMax: rirs.length ? Math.max(...rirs) : 0,
      rirAverage: rirs.length ? rirs.reduce((total, rir) => total + rir, 0) / rirs.length : 0,
    };
  });
}

/** «RIR 3» cuando toda la semana va igual; «RIR 0–2» cuando no. */
export const rirLabel = (summary: MicrocycleSummary) =>
  summary.rirMin === summary.rirMax ? `RIR ${summary.rirMin}` : `RIR ${summary.rirMin}–${summary.rirMax}`;

/**
 * Qué cambia al pasar de un microciclo a otro, en frases.
 *
 * Dicho en lo que vas a notar —series de más, repeticiones que dejas de
 * reservar, series que acaban en drop set— y no en porcentajes: «+12 %» no
 * dice qué hacer el lunes.
 */
export function microcycleDiff(from: MicrocycleSummary, to: MicrocycleSummary): string[] {
  if (from.microcycle === to.microcycle) return [];
  const lines: string[] = [];

  const sets = to.sets - from.sets;
  if (sets !== 0) {
    lines.push(`${sets > 0 ? "+" : "−"}${Math.abs(sets)} series en la semana, de ${from.sets} a ${to.sets}.`);
  }

  if (to.rirAverage !== from.rirAverage) {
    const esfuerzo = to.rirAverage < from.rirAverage ? "Más cerca del fallo" : "Más margen";
    if (rirLabel(to) === rirLabel(from)) {
      // Mismo rango, distinto reparto: lo que cambia es cuántas series lo apuran.
      lines.push(`${esfuerzo}: ${to.failureSets} series al fallo, frente a ${from.failureSets} ahora.`);
    } else {
      const reserva =
        to.rirMin === 0 && to.rirMax === 0
          ? "todas las series al fallo, sin reserva"
          : `paras con ${rirLabel(to).replace("RIR ", "")} ${to.rirMax === 1 ? "repetición" : "repeticiones"} en reserva`;
      lines.push(`${esfuerzo}: ${reserva}, frente a ${rirLabel(from).replace("RIR ", "")} ahora.`);
    }
  }

  const drops = to.dropSets - from.dropSets;
  if (drops > 0) {
    lines.push(
      from.dropSets === 0
        ? `Aparecen los drop sets: ${to.dropSets} series acaban bajando el peso sin descanso.`
        : `+${drops} drop sets, de ${from.dropSets} a ${to.dropSets}.`,
    );
  } else if (drops < 0) {
    lines.push(to.dropSets === 0 ? "Sin drop sets." : `−${Math.abs(drops)} drop sets, de ${from.dropSets} a ${to.dropSets}.`);
  }

  if (!lines.length) lines.push("Mismo volumen y mismo esfuerzo: cambia el reparto dentro de las sesiones.");
  return lines;
}
