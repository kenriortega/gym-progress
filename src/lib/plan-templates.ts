/**
 * Planes de ejemplo para quien entra por primera vez.
 *
 * Crear un plan desde cero exige saber qué ejercicios quieres y en qué orden,
 * y eso es mucho trabajo antes de la primera serie registrada. Esto da un
 * punto de partida que después se edita como cualquier otro plan.
 *
 * Los nombres tienen que coincidir con el catálogo. Si alguno no existe, se
 * omite en vez de fallar: un plan con un ejercicio menos sirve igual.
 */

export type TemplateExercise = {
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
  /** Para quién es, en una frase. */
  audience: string;
  /** Enfoque, para el distintivo de la tarjeta. */
  gender: TemplateAudience;
  /** Día sugerido; se puede cambiar después. */
  weekday: number | null;
  exercises: TemplateExercise[];
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

export const PLAN_TEMPLATES: PlanTemplate[] = [
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
