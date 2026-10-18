import type { ReactNode } from "react";

/**
 * El cuerpo que comparten todos los iconos de grupo muscular.
 *
 * No es una silueta lisa con una mancha encima: el cuerpo entero está hecho de
 * placas musculares y el icono solo cambia cuál de ellas se pinta en verde. Que
 * el resto del cuerpo también tenga anatomía es lo que hace que el juego se vea
 * trabajado y no un muñeco con un parche.
 *
 * Cada placa se define una sola vez, aquí, y el resaltado vuelve a dibujar esa
 * misma `d` en verde encima. Así la zona verde encaja al píxel con la placa
 * apagada que tapa, y mover un músculo es tocar una constante, no dos.
 *
 * Lienzo 24 × 36, retrato: la figura humana es alta y estrecha, y en un lienzo
 * cuadrado la mitad del ancho se iba en márgenes. A igual ancho de icono, en
 * retrato el cuerpo sale una vez y media más grande, que es donde se ve el
 * detalle.
 *
 * El lado izquierdo se dibuja una sola vez y se espeja con una transformación:
 * la simetría es exacta y no depende de que yo copie bien los números.
 */

export const BODY_VIEWBOX = "0 0 24 36";

/** Cuerpo de fondo: cabeza, cuello y tronco. Apagado, para que las placas
 * musculares se despeguen de él. */
const BASE_OPACITY = 0.17;
/** Las placas musculares, un punto más marcadas que el fondo. */
const PLATE_OPACITY = 0.34;

/* ---- placas, del hombro al pie -------------------------------------- */

export const DELTOID =
  "M10.1 9.8C8.1 9.7 6.85 10.9 6.8 12.7C6.78 13.7 7.1 14.4 7.75 14.75C8.95 14.3 9.7 13.3 10.05 11.9Z";
export const PECTORAL =
  "M11.55 11.3L10.05 11.3C9.5 11.3 9.25 11.8 9.4 12.5L9.75 13.9C9.9 14.6 10.35 14.9 11 14.9L11.55 14.9Z";
export const BICEPS =
  "M7.75 14.95C6.95 15.4 6.5 16.6 6.55 18.1C6.58 18.9 6.75 19.4 7.05 19.6C7.75 19.5 8.25 18.9 8.4 17.9C8.5 16.8 8.3 15.7 7.9 14.95Z";
export const TRICEPS =
  "M7.9 14.95C7.05 15.45 6.55 16.75 6.6 18.3C6.63 19.15 6.8 19.6 7.15 19.75C7.8 19.6 8.2 18.95 8.35 17.85C8.45 16.7 8.3 15.65 7.95 14.95Z";
const FOREARM =
  "M7 19.8C6.6 20.9 6.45 22.2 6.55 23.3C7.05 23.5 7.5 23.3 7.75 22.8C7.9 21.7 7.85 20.6 7.7 19.7Z";
const OBLIQUE =
  "M9.6 15.8C9.25 17.4 9.35 19.5 9.95 21.3L10.3 21.1C9.95 19.3 9.95 17.4 10.25 15.8Z";
export const ABS_LOWER = "M10.45 20.5L11.8 20.5L11.8 22.8C11.05 22.5 10.6 21.7 10.45 20.5Z";
export const THIGH_OUTER =
  "M9.7 24.5C9.3 26.6 9.3 28.7 9.8 30.5L10.55 30.5C10.45 28.4 10.55 26.3 10.85 24.5Z";
export const THIGH_INNER =
  "M10.95 24.5C10.75 26.5 10.7 28.5 10.8 30.5L11.7 30.5C11.9 28.5 11.95 26.5 11.85 24.5Z";
const KNEE = "M9.85 30.75C9.8 31.3 9.85 31.8 9.95 32.15L11.75 32.15C11.8 31.7 11.85 31.2 11.85 30.75Z";
const CALF = "M9.95 32.35C9.85 33.3 9.95 34.3 10.15 35.1L11.65 35.1C11.75 34.2 11.75 33.2 11.7 32.35Z";
/** Trapecio visto por detrás: la cometa que baja del cuello a media espalda. */
export const TRAPEZIUS = "M11.85 9.2L9.3 10.4C9.1 12.2 9.6 14.6 10.4 16.1L11.85 17.2Z";
/** Dorsal ancho: el ala que va de la axila a la cintura. */
export const LAT =
  "M9.2 14.4C8.85 16.2 9.15 18.4 9.95 20.1L11.5 18.9C10.75 17.4 10.2 15.9 10 14.3Z";
