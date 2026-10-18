import { PLATE_KG, PLATES, STROKE } from "./view";

// One redirect pulley at the top and one at the boom tip, with the cable tied
// straight to the stack carrier: the ratio is 1:1, so the stack rises exactly as
// far as the bar comes down, and it weighs exactly what the pin says.

export const PIN_REST = 5;

/** Plates that leave the floor when the pin sits at `pin` (0 is the bottom plate). */
export const liftedAt = (pin: number) => PLATES - pin;

export const kgAt = (pin: number) => liftedAt(pin) * PLATE_KG;

export const clampPin = (pin: number) => Math.min(PLATES - 1, Math.max(0, Math.round(pin)));

export const clampPull = (pull: number) => Math.min(STROKE, Math.max(0, pull));

const whole = (value: number) => Math.round(value).toString();

export const readoutOf = (pin: number, pull: number) => `${whole(kgAt(pin))} kg · ${whole(pull)} cm`;

export const CAPTION = `Una polea de jalón: ${PLATES} discos de ${PLATE_KG} kg en dos guías, un pin que elige cuántos suben, y un cable que sube por la polea de cabeza y baja por la del brazo. Sin reducción, la pila sube lo mismo que baja la barra — ${STROKE} cm de recorrido — y pesa lo que marca el pin. Por eso los rodillos te sujetan los muslos: el peso tira de ti hacia arriba, no hacia abajo.`;
