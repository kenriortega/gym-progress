import type { ExerciseMetrics } from "./training-metrics";
import type { Discipline, TrainingBlock } from "./training-blocks";
/**
 * Planes de ejemplo para quien entra por primera vez.
 *
 * Crear un plan desde cero exige saber qué ejercicios quieres y en qué orden,
 * y eso es mucho trabajo antes de la primera serie registrada. Esto da un
 * punto de partida que después se edita como cualquier otro plan.
 *
 * Los nombres tienen que coincidir con el catálogo. Si alguno no existe, se
 * omite en vez de fallar: un plan con un ejercicio menos sirve igual.
 * Las plantillas con disciplina explícita completan el catálogo privado al copiarse.
 *
 * Propuestas propias de calistenia y CrossFit. Referencias de formatos y escalado:
 * https://www.hsnstore.com/blog/deportes/crossfit/como-entrenar-en-un-gimnasio-convencional/
 * https://www.crossfit.com/workout/
 * El EMOM alterna un ejercicio por minuto, según el cronómetro de la aplicación.
 */

export type TemplateExercise = ExerciseMetrics & {
  muscleGroup?: string;
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
};

/**
 * A quién se orienta la plantilla.
 *
 * Los ejercicios no son de hombres ni de mujeres: lo que cambia es el énfasis.
 * "mujeres" marca las rutinas con más volumen de glúteo y tren inferior, que
 * es lo que pide la mayoría de quienes lo solicitaron. "mixto" son las que no
 * priorizan ningún grupo en particular y le sirven a cualquiera.
 */
export type TemplateAudience = "mixto" | "mujeres";

export type PlanTemplate = {
  id: string;
  name: string;
  description: string;
  /** Indicaciones que se muestran antes de copiar y se conservan en el plan. */
  instructions?: string;
  /** Para quién es, en una frase. */
  audience: string;
  /** Enfoque, para el distintivo de la tarjeta. */
  gender: TemplateAudience;
  /** Día sugerido; se puede cambiar después. */
  weekday: number | null;
  exercises: TemplateExercise[];
  discipline?: Discipline;
  block?: Omit<TrainingBlock, "id" | "exerciseIds">;
};

const fuerza = (name: string): TemplateExercise => ({
  name,
  sets: 4,
  repsMin: 5,
  repsMax: 8,
});
const hipertrofia = (name: string): TemplateExercise => ({
  name,
  sets: 3,
  repsMin: 8,
  repsMax: 12,
});
const aislamiento = (name: string): TemplateExercise => ({
  name,
  sets: 3,
  repsMin: 12,
  repsMax: 15,
});

