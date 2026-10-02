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

export type PlanTemplate = {
  id: string;
  name: string;
  description: string;
  /** Para quién es, en una frase. */
  audience: string;
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
];

export function findTemplate(id: string): PlanTemplate | undefined {
  return PLAN_TEMPLATES.find((template) => template.id === id);
}
