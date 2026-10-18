import { CATCH_S, PLATES_MAX, PLATE_KG, RAMP_SIN, SLED_KG, SLED_REST, STROKE } from "./view";

// A 45° sled press. No weight stack: you hang plates on the horns, and the
// carriage rides the rails on bushings.
//
// The number everybody quotes is what is on the horns. What your legs push is
// that load, plus the carriage, times the sine of the ramp — about 0.71 here.
// Friction takes a little more off, which this does not model.

export const PLATES_REST = 2;

export const loadedOf = (plates: number) => plates * PLATE_KG * 2 + SLED_KG;
export const effectiveOf = (plates: number) => loadedOf(plates) * RAMP_SIN;

export const clampPlates = (plates: number) => Math.min(PLATES_MAX, Math.max(0, Math.round(plates)));

/** With the catches parked the sled cannot come below them: that is their job. */
export const floorOf = (parked: boolean) => (parked ? CATCH_S : SLED_REST);
export const topOf = () => SLED_REST + STROKE;
export const clampSled = (s: number, parked: boolean) =>
  Math.min(topOf(), Math.max(floorOf(parked), s));

const whole = (value: number) => Math.round(value).toString();

export const readoutOf = (plates: number, s: number) =>
  `${whole(loadedOf(plates))} kg · ${whole(effectiveOf(plates))} efectivos · ${whole(s - SLED_REST)} cm`;

export const CAPTION = `Una prensa de 45°: el carro lleva los discos y corre sobre dos raíles inclinados, con el reposapiés por delante y tú tumbado debajo. Los pestillos son lo que hay que entender — con ellos puestos el carro no baja de ahí, y se giran hacia fuera para soltar el recorrido. El otro detalle que cambia las cuentas: en una rampa de 45° tus piernas empujan el peso del carro multiplicado por el seno del ángulo, unos dos tercios de lo que marcan los discos, no el total.`;
