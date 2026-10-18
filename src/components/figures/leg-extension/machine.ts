import { ANGLE_HIGH, ANGLE_LOW, resistanceAt, riseAt } from "./cam";
import { ARM, PLATES, PLATE_KG } from "./view";

export const PIN_REST = 5;

export const kgAt = (pin: number) => (PLATES - pin) * PLATE_KG;

export const clampPin = (pin: number) => Math.min(PLATES - 1, Math.max(0, Math.round(pin)));
export const clampAngle = (deg: number) => Math.min(ANGLE_HIGH, Math.max(ANGLE_LOW, deg));

export const liftAt = riseAt;

const one = (value: number) => (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, "");
const whole = (value: number) => Math.round(value).toString();

/**
 * Two weights, and the gap between them is the lesson: what the pin says, and
 * what the pad actually pushes back with at this angle.
 */
export const readoutOf = (pin: number, deg: number) =>
  `${whole(kgAt(pin))} kg · ${one(resistanceAt(kgAt(pin), deg, ARM))} kg en el tobillo`;

export const CAPTION = `Una extensión de cuádriceps. El brazo gira sobre el eje de la rodilla y con él gira una leva, no una polea: su radio cambia según el ángulo, así que el brazo con el que la pila tira cambia también. Por eso con el mismo pin el rodillo pesa casi el doble con la rodilla doblada que en extensión — que es la forma de tu propia curva de fuerza, más capaz en flexión media y menos al final. Gira el brazo y mira cómo la segunda cifra se mueve sola.`;

export { ANGLE_HIGH, ANGLE_LOW };
