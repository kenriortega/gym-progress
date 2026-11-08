"use client";

import { useState } from "react";
import { convertWeight, formatWeight, type WeightUnit } from "@/lib/weight-units";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { heatmapOf, trainedDaysIn, weekStreakOf, type HeatCell, type TrainedDay } from "@/lib/activity-heatmap";
import { localDate } from "@/lib/dates";

/** El tono de cada nivel. El 0 es el hueco: se ve, pero no cuenta. */
const TONES = [
  "bg-muted",
  "bg-primary/25",
  "bg-primary/50",
  "bg-primary/75",
  "bg-primary",
] as const;

const dayFormatter = new Intl.DateTimeFormat("es", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const monthFormatter = new Intl.DateTimeFormat("es", { month: "short" });
/** «mié, 12 ago» en la línea: «miércoles, 12 de agosto · 4.250 kg» se partía en dos y empujaba la leyenda. */
const shortDayFormatter = new Intl.DateTimeFormat("es", { weekday: "short", day: "numeric", month: "short" });

/** Lunes, miércoles y viernes: con las siete iniciales no se lee nada. */
const WEEKDAY_LABELS = ["L", "", "X", "", "V", "", ""];

export function ActivityHeatmap({ trained, unit = "kg" }: { trained: TrainedDay[]; unit?: WeightUnit }) {
  const weeks = heatmapOf(trained);
  const days = trainedDaysIn(weeks);
  const streak = weekStreakOf(weeks);
  // El día señalado, para la línea de lectura. El tooltip del navegador pedía
  // ratón: en el móvil, que es donde se usa esto, no había forma de consultar
  // un cuadro.
  const [picked, setPicked] = useState<HeatCell | null>(null);

  const detail = (cell: HeatCell) =>
    cell.level === 0
      ? "sin entrenar"
      : cell.volume > 0
        ? `${formatWeight(convertWeight(cell.volume, "kg", unit))} ${unit}`
        : "entrenamiento completado";
  /** Corta para leer de un vistazo; entera para quien la escucha. */
  const readout = (cell: HeatCell) => `${shortDayFormatter.format(localDate(cell.day))} · ${detail(cell)}`;
  const spoken = (cell: HeatCell) => `${dayFormatter.format(localDate(cell.day))}: ${detail(cell)}`;

  // Una etiqueta de mes sobre la primera columna de cada mes, y nunca dos
  // pegadas: un mes que solo asoma con dos días no se anuncia.
  const months = weeks.map((week, index) => {
    const first = week[0]!;
    const month = localDate(first.day).getMonth();
    const previous =
      index === 0 ? null : localDate(weeks[index - 1]![0]!.day).getMonth();
    return month !== previous && index < weeks.length - 1
      ? monthFormatter.format(localDate(first.day))
      : "";
  });

  return (
    <Card className="mt-8 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardDescription>Último año</CardDescription>
          <CardTitle className="mt-1 text-lg">Constancia</CardTitle>
        </div>
        {days > 0 ? (
          <Badge variant="outline" className="shrink-0 tabular-nums">
            {days} {days === 1 ? "día" : "días"}
          </Badge>
        ) : null}
      </div>

      {/* Los días fijos, fuera del scroll: dentro se iban con las columnas. */}
      <div className="mt-5 flex gap-1">
        <div className="flex shrink-0 flex-col gap-[3px] pt-[14px]">
          {WEEKDAY_LABELS.map((label, index) => (
            <span
              key={index}
              className="h-[11px] text-[9px] leading-[11px] text-muted-foreground"
              aria-hidden="true"
            >
              {label}
            </span>
          ))}
        </div>

        {/*
          El scroll arranca a la derecha, en hoy, que es lo que importa: con
          `direction: rtl` en el contenedor el navegador lo hace solo, sin
          JavaScript ni convertir esto en un componente de cliente. El contenido
          vuelve a ltr para que las columnas sigan de antiguo a reciente. El
          truco se conserva aunque esto ya sea cliente: no cuesta JavaScript.
        */}
        <div
          className="min-w-0 overflow-x-auto pb-1"
          style={{ direction: "rtl" }}
        >
          <div className="flex w-max gap-[3px]" style={{ direction: "ltr" }}>
            {weeks.map((week, index) => (
              <div key={week[0]!.day} className="flex flex-col gap-[3px]">
                <span
                  className="h-[11px] text-[9px] leading-[11px] text-muted-foreground"
                  aria-hidden="true"
                >
                  {months[index]}
                </span>
                {week.map((cell) => (
                  <button
                    key={cell.day}
                    type="button"
                    /* Los 371 cuadros no entran en el recorrido del tabulador:
                       solo los días entrenados, que son los que tienen algo que
                       contar. */
                    tabIndex={cell.level > 0 ? 0 : -1}
                    aria-label={spoken(cell)}
                    onPointerEnter={() => setPicked(cell)}
                    onPointerLeave={(event) => {
                      // Con el dedo no hay "salir": el toque deja el día puesto.
                      if (event.pointerType === "mouse") setPicked(null);
                    }}
                    onFocus={() => setPicked(cell)}
                    onBlur={() => setPicked(null)}
                    onClick={() => setPicked(cell)}
                    className={`block size-[11px] shrink-0 rounded-[2px] ${TONES[cell.level]} ${
                      picked?.day === cell.day ? "ring-2 ring-foreground ring-offset-1 ring-offset-card" : ""
                    }`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        {/* La misma línea hace de resumen y de lectura del día señalado: ya
            estaba ahí, así que consultar un cuadro no cuesta altura. */}
        <p
          className={`min-w-0 text-[11px] ${picked ? "font-medium tabular-nums text-foreground" : "text-muted-foreground"}`}
          aria-live="polite"
        >
          {picked
            ? readout(picked)
            : days === 0
              ? "Cada sesión que termines pinta un cuadro."
              : streak > 1
                ? `${streak} semanas seguidas entrenando.`
                : "El tono sube con la carga que moviste ese día."}
        </p>
        <div className="flex shrink-0 items-center gap-1" aria-hidden="true">
          <span className="text-[10px] text-muted-foreground">Menos</span>
          {TONES.map((tone, level) => (
            <span
              key={level}
              className={`block size-[11px] rounded-[2px] ${tone}`}
            />
          ))}
          <span className="text-[10px] text-muted-foreground">Más</span>
        </div>
      </div>
    </Card>
  );
}