const LUMBAR = "M10.3 19.6C10.1 20.8 10.3 21.9 10.8 22.8L11.85 22.8L11.85 19.2Z";
export const GLUTE =
  "M9.7 21.9C9.35 22.3 9.3 23.2 9.6 23.8C9.95 24.4 10.7 24.6 11.3 24.4C11.75 24.2 11.9 23.8 11.9 23.3L11.9 21.9Z";

/** Los tres bloques del recto abdominal. Rectángulos, no `d`, así que el
 * resaltado los repinta con este mismo componente. */
export function AbsBlocks() {
  return (
    <>
      <rect x="10.45" y="15.7" width="1.35" height="1.35" rx="0.3" />
      <rect x="10.45" y="17.3" width="1.35" height="1.35" rx="0.3" />
      <rect x="10.45" y="18.9" width="1.35" height="1.35" rx="0.3" />
      <path d={ABS_LOWER} />
    </>
  );
}

const Hand = <rect x="6.45" y="23.65" width="1.45" height="1.8" rx="0.65" />;
const Foot = <rect x="9.9" y="35.3" width="2" height="1.1" rx="0.5" />;
const Leg = (
  <>
    <path d={THIGH_OUTER} />
    <path d={THIGH_INNER} />
    <path d={KNEE} />
    <path d={CALF} />
    {Foot}
  </>
);
const arm = (upper: string) => (
  <>
    <path d={upper} />
    <path d={FOREARM} />
    {Hand}
  </>
);

/* ---- armado ---------------------------------------------------------- */

/** Repite unas piezas espejadas respecto al eje del cuerpo. */
export function Mirror({ children }: { children: ReactNode }) {
  return <g transform="translate(24,0) scale(-1,1)">{children}</g>;
}

/** La zona que trabaja el ejercicio, en el verde de la app, a los dos lados. */
export function Highlight({ children }: { children: ReactNode }) {
  return (
    <g fill="var(--primary)">
      {children}
      <Mirror>{children}</Mirror>
    </g>
  );
}

/** Cabeza, cuello y tronco: lo mismo de frente que de espaldas. */
const Base = (
  <g fill="currentColor" opacity={BASE_OPACITY}>
    <circle cx="12" cy="4.2" r="2.6" />
    <rect x="10.7" y="6.3" width="2.6" height="2.3" rx="1" />
    <path d="M9.2 10.1C10.1 8.9 11 8.5 12 8.5C13 8.5 13.9 8.9 14.8 10.1L14.2 11.1L9.8 11.1Z" />
    <path d="M8.4 11.2C8.4 9.9 9.3 9.3 10.6 9.3L13.4 9.3C14.7 9.3 15.6 9.9 15.6 11.2C15.6 13.6 14.2 15.6 14.1 18.6C14.05 20.4 14.6 22 14.6 23.1C14.6 23.9 14.1 24.3 13.2 24.3L10.8 24.3C9.9 24.3 9.4 23.9 9.4 23.1C9.4 22 9.95 20.4 9.9 18.6C9.8 15.6 8.4 13.6 8.4 11.2Z" />
  </g>
);

const FrontSide = (
  <>
    <path d={DELTOID} />
    <path d={PECTORAL} />
    {arm(BICEPS)}
    {/* serrato: tres dientes bajo el pectoral */}
    <g fill="none" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round">
      <path d="M9.1 15.5L10.3 16" />
      <path d="M9.2 16.6L10.4 17" />
      <path d="M9.4 17.7L10.5 18" />
    </g>
    <path d={OBLIQUE} />
    <AbsBlocks />
    {Leg}
  </>
);

const BackSide = (
  <>
    <path d={DELTOID} />
    <path d={TRAPEZIUS} />
    <path d={LAT} />
    {arm(TRICEPS)}
    <path d={LUMBAR} />
    <path d={GLUTE} />
    {Leg}
  </>
);

function Body({ side }: { side: ReactNode }) {
  return (
    <>
      {Base}
      <g fill="currentColor" opacity={PLATE_OPACITY}>
        {side}
        <Mirror>{side}</Mirror>
      </g>
    </>
  );
}

/** Vista frontal: pecho, hombros, bíceps, abdomen, piernas y cardio. */
export function FrontBody() {
  return <Body side={FrontSide} />;
}

/** Vista dorsal: espalda, tríceps y glúteos. */
export function BackBody() {
  return <Body side={BackSide} />;
}
