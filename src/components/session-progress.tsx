"use client";

import { CheckIcon, DumbbellIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export type ProgresoEjercicio = {
  name: string;
  targetSets: number | null;
  setsDone: number;
};

/**
 * Cuánto llevas de la sesión.
 *
 * Un ejercicio cuenta como hecho cuando alcanza su objetivo de series. Los que
 * no tienen objetivo —añadidos sobre la marcha— cuentan en cuanto registras
 * una serie: sin número al que llegar, hecho es haberlo entrenado.
 */
export function calcularProgreso(ejercicios: ProgresoEjercicio[]) {
  const total = ejercicios.length;

  const completados = ejercicios.filter((e) =>
    e.targetSets === null ? e.setsDone > 0 : e.setsDone >= e.targetSets,
  ).length;

  const seriesHechas = ejercicios.reduce((suma, e) => suma + e.setsDone, 0);
  const seriesObjetivo = ejercicios.reduce(
    (suma, e) => suma + (e.targetSets ?? 0),
    0,
  );

  // Se mide por series, no por ejercicios: así la barra avanza con cada serie
  // y no da saltos bruscos al terminar uno.
  const porcentaje =
    seriesObjetivo > 0
      ? Math.min(100, Math.round((seriesHechas / seriesObjetivo) * 100))
      : total > 0
        ? Math.round((completados / total) * 100)
        : 0;

  return { total, completados, seriesHechas, seriesObjetivo, porcentaje };
}

export function SessionProgress({
  ejercicios,
}: {
  ejercicios: ProgresoEjercicio[];
}) {
  const { total, completados, seriesHechas, seriesObjetivo, porcentaje } =
    calcularProgreso(ejercicios);

  if (total === 0) return null;

  const terminada = completados === total;

  return (
    <Card className="mt-6 gap-3 p-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={`grid size-10 shrink-0 place-items-center rounded-xl ${
            terminada ? "bg-primary text-primary-foreground" : "bg-muted text-primary"
          }`}
        >
          {terminada ? (
            <CheckIcon className="size-5" />
          ) : (
            <DumbbellIcon className="size-5" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">
            {terminada ? "Sesión completa" : "Progreso de la sesión"}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {seriesObjetivo > 0
              ? `${seriesHechas} de ${seriesObjetivo} series`
              : `${seriesHechas} ${seriesHechas === 1 ? "serie" : "series"}`}
          </p>
        </div>

        <span className="shrink-0 text-right font-bold tabular-nums text-foreground">
          {completados} / {total}
        </span>
      </div>

      <Progress
        value={porcentaje}
        aria-label={`${porcentaje}% de la sesión completado`}
      />
    </Card>
  );
}

/** Barra fina dentro de cada tarjeta de ejercicio. */
export function ExerciseProgress({
  setsDone,
  targetSets,
}: {
  setsDone: number;
  targetSets: number | null;
}) {
  if (targetSets === null || targetSets === 0) return null;

  const porcentaje = Math.min(100, Math.round((setsDone / targetSets) * 100));

  return (
    <Progress
      value={porcentaje}
      className="h-1.5"
      aria-label={`${setsDone} de ${targetSets} series`}
    />
  );
}
