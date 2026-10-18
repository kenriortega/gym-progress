import type { ComponentType } from "react";

import { BODY_VIEWBOX, FrontBody } from "./muscle-icons/body";
import {
  Abdomen,
  Biceps,
  Cardio,
  Espalda,
  Gluteos,
  Hombros,
  Pecho,
  Piernas,
  Triceps,
} from "./muscle-icons/highlights";

/**
 * Iconos de grupo muscular.
 *
 * La clave es el valor de `exercises.muscle_group`, que es vocabulario cerrado
 * (el select de `exercise-picker`), así que no hace falta normalizar nada: lo
 * que no esté en el mapa cae en el cuerpo sin resaltar, que es justo lo que
 * queremos para «Otros» y para cualquier fila antigua con un grupo suelto.
 *
 * El cuerpo hereda el color del texto y se queda apagado; la zona resaltada va
 * en `--primary`, que ya está definido para claro y oscuro en `globals.css`.
 * Un solo token y ninguna regla de tema.
 *
 * El lienzo es retrato 2:3, así que el `className` tiene que respetar esa
 * proporción (`h-9 w-6`, no `size-9`).
 */
const HIGHLIGHTS: Record<string, ComponentType> = {
  Pecho,
  Espalda,
  Piernas,
  Glúteos: Gluteos,
  Hombros,
  Bíceps: Biceps,
  Tríceps: Triceps,
  Abdomen,
  Cardio,
};

export function MuscleIcon({
  group,
  className,
}: {
  group: string;
  className?: string;
}) {
  const Highlighted = HIGHLIGHTS[group];
  return (
    <svg viewBox={BODY_VIEWBOX} className={className} aria-hidden="true" focusable="false">
      {Highlighted ? <Highlighted /> : <FrontBody />}
    </svg>
  );
}