const pesoCorporal = (name: string, muscleGroup: string, repsMin: number, repsMax = repsMin, sets = 3): TemplateExercise => ({
  name, muscleGroup, sets, repsMin, repsMax, loadType: "bodyweight",
});
const isometrico = (name: string, muscleGroup: string, seconds: number): TemplateExercise => ({
  ...pesoCorporal(name, muscleGroup, 0), measurement: "time", targetSeconds: seconds,
});

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: "calistenia-iniciacion", name: "Calistenia · Iniciación", discipline: "calisthenics",
    description: "Sesión de cuerpo completo para empezar con peso corporal. Material: apoyo estable y barra baja o anillas para el remo.",
    instructions: "Calienta 5–8 min. Descansa 60–90 s entre series y deja 2 repeticiones en reserva. Hazla 2–3 días por semana con un día de descanso entre sesiones. Al completar el máximo con control, baja el apoyo de las flexiones o inclina más el remo.",
    audience: "Principiante · cuerpo completo", gender: "mixto", weekday: null,
    exercises: [
      pesoCorporal("Flexiones inclinadas", "Pecho", 6, 10),
      pesoCorporal("Remo invertido", "Espalda", 6, 10),
      pesoCorporal("Sentadilla libre", "Piernas", 10, 15),
      isometrico("Plancha abdominal", "Abdomen", 20),
    ],
  },
  {
    id: "calistenia-torso-control", name: "Calistenia · Torso y control", discipline: "calisthenics",
    description: "Empuje, tracción y estabilidad del torso. Material: barra de dominadas, banda o máquina de asistencia y barra baja para remo.",
    instructions: "Calienta hombros y escápulas 5–8 min. Dominadas con asistencia suficiente para controlar el movimiento; flexiones inclinadas si hace falta. Descansa 90–120 s y deja 2 repeticiones en reserva. Plancha lateral por lado. Al alcanzar el máximo, reduce asistencia. Alterna con piernas dejando un día de recuperación.",
    audience: "Base de fuerza · torso", gender: "mixto", weekday: null,
    exercises: [
      { ...pesoCorporal("Dominadas", "Espalda", 4, 6), loadType: "assisted" },
      pesoCorporal("Flexiones", "Pecho", 6, 12),
      pesoCorporal("Remo invertido", "Espalda", 8, 12),
      isometrico("Plancha lateral", "Abdomen", 20),
    ],
  },
  {
    id: "calistenia-piernas-core", name: "Calistenia · Piernas y core", discipline: "calisthenics",
    description: "Trabajo de piernas y abdomen sin pesas. Solo necesitas espacio y una esterilla opcional.",
    instructions: "Calienta 5–8 min. Zancadas y gemelos con apoyo si lo necesitas; repeticiones por lado en zancadas y dead bug. Descansa 60–90 s entre series. Alterna con torso y deja un día antes de repetir piernas. Al completar el máximo con control, aumenta el recorrido o ralentiza la bajada.",
    audience: "Principiante · tren inferior", gender: "mixto", weekday: null,
    exercises: [
      pesoCorporal("Zancadas", "Piernas", 8, 12),
      pesoCorporal("Puente de glúteos", "Glúteos", 12, 15),
      pesoCorporal("Elevación de gemelos", "Gemelos", 12, 20),
      pesoCorporal("Dead bug", "Abdomen", 6, 10),
    ],
  },
  {
    id: "crossfit-amrap-iniciacion", name: "CrossFit · AMRAP de iniciación", discipline: "crossfit",
    description: "Circuito de peso corporal de 10 minutos. Material: barra baja o anillas y un apoyo estable para las flexiones.",
    audience: "Principiante · ritmo sostenible", gender: "mixto", weekday: null,
    block: { name: "AMRAP de iniciación", format: "amrap", rounds: null, durationSeconds: 600, timeCapSeconds: null, intervalSeconds: null,
      prescription: "Calienta 5–8 min. Repite la secuencia durante 10 min y registra rondas + repeticiones. Ajusta la inclinación del remo y la altura de las flexiones para mantener la técnica; descansa cuando lo necesites. Empieza con 2 sesiones semanales no consecutivas. Mejora la regularidad antes de añadir repeticiones." },
    exercises: [pesoCorporal("Remo invertido", "Espalda", 5, 5, 1), pesoCorporal("Flexiones inclinadas", "Pecho", 8, 8, 1), pesoCorporal("Sentadilla libre", "Piernas", 12, 12, 1)],
  },
  {
    id: "crossfit-emom-gimnasio", name: "CrossFit · EMOM en gimnasio", discipline: "crossfit",
    description: "12 minutos de bisagra de cadera y acondicionamiento. Material: dos mancuernas y espacio para burpees.",
    audience: "Iniciación · mancuernas", gender: "mixto", weekday: null,
    block: { name: "EMOM en gimnasio", format: "emom", rounds: null, durationSeconds: 720, timeCapSeconds: null, intervalSeconds: 60,
      prescription: "Calienta 5–8 min y ensaya la bisagra con carga ligera. Minutos impares: 6 pesos muertos. Minutos pares: 4 burpees. Descansa el resto de cada minuto. Elige mancuernas ligeras; haz burpees con paso atrás y sin salto. Busca terminar en 35–40 s; reduce a 4 pesos muertos o 2 burpees si no quedan 20 s de descanso. Deja un día de recuperación. Aumenta carga solo si mantienes técnica y descanso." },
    exercises: [
      { name: "Peso muerto con mancuernas", muscleGroup: "Piernas", sets: 1, repsMin: 6, repsMax: 6, loadType: "external" },
      pesoCorporal("Burpee con paso atrás sin salto", "Otros", 4, 4, 1),
    ],
  },
  {
    id: "crossfit-circuito-por-tiempo", name: "CrossFit · Circuito por tiempo", discipline: "crossfit",
    description: "4 rondas con límite de 15 minutos. Material: una mancuerna para sentadilla, dos para remo y espacio libre.",
    audience: "Base técnica · cuerpo completo", gender: "mixto", weekday: null,
    block: { name: "Circuito por tiempo", format: "for-time", rounds: 4, durationSeconds: null, timeCapSeconds: 900, intervalSeconds: null,
      prescription: "Calienta 5–8 min. Por ronda: 10 sentadillas con una mancuerna al pecho, 8 remos con dos mancuernas simultáneas y 6 burpees. Cargas ligeras y técnica controlada; adapta burpees con paso atrás y sin salto. Descansa cuando lo necesites. Al llegar a 15 min, para y registra lo completado. Deja un día de recuperación. Busca un ritmo uniforme antes de subir carga." },
    exercises: [
      { name: "Sentadilla goblet", muscleGroup: "Piernas", sets: 1, repsMin: 10, repsMax: 10, loadType: "external" },
      { name: "Remo con mancuernas", muscleGroup: "Espalda", sets: 1, repsMin: 8, repsMax: 8, loadType: "external" },
      pesoCorporal("Burpees", "Otros", 6, 6, 1),
    ],
  },
  {
    id: "calistenia", name: "Calistenia editable", description: "Punto de partida para registrar repeticiones y tiempo con peso corporal. Ajusta movimientos y objetivos a tu entrenamiento.",
    audience: "Peso corporal y tiempo", gender: "mixto", weekday: null, discipline: "calisthenics",
    exercises: [
      { name: "Dominadas", muscleGroup: "Espalda", sets: 3, repsMin: 6, repsMax: 8, loadType: "bodyweight" },
      { name: "Fondos en paralelas", muscleGroup: "Tríceps", sets: 3, repsMin: 6, repsMax: 8, loadType: "bodyweight" },
      { name: "Plancha abdominal", muscleGroup: "Abdomen", sets: 3, repsMin: 0, repsMax: 0, loadType: "bodyweight", measurement: "time", targetSeconds: 30 },
    ],
  },
  {
    id: "amrap-editable", name: "AMRAP editable", description: "Ejemplo de editor de WOD: cambia ejercicios, duración y adaptación antes de entrenar.",
    audience: "Circuito con resultado global", gender: "mixto", weekday: null, discipline: "crossfit",
    block: { name: "AMRAP editable", format: "amrap", rounds: null, durationSeconds: 600, timeCapSeconds: null, intervalSeconds: null, prescription: "Peso corporal. Ajusta las variantes y anota cualquier adaptación." },
    exercises: [
      { name: "Dominadas", muscleGroup: "Espalda", sets: 1, repsMin: 5, repsMax: 5, loadType: "bodyweight" },
      { name: "Flexiones", muscleGroup: "Pecho", sets: 1, repsMin: 10, repsMax: 10, loadType: "bodyweight" },
      { name: "Sentadilla libre", muscleGroup: "Piernas", sets: 1, repsMin: 15, repsMax: 15, loadType: "bodyweight" },
    ],
  },
  {
    id: "cuerpo-completo",
    gender: "mixto",
    name: "Cuerpo completo",
    description: "Un día que toca todo. Si solo vas dos o tres veces por semana, esto rinde más que dividir.",
    audience: "Para empezar",
    weekday: 1,
    exercises: [
      fuerza("Sentadilla"),
      hipertrofia("Press banca"),
      hipertrofia("Remo con barra"),
      hipertrofia("Press de hombros con mancuernas"),
      aislamiento("Curl de bíceps"),
      aislamiento("Extensión de tríceps en polea con barra recta"),
    ],
  },
  {
    id: "empuje",
    gender: "mixto",
    name: "Empuje",
    description: "Pecho, hombro y tríceps: todo lo que empuja.",
    audience: "Rutina de tres días",
    weekday: 1,
    exercises: [
      fuerza("Press banca"),
      hipertrofia("Press inclinado con mancuernas"),
      hipertrofia("Press militar"),
      aislamiento("Elevaciones laterales con mancuernas"),
      aislamiento("Extensión de tríceps en polea con barra recta"),
      aislamiento("Fondos en paralelas"),
    ],
  },
  {
    id: "tiron",
    gender: "mixto",
    name: "Tirón",
    description: "Espalda y bíceps: todo lo que tira.",
    audience: "Rutina de tres días",
    weekday: 3,
    exercises: [
      fuerza("Peso muerto"),
      hipertrofia("Dominadas"),
      hipertrofia("Remo sentado en cable"),
      hipertrofia("Jalón con barra"),
      aislamiento("Curl de bíceps"),
      aislamiento("Curl martillo con mancuernas"),
    ],
  },
  {
    id: "pierna",
    gender: "mixto",
    name: "Pierna",
    description: "Cuádriceps, femoral y glúteo, con el gemelo al final.",
    audience: "Rutina de tres días",
    weekday: 5,
    exercises: [
      fuerza("Sentadilla"),
      hipertrofia("Peso muerto rumano"),
      hipertrofia("Prensa de piernas"),
      hipertrofia("Sentadilla búlgara"),
      aislamiento("Curl femoral acostado"),
      aislamiento("Elevación de gemelos"),
    ],
  },
  {
    id: "torso",
    gender: "mixto",
    name: "Torso",
    description: "Todo el tren superior en una sesión.",
    audience: "Rutina de cuatro días",
    weekday: 2,
    exercises: [
      hipertrofia("Press banca"),
      hipertrofia("Remo con barra"),
      hipertrofia("Press de hombros con mancuernas"),
      hipertrofia("Jalón con barra"),
      aislamiento("Curl de bíceps"),
      aislamiento("Extensión de tríceps"),
    ],
  },
  {
    id: "gluteo-pierna",
    name: "Glúteo y pierna",
    gender: "mujeres",
    description: "Prioriza glúteo y femoral, con el cuádriceps como apoyo. El empuje de cadera va primero, cuando estás fresca.",
    audience: "Enfoque tren inferior",
    weekday: 1,
    exercises: [
      fuerza("Hip thrust"),
      hipertrofia("Sentadilla búlgara"),
      hipertrofia("Peso muerto rumano"),
      hipertrofia("Prensa de piernas"),
      aislamiento("Glúteos en máquina"),
      aislamiento("Curl femoral acostado"),
    ],
  },
  {
    id: "tren-superior-mujeres",
    name: "Tren superior",
    gender: "mujeres",
    description: "Espalda y hombro por delante del pecho, que es lo que suele faltar cuando el foco está en la pierna.",
    audience: "Complementa el tren inferior",
    weekday: 3,
    exercises: [
      hipertrofia("Jalón con barra"),
      hipertrofia("Remo sentado en cable"),
      hipertrofia("Press de hombros con mancuernas"),
      aislamiento("Elevaciones laterales con mancuernas"),
      aislamiento("Curl de bíceps"),
      aislamiento("Extensión de tríceps en polea con barra recta"),
    ],
  },
  {
    id: "cuerpo-completo-gluteo",
    name: "Cuerpo completo con glúteo",
    gender: "mujeres",
    description: "Un solo día que toca todo pero carga la mano en glúteo. Si vas dos o tres veces por semana, esto cunde más que dividir.",
    audience: "Para empezar",
    weekday: 2,
    exercises: [
      fuerza("Hip thrust"),
      hipertrofia("Sentadilla"),
      hipertrofia("Remo con barra"),
      hipertrofia("Press de hombros con mancuernas"),
      aislamiento("Peso muerto rumano"),
      aislamiento("Elevación de gemelos"),
    ],
  },
];

export function findTemplate(id: string): PlanTemplate | undefined {
  return PLAN_TEMPLATES.find((template) => template.id === id);
}
