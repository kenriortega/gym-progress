import { HOLES, HOLE_REST, PLATES, PLATE_KG, STROKE, holeZ } from "./view";

// One stack, one cable, two idlers at the head and a sheave on a carriage that
// you can pin anywhere up the rail. The cable is tied straight to the carrier,
// so the ratio is 1:1: the stack rises exactly as far as the handle travels and
// weighs exactly what the pin says.

export const PIN_REST = 5;

export const GRIPS = ["cuerda", "barra"] as const;
export type Grip = (typeof GRIPS)[number];

export const kgAt = (pin: number) => (PLATES - pin) * PLATE_KG;

export const clampPin = (pin: number) => Math.min(PLATES - 1, Math.max(0, Math.round(pin)));
export const clampHole = (hole: number) => Math.min(HOLES - 1, Math.max(0, Math.round(hole)));
export const clampPull = (pull: number) => Math.min(STROKE, Math.max(0, pull));

const whole = (value: number) => Math.round(value).toString();

export const readoutOf = (pin: number, pull: number, grip: Grip) =>
  `${whole(kgAt(pin))} kg · ${whole(pull)} cm · ${grip}`;

export const REST_CARRIAGE = holeZ(HOLE_REST);

export const CAPTION = `Una columna de poleas: ${PLATES} discos de ${PLATE_KG} kg, un cable que sube por los dos reenvíos de cabeza y baja hasta una polea montada en un carro. El carro se pasa de agujero por todo el raíl y al cable se le engancha lo que quieras — cuerda, barra recta, el mismo agarre girado. Por eso el crunch en polea alta y las tres extensiones de tríceps son el mismo aparato: cambia dónde fijas la polea y qué cuelgas de ella, no la máquina.`;
