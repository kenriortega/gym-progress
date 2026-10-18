import {
  AbsBlocks,
  BICEPS,
  BackBody,
  DELTOID,
  FrontBody,
  GLUTE,
  Highlight,
  LAT,
  PECTORAL,
  THIGH_INNER,
  THIGH_OUTER,
  TRAPEZIUS,
  TRICEPS,
} from "./body";

/**
 * Qué se pinta en verde en cada icono.
 *
 * Cada zona repinta las placas que ya dibuja el cuerpo, con la misma `d`, así
 * que el verde encaja al píxel y nunca aparece un músculo que no exista en esa
 * vista. Las tres de espaldas —espalda, tríceps y glúteos— son las únicas que
 * cambian de cuerpo.
 */

export function Pecho() {
  return (
    <>
      <FrontBody />
      <Highlight>
        <path d={PECTORAL} />
      </Highlight>
    </>
  );
}

export function Hombros() {
  return (
    <>
      <FrontBody />
      <Highlight>
        <path d={DELTOID} />
      </Highlight>
    </>
  );
}

export function Biceps() {
  return (
    <>
      <FrontBody />
      <Highlight>
        <path d={BICEPS} />
      </Highlight>
    </>
  );
}

export function Abdomen() {
  return (
    <>
      <FrontBody />
      <Highlight>
        <AbsBlocks />
      </Highlight>
    </>
  );
}

/** Piernas: el cuádriceps, que es lo que se ve de frente. */
export function Piernas() {
  return (
    <>
      <FrontBody />
      <Highlight>
        <path d={THIGH_OUTER} />
        <path d={THIGH_INNER} />
      </Highlight>
    </>
  );
}

/** Espalda: dorsal ancho y trapecio, los dos, porque los ejercicios del grupo
 * (jalón, remo, peso muerto) reparten entre ambos y resaltar solo uno dejaba
 * media espalda apagada. */
export function Espalda() {
  return (
    <>
      <BackBody />
      <Highlight>
        <path d={LAT} />
        <path d={TRAPEZIUS} />
      </Highlight>
    </>
  );
}

export function Triceps() {
  return (
    <>
      <BackBody />
      <Highlight>
        <path d={TRICEPS} />
      </Highlight>
    </>
  );
}

export function Gluteos() {
  return (
    <>
      <BackBody />
      <Highlight>
        <path d={GLUTE} />
      </Highlight>
    </>
  );
}

/**
 * Cardio no es un músculo, así que no hay placa que repintar: va un corazón
 * sobre el pecho, en el sitio donde los demás iconos llevan los pectorales.
 */
export function Cardio() {
  return (
    <>
      <FrontBody />
      <g fill="var(--primary)">
        <path d="M13.75 12.25C13.75 11.2 12.6 10.7 12 11.45C11.4 10.7 10.25 11.2 10.25 12.25C10.25 13.55 12 14.8 12 14.8C12 14.8 13.75 13.55 13.75 12.25Z" />
      </g>
    </>
  );
}
