import type { TemplateExercise } from "./plan-templates";

export type ProgramExercise = TemplateExercise & { muscleGroup: string; notes: string };
export type ProgramSession = {
  name: string;
  weekday: number;
  exercises: ProgramExercise[];
};
export type ProgramTemplate = {
  id: string;
  name: string;
  description: string;
  level: string;
  audience: "Para mujeres" | "General";
  focus: string;
  duration: string;
  equipment: string;
  instructions: string;
  source: (typeof PROGRAM_SOURCES)[number];
  sessions: ProgramSession[];
};

export const PROGRAM_SOURCES = [
  { title: "Rutinas para mujeres por niveles · Fit Generation", url: "https://fitgeneration.es/rutina-gimnasio-mujeres-niveles/" },
  { title: "Rutinas de cuatro días · Fit Generation", url: "https://fitgeneration.es/5-mejores-rutinas-4-dias-frecuencia-2/" },
];
export const PROGRAM_WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export const PROGRAM_GUIDANCE = "Calienta 5–8 min y haz series de aproximación antes de los movimientos principales; no cuentan dentro del objetivo. RIR 3 significa terminar pensando que podrías hacer unas 3 repeticiones más con buena técnica. Elige la carga por ese esfuerzo, sin un peso inicial obligatorio. Si pierdes técnica o aparece dolor, detén el ejercicio y revisa la variante o la carga.";
export const PROGRAM_PROGRESSION = "Primero aumenta repeticiones dentro del rango. Cuando completes todas las series en el máximo durante dos sesiones del mismo ejercicio, separadas al menos 7 días, y mantengas el RIR y la técnica, prueba el incremento más pequeño disponible. Vuelve a la parte baja del rango. Si no recuperas bien o empeoras durante varias sesiones, reduce la carga o las series antes de añadir trabajo. No es obligatorio subir cada semana.";

const movement = (name: string, muscleGroup: string, sets: number, repsMin: number, repsMax: number, alternative: string, detail = ""): ProgramExercise => ({
  name, muscleGroup, sets, repsMin, repsMax,
  notes: `RIR 3. Descansa 90–120 s; hasta 2–3 min si lo necesitas en ejercicios grandes. Alternativa: ${alternative}.${detail ? ` ${detail}` : ""}`,
});
const plank = (sets: number): ProgramExercise => ({
  name: "Plancha abdominal", muscleGroup: "Abdomen", sets, repsMin: 0, repsMax: 0,
  measurement: "time", targetSeconds: 20, loadType: "bodyweight",
  notes: "Mantén 20 s respirando y sin perder la posición; termina antes si se deteriora. Descansa 60–90 s. Alternativa: dead bug, 6–10 repeticiones por lado. Aumenta hasta 30 s con control antes de hacer la variante más difícil.",
});

