import data from "./pdf-programs.json";
import type { ProgramTemplate } from "./program-templates";
import { parsePdfCell, prescriptionTargets } from "./set-prescription";

export function hasPdfProgram(id: string): boolean {
  return data.programs.some((program) => program.id === id);
}

export function pdfProgram(template: ProgramTemplate, microcycle: number): ProgramTemplate {
  const original = data.programs.find((program) => program.id === template.id);
  if (!original || !Number.isInteger(microcycle) || microcycle < 1 || microcycle > 8) throw new Error("Programa o microciclo inválido.");
  return {
    ...template, name: `${template.name} · 8 microciclos`, level: "Programación de 8 microciclos",
    description: "Programa de ocho microciclos con objetivos de repeticiones y esfuerzo para cada serie. Consulta las cuatro sesiones antes de añadirlo a tus planes.",
    duration: "Variable según el microciclo y los descansos",
    equipment: "Máquinas, multipower, poleas, mancuernas y rueda abdominal según cada sesión. Revisa todos los ejercicios antes de añadir el programa.",
    instructions: "Tú decides cuándo cambiar de microciclo; no avanza por calendario. El cambio se aplica con conexión a las sesiones activas de esta copia. Conserva el microciclo si necesitas más tiempo de recuperación. Los últimos microciclos incluyen trabajo a RIR 0 y drop sets; revisa si ese esfuerzo encaja con tu experiencia.",
    sessions: original.sessions.map((session, sessionIndex) => ({
      name: session.heading.replace(/^DÍA\s+\d+:\s*/i, ""), weekday: template.sessions[sessionIndex].weekday,
      exercises: session.exercises.map((exercise, exerciseIndex) => {
        const raw = exercise.microcycles[microcycle - 1];
        const targets = prescriptionTargets({ programId: template.id, microcycle, sessionIndex, exerciseIndex,
          page: session.page, raw, sets: parsePdfCell(raw) });
        return {
          name: exercise.name, muscleGroup: exercise.muscleGroup,
          loadType: exercise.loadType as "bodyweight" | "external", measurement: "reps" as const,
          sets: targets.targetSets, repsMin: targets.targetRepsMin, repsMax: targets.targetRepsMax,
          prescription: targets.prescription,
          notes: "Consulta los objetivos de cada serie. Calienta y haz aproximaciones antes del trabajo. Descansa lo necesario para conservar la técnica (orientativamente 2–3 min en movimientos principales y 60–120 s en accesorios). Los drop sets no tienen un objetivo fijo de repeticiones ni de reducción de carga; registra lo que realices.",
        };
      }),
    })),
  };
}
