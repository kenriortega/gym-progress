import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { heatmapOf, trainedDaysIn, weekStreakOf, type TrainedDay } from "@/lib/activity-heatmap";
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

/** Lunes, miércoles y viernes: con las siete iniciales no se lee nada. */
const WEEKDAY_LABELS = ["L", "", "X", "", "V", "", ""];

export function ActivityHeatmap({ trained }: { trained: TrainedDay[] }) {
  const weeks = heatmapOf(trained);
  const days = trainedDaysIn(weeks);
  const streak = weekStreakOf(weeks);

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
          vuelve a ltr para que las columnas sigan de antiguo a reciente.
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
                  <span
                    key={cell.day}
                    className={`block size-[11px] rounded-[2px] ${TONES[cell.level]}`}
                    title={
                      cell.level > 0
                        ? `${dayFormatter.format(localDate(cell.day))}: ${Math.round(cell.volume)} kg movidos`
                        : dayFormatter.format(localDate(cell.day))
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">
          {days === 0
            ? "Cada sesión que termines pinta un cuadro."
            : streak > 1
              ? `${streak} semanas seguidas entrenando.`
              : "El tono sube con los kilos que moviste ese día."}
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