// Adaptaciones propias: objetivos estables, sin los microciclos ni drop sets del PDF.
const INITIAL_PROGRAMS: ProgramTemplate[] = [
  {
    id: "base-gluteos-3-dias",
    name: "Base · Glúteos y cuerpo completo",
    audience: "Para mujeres",
    source: PROGRAM_SOURCES[0],
    description: "Programa para mujeres que empiezan en el gimnasio: tres sesiones para aprender los movimientos y ganar confianza, con atención al glúteo y al resto del cuerpo.",
    level: "Iniciación", focus: "Glúteos y cuerpo completo", duration: "40–55 min por sesión",
    equipment: "Mancuernas, banco, poleas, prensa y máquina de curl femoral. Esterilla para la plancha.",
    instructions: "Empieza con las 2 series indicadas y deja unas 3 repeticiones en reserva; usa menos carga si todavía estás aprendiendo. Entrena lunes, miércoles y viernes o mueve las sesiones conservando un día de recuperación entre ellas. Mantén este volumen mientras mejoras técnica y regularidad.",
    sessions: [
      { name: "Completo A", weekday: 1, exercises: [
        movement("Sentadilla goblet", "Piernas", 2, 8, 12, "prensa de piernas"),
        movement("Hip thrust", "Glúteos", 2, 10, 12, "puente de glúteos"),
        movement("Press banca con mancuernas", "Pecho", 2, 8, 12, "press de pecho en máquina"),
        movement("Remo sentado en cable", "Espalda", 2, 8, 12, "remo con mancuernas y pecho apoyado"),
        movement("Curl femoral acostado", "Piernas", 2, 10, 15, "curl femoral sentado"),
        movement("Elevaciones laterales con mancuernas", "Hombros", 2, 12, 15, "elevaciones laterales en polea"),
      ] },
      { name: "Torso y glúteo", weekday: 3, exercises: [
        movement("Jalón con barra", "Espalda", 2, 8, 12, "jalón con agarre neutro"),
        movement("Press de hombros con mancuernas", "Hombros", 2, 8, 12, "press de hombros en máquina"),
        movement("Press banca con mancuernas", "Pecho", 2, 8, 12, "press de pecho en máquina"),
        movement("Step up", "Glúteos", 2, 8, 12, "zancadas con apoyo", "Repeticiones por lado; empieza sin carga y con un escalón bajo y estable."),
        movement("Curl de bíceps", "Bíceps", 2, 10, 15, "curl en polea"),
        movement("Extensión de tríceps en polea con barra recta", "Tríceps", 2, 10, 15, "extensión de tríceps con cuerda"),
      ] },
      { name: "Pierna y core", weekday: 5, exercises: [
        movement("Hip thrust", "Glúteos", 2, 10, 12, "puente de glúteos"),
        movement("Peso muerto rumano", "Piernas", 2, 8, 12, "rumano con mancuernas", "Ensaya la bisagra de cadera con carga ligera."),
        movement("Prensa de piernas", "Piernas", 2, 10, 12, "sentadilla goblet"),
        movement("Curl femoral acostado", "Piernas", 2, 10, 15, "curl femoral sentado"),
        movement("Elevación de gemelos", "Piernas", 2, 12, 15, "gemelos en prensa"),
        plank(2),
      ] },
    ],
  },
  {
    id: "equilibrio-torso-pierna-4-dias",
    name: "Equilibrio · Torso y pierna",
    audience: "General",
    source: PROGRAM_SOURCES[1],
    description: "Cuatro sesiones con dos exposiciones semanales de torso y pierna para desarrollar fuerza y músculo de forma equilibrada.",
    level: "Base técnica adquirida", focus: "Equilibrado", duration: "50–70 min por sesión",
    equipment: "Barra y soporte de sentadilla, banco, mancuernas, poleas y máquinas de piernas. Puedes usar las alternativas indicadas.",
    instructions: "Lunes torso A, martes pierna A, jueves torso B y viernes pierna B. Deja el miércoles y el fin de semana para recuperar; si mueves los días, evita repetir torso o pierna en días consecutivos. Conserva unas 3 repeticiones en reserva. Los ejercicios principales van antes de los accesorios.",
    sessions: [
      { name: "Torso A", weekday: 1, exercises: [
        movement("Press banca", "Pecho", 3, 8, 12, "press de pecho en máquina"),
        movement("Remo sentado en cable", "Espalda", 3, 8, 12, "remo con mancuernas y pecho apoyado"),
        movement("Jalón con barra", "Espalda", 2, 8, 12, "jalón con agarre neutro"),
        movement("Elevaciones laterales con mancuernas", "Hombros", 2, 12, 15, "elevaciones laterales en polea"),
        movement("Curl de bíceps", "Bíceps", 2, 10, 15, "curl en polea"),
        movement("Extensión de tríceps en polea con barra recta", "Tríceps", 2, 10, 15, "extensión de tríceps con cuerda"),
      ] },
      { name: "Pierna A", weekday: 2, exercises: [
        movement("Sentadilla", "Piernas", 3, 8, 10, "sentadilla hack o prensa"),
        movement("Peso muerto rumano", "Piernas", 3, 8, 12, "rumano con mancuernas"),
        movement("Curl femoral acostado", "Piernas", 2, 10, 15, "curl femoral sentado"),
        movement("Elevación de gemelos", "Piernas", 3, 12, 15, "gemelos en prensa"),
        plank(2),
      ] },
      { name: "Torso B", weekday: 4, exercises: [
        movement("Press inclinado con mancuernas", "Pecho", 3, 8, 12, "press inclinado en máquina"),
        movement("Jalón con barra", "Espalda", 3, 8, 12, "jalón con agarre neutro"),
        movement("Remo sentado en cable", "Espalda", 2, 8, 12, "remo con mancuernas y pecho apoyado"),
        movement("Press de hombros con mancuernas", "Hombros", 2, 8, 12, "press de hombros en máquina"),
        movement("Curl de bíceps", "Bíceps", 2, 10, 15, "curl en polea"),
        movement("Extensión de tríceps en polea con barra recta", "Tríceps", 2, 10, 15, "extensión de tríceps con cuerda"),
      ] },
      { name: "Pierna B", weekday: 5, exercises: [
        movement("Prensa de piernas", "Piernas", 3, 10, 12, "sentadilla hack"),
        movement("Hip thrust", "Glúteos", 3, 8, 12, "puente de glúteos con carga"),
        movement("Curl femoral acostado", "Piernas", 3, 10, 15, "curl femoral sentado"),
        movement("Extensión de cuádriceps", "Piernas", 2, 12, 15, "sentadilla goblet"),
        movement("Elevación de gemelos", "Piernas", 3, 12, 15, "gemelos en prensa"),
      ] },
    ],
  },
  {
    id: "prioridad-gluteos-piernas-4-dias",
    name: "Prioridad · Glúteos y piernas",
    audience: "Para mujeres",
    source: PROGRAM_SOURCES[0],
    description: "Programa para mujeres que quieren priorizar glúteos y piernas: dos días de pierna y dos de torso con un recordatorio de glúteo, manteniendo el trabajo de pecho, espalda y brazos.",
    level: "Intermedio", focus: "Glúteos y piernas", duration: "50–70 min por sesión",
    equipment: "Mancuernas, banco, poleas, prensa, máquina de curl femoral y abducción. Soporte o máquina para el hip thrust.",
    instructions: "Lunes pierna A, martes torso A, jueves pierna B y viernes torso B. El recordatorio de glúteo del martes es ligero: mantén RIR 3 y quítalo si interfiere con la recuperación. Si mueves sesiones, conserva la separación entre los dos días principales de pierna. No añadas series por calendario: comprueba primero que recuperas y progresas.",
    sessions: [
      { name: "Pierna A", weekday: 1, exercises: [
        movement("Hip thrust", "Glúteos", 3, 8, 12, "puente de glúteos con carga"),
        movement("Peso muerto rumano", "Piernas", 3, 8, 12, "rumano con mancuernas"),
        movement("Prensa de piernas", "Piernas", 2, 10, 12, "sentadilla hack"),
        movement("Curl femoral acostado", "Piernas", 2, 10, 15, "curl femoral sentado"),
        movement("Elevación de gemelos", "Piernas", 2, 12, 15, "gemelos en prensa"),
      ] },
      { name: "Torso A y recordatorio", weekday: 2, exercises: [
        movement("Jalón con barra", "Espalda", 3, 8, 12, "jalón con agarre neutro"),
        movement("Press banca con mancuernas", "Pecho", 3, 8, 12, "press de pecho en máquina"),
        movement("Remo sentado en cable", "Espalda", 2, 8, 12, "remo con mancuernas y pecho apoyado"),
        movement("Elevaciones laterales con mancuernas", "Hombros", 2, 12, 15, "elevaciones laterales en polea"),
        movement("Abducción de cadera en máquina", "Glúteos", 2, 12, 15, "abducción en polea", "Recordatorio opcional; omítelo si sigues fatigado del lunes."),
      ] },
      { name: "Pierna B", weekday: 4, exercises: [
        movement("Sentadilla búlgara", "Piernas", 3, 8, 12, "zancadas con apoyo", "Repeticiones por lado; usa un apoyo estable si necesitas equilibrio."),
        movement("Hip thrust", "Glúteos", 3, 8, 12, "puente de glúteos con carga"),
        movement("Curl femoral acostado", "Piernas", 3, 10, 15, "curl femoral sentado"),
        movement("Extensión de cuádriceps", "Piernas", 2, 12, 15, "prensa de piernas"),
        movement("Elevación de gemelos", "Piernas", 2, 12, 15, "gemelos en prensa"),
        plank(2),
      ] },
      { name: "Torso B", weekday: 5, exercises: [
        movement("Remo sentado en cable", "Espalda", 3, 8, 12, "remo con mancuernas y pecho apoyado"),
        movement("Press inclinado con mancuernas", "Pecho", 3, 8, 12, "press inclinado en máquina"),
        movement("Press de hombros con mancuernas", "Hombros", 2, 8, 12, "press de hombros en máquina"),
        movement("Curl de bíceps", "Bíceps", 2, 10, 15, "curl en polea"),
        movement("Extensión de tríceps en polea con barra recta", "Tríceps", 2, 10, 15, "extensión de tríceps con cuerda"),
      ] },
    ],
  },
];

const [, balanced, glutePriority] = INITIAL_PROGRAMS;

export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  ...INITIAL_PROGRAMS,
  {
    id: "especializacion-gluteos-hombros-5-dias",
    name: "Especialización · Glúteos y hombros",
    audience: "Para mujeres", source: PROGRAM_SOURCES[0],
    description: "Programa para mujeres con experiencia que quieren dedicar un quinto día a glúteos, hombros y accesorios, manteniendo el trabajo de todo el cuerpo.",
    level: "Avanzado", focus: "Glúteos y hombros", duration: "50–70 min; accesorios 35–50 min",
    equipment: `${glutePriority.equipment} Máquina de aductores o polea para su alternativa.`,
    instructions: "Pierna lunes y jueves; torso martes y viernes; accesorios el sábado. Descansa miércoles y domingo. El quinto día añade trabajo: úsalo cuando recuperes bien con cuatro días. Conserva RIR 3 y empieza con las 2 series de accesorios; reduce o retira ese día si perjudica las sesiones principales. El recordatorio del martes sigue siendo opcional.",
    sessions: [
      ...glutePriority.sessions,
      { name: "Accesorios", weekday: 6, exercises: [
        movement("Hip thrust", "Glúteos", 2, 10, 12, "puente de glúteos con carga"),
        movement("Abducción de cadera en máquina", "Glúteos", 2, 12, 15, "abducción en polea"),
        movement("Elevaciones laterales con mancuernas", "Hombros", 2, 12, 15, "elevaciones laterales en polea"),
        movement("Curl femoral acostado", "Piernas", 2, 10, 15, "curl femoral sentado"),
        movement("Aductor en máquina", "Piernas", 2, 12, 15, "aducción en polea"),
        plank(2),
      ] },
    ],
  },
  {
    id: "especializacion-brazos-4-dias",
    name: "Especialización · Brazos",
    audience: "General", source: PROGRAM_SOURCES[1],
    description: "Torso y pierna en cuatro días, con bíceps y tríceps al principio de las sesiones de torso para darles prioridad sin abandonar los grupos grandes.",
    level: "Intermedio", focus: "Brazos", duration: "55–75 min por sesión",
    equipment: balanced.equipment,
    instructions: "Lunes torso A, martes pierna A, jueves torso B y viernes pierna B. Alterna qué grupo muscular va primero: bíceps el lunes y tríceps el jueves. Conserva RIR 3, también en los accesorios. Si los brazos limitan demasiado los presses o remos, reduce sus series antes de aumentar el volumen semanal.",
    sessions: [
      { name: "Torso A · Bíceps primero", weekday: 1, exercises: [
        movement("Curl de bíceps", "Bíceps", 3, 10, 15, "curl en polea"),
        movement("Extensión de tríceps en polea con barra recta", "Tríceps", 3, 10, 15, "extensión de tríceps con cuerda"),
        movement("Press banca", "Pecho", 3, 8, 12, "press de pecho en máquina"),
        movement("Remo sentado en cable", "Espalda", 3, 8, 12, "remo con mancuernas y pecho apoyado"),
        movement("Jalón con barra", "Espalda", 2, 8, 12, "jalón con agarre neutro"),
        movement("Elevaciones laterales con mancuernas", "Hombros", 2, 12, 15, "elevaciones laterales en polea"),
      ] },
      balanced.sessions[1],
      { name: "Torso B · Tríceps primero", weekday: 4, exercises: [
        movement("Extensión de tríceps en polea con barra recta", "Tríceps", 3, 10, 15, "extensión de tríceps con cuerda"),
        movement("Curl martillo con mancuernas", "Bíceps", 3, 10, 15, "curl en polea con cuerda"),
        movement("Press inclinado con mancuernas", "Pecho", 3, 8, 12, "press inclinado en máquina"),
        movement("Jalón con barra", "Espalda", 3, 8, 12, "jalón con agarre neutro"),
        movement("Remo sentado en cable", "Espalda", 2, 8, 12, "remo con mancuernas y pecho apoyado"),
        movement("Elevaciones laterales con mancuernas", "Hombros", 2, 12, 15, "elevaciones laterales en polea"),
      ] },
      balanced.sessions[3],
    ],
  },
  {
    id: "agenda-flexible-4-dias",
    name: "Agenda flexible · Completo y brazos",
    audience: "General", source: PROGRAM_SOURCES[1],
    description: "Torso, pierna, cuerpo completo y brazos. Reserva más tiempo para el día de cuerpo completo y una sesión más corta para los accesorios.",
    level: "Intermedio", focus: "Brazos y agenda", duration: "50–65 min; completo 60–75; brazos 35–50",
    equipment: balanced.equipment,
    instructions: "Lunes torso, martes pierna, jueves cuerpo completo y sábado brazos. El viernes libre separa los dos últimos entrenamientos. Si cambias los días, conserva recuperación entre ellos. El día completo vuelve a trabajar torso y pierna; el último concentra accesorios de brazos y hombros. Mantén RIR 3 y el orden indicado.",
    sessions: [
      { ...balanced.sessions[0], name: "Torso" },
      { name: "Pierna", weekday: 2, exercises: [
        movement("Sentadilla", "Piernas", 3, 8, 10, "sentadilla hack o prensa"),
        movement("Peso muerto rumano", "Piernas", 3, 8, 12, "rumano con mancuernas"),
        movement("Curl femoral acostado", "Piernas", 2, 10, 15, "curl femoral sentado"),
        movement("Hip thrust", "Glúteos", 2, 8, 12, "puente de glúteos con carga"),
        movement("Elevación de gemelos", "Piernas", 2, 12, 15, "gemelos en prensa"),
      ] },
      { name: "Cuerpo completo", weekday: 4, exercises: [
        movement("Prensa de piernas", "Piernas", 3, 10, 12, "sentadilla hack"),
        movement("Curl femoral acostado", "Piernas", 2, 10, 15, "curl femoral sentado"),
        movement("Hip thrust", "Glúteos", 2, 8, 12, "puente de glúteos con carga"),
        movement("Press inclinado con mancuernas", "Pecho", 3, 8, 12, "press inclinado en máquina"),
        movement("Remo sentado en cable", "Espalda", 3, 8, 12, "remo con mancuernas y pecho apoyado"),
        movement("Elevación de gemelos", "Piernas", 2, 12, 15, "gemelos en prensa"),
      ] },
      { name: "Brazos y hombros", weekday: 6, exercises: [
        movement("Curl de bíceps", "Bíceps", 3, 10, 15, "curl en polea"),
        movement("Extensión de tríceps en polea con barra recta", "Tríceps", 3, 10, 15, "extensión de tríceps con cuerda"),
        movement("Elevaciones laterales con mancuernas", "Hombros", 2, 12, 15, "elevaciones laterales en polea"),
        movement("Deltoides posterior en máquina", "Hombros", 2, 12, 15, "aperturas inversas con mancuernas"),
        plank(2),
      ] },
    ],
  },
  {
    id: "fuerza-musculo-4-dias",
    name: "Fuerza y músculo · Empuje y tirón",
    audience: "General", source: PROGRAM_SOURCES[1],
    description: "Torso y pierna al inicio de semana, seguidos de empuje y tirón de cuerpo completo con movimientos principales en rangos más bajos de repeticiones.",
    level: "Intermedio", focus: "Fuerza y músculo", duration: "55–75 min por sesión",
    equipment: balanced.equipment,
    instructions: "Lunes torso, martes pierna, jueves empuje completo y viernes tirón completo. Empuje incluye cuádriceps y pecho; tirón incluye isquios y espalda. Deja RIR 3 en los movimientos principales y usa 2–3 min de descanso cuando lo necesites. El rango más bajo exige una técnica ya consolidada, sin buscar máximos. Descansa miércoles y fin de semana.",
    sessions: [
      { ...balanced.sessions[0], name: "Torso" },
      { ...balanced.sessions[1], name: "Pierna" },
      { name: "Empuje completo", weekday: 4, exercises: [
        movement("Sentadilla", "Piernas", 3, 5, 8, "sentadilla hack"),
        movement("Press banca", "Pecho", 3, 5, 8, "press de pecho en máquina"),
        movement("Extensión de cuádriceps", "Piernas", 2, 12, 15, "prensa de piernas"),
        movement("Press inclinado con mancuernas", "Pecho", 2, 8, 12, "press inclinado en máquina"),
        movement("Extensión de tríceps en polea con barra recta", "Tríceps", 2, 10, 15, "extensión de tríceps con cuerda"),
        movement("Elevaciones laterales con mancuernas", "Hombros", 2, 12, 15, "elevaciones laterales en polea"),
      ] },
      { name: "Tirón completo", weekday: 5, exercises: [
        movement("Peso muerto rumano", "Piernas", 3, 6, 8, "rumano con mancuernas"),
        movement("Jalón con barra", "Espalda", 3, 8, 12, "jalón con agarre neutro"),
        movement("Remo sentado en cable", "Espalda", 2, 8, 12, "remo con mancuernas y pecho apoyado"),
        movement("Curl femoral acostado", "Piernas", 2, 10, 15, "curl femoral sentado"),
        movement("Curl de bíceps", "Bíceps", 2, 10, 15, "curl en polea"),
        movement("Deltoides posterior en máquina", "Hombros", 2, 12, 15, "aperturas inversas con mancuernas"),
      ] },
    ],
  },
  {
    id: "especializacion-hombros-4-dias",
    name: "Especialización · Hombros",
    audience: "General", source: PROGRAM_SOURCES[1],
    description: "Torso y pierna con prioridad de hombros. Reparte trabajo frontal, lateral y posterior e incluye elevaciones laterales en los días de pierna.",
    level: "Intermedio", focus: "Hombros", duration: "60–80 min por sesión",
    equipment: `${balanced.equipment} Máquina de deltoides posterior o mancuernas para su alternativa.`,
    instructions: "Lunes torso A, martes pierna A con laterales, jueves torso B y viernes pierna B con laterales. Los presses también implican el hombro: mantén RIR 3 y empieza con el volumen indicado, sin añadir más trabajo frontal. Si llegas con fatiga al día siguiente, reduce primero las series de hombro añadidas a pierna. Descansa miércoles y fin de semana.",
    sessions: [
      { name: "Torso A · Hombros primero", weekday: 1, exercises: [
        movement("Press de hombros con mancuernas", "Hombros", 2, 8, 12, "press de hombros en máquina"),
        movement("Deltoides posterior en máquina", "Hombros", 2, 12, 15, "aperturas inversas con mancuernas"),
        movement("Press banca", "Pecho", 3, 8, 12, "press de pecho en máquina"),
        movement("Remo sentado en cable", "Espalda", 3, 8, 12, "remo con mancuernas y pecho apoyado"),
        movement("Jalón con barra", "Espalda", 2, 8, 12, "jalón con agarre neutro"),
        movement("Curl de bíceps", "Bíceps", 2, 10, 15, "curl en polea"),
        movement("Extensión de tríceps en polea con barra recta", "Tríceps", 2, 10, 15, "extensión de tríceps con cuerda"),
      ] },
      { ...balanced.sessions[1], name: "Pierna A y laterales", exercises: [
        movement("Elevaciones laterales con mancuernas", "Hombros", 3, 12, 15, "elevaciones laterales en polea"),
        ...balanced.sessions[1].exercises,
      ] },
      { name: "Torso B · Hombros primero", weekday: 4, exercises: [
        movement("Deltoides posterior en máquina", "Hombros", 3, 12, 15, "aperturas inversas con mancuernas"),
        movement("Elevaciones laterales con mancuernas", "Hombros", 2, 12, 15, "elevaciones laterales en polea"),
        movement("Press inclinado con mancuernas", "Pecho", 3, 8, 12, "press inclinado en máquina"),
        movement("Jalón con barra", "Espalda", 3, 8, 12, "jalón con agarre neutro"),
        movement("Remo sentado en cable", "Espalda", 2, 8, 12, "remo con mancuernas y pecho apoyado"),
        movement("Curl de bíceps", "Bíceps", 2, 10, 15, "curl en polea"),
        movement("Extensión de tríceps en polea con barra recta", "Tríceps", 2, 10, 15, "extensión de tríceps con cuerda"),
      ] },
      { ...balanced.sessions[3], name: "Pierna B y laterales", exercises: [
        movement("Elevaciones laterales con mancuernas", "Hombros", 3, 12, 15, "elevaciones laterales en polea"),
        ...balanced.sessions[3].exercises,
      ] },
    ],
  },
];

export function findProgramTemplate(id: string): ProgramTemplate | undefined {
  return PROGRAM_TEMPLATES.find((program) => program.id === id);
}
