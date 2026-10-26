import { convertWeight, formatWeight, type WeightUnit } from "@/lib/weight-units";
import Link from "next/link";

import { BodyWeightForm } from "@/components/body-weight-form";
import { Badge } from "@/components/ui/badge";
import { localDate } from "@/lib/dates";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export type WeighIn = { measuredOn: string; weight: number };

const WIDTH = 320;
const HEIGHT = 72;
const PAD = 4;

const dayFormatter = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });

/**
 * Dibuja la serie contra la meta. El eje no empieza en cero por el mismo motivo
 * que la gráfica de pesos del ejercicio: entre 77 y 79 kg hay toda la historia,
 * y desde cero son tres píxeles. La meta entra en el rango para que la línea
 * discontinua siempre se vea.
 */
function shape(history: WeighIn[], goal: number | null) {
  const values = history.map((item) => item.weight);
  const span = goal === null ? values : [...values, goal];
  // Un respiro arriba y abajo: sin él, la meta cae justo en el borde de la
  // tarjeta cuando es el valor más bajo de la serie, y la línea se confunde
  // con el marco.
  const headroom = (Math.max(...span) - Math.min(...span)) * 0.12 || 0.5;
  const top = Math.max(...span) + headroom;
  const bottom = Math.min(...span) - headroom;
  // Con una sola pesada, o todas iguales, no hay rango: se centra la línea.
  const range = top - bottom || 1;
  const y = (weight: number) =>
    PAD + ((top - weight) / range) * (HEIGHT - PAD * 2);
  const x = (index: number) =>
    history.length < 2 ? WIDTH / 2 : (index / (history.length - 1)) * WIDTH;

  return {
    line: history.map((item, index) => `${x(index)},${y(item.weight)}`).join(" "),
    goalY: goal === null ? null : y(goal),
    last: { x: x(history.length - 1), y: y(values[values.length - 1]!) },
  };
}

export function BodyWeightCard({
  history,
  goal,
  unit = "kg",
}: {
  /** De la más antigua a la más reciente. */
  history: WeighIn[];
  goal: number | null;
  unit?: WeightUnit;
}) {
  const display = (value: number) => formatWeight(convertWeight(value, "kg", unit));
  const latest = history.at(-1) ?? null;
  const previous = history.at(-2) ?? null;
  const change = latest && previous ? latest.weight - previous.weight : null;
  const toGoal = latest && goal !== null ? latest.weight - goal : null;

  return (
    <Card className="mt-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardDescription>Peso corporal</CardDescription>
          {latest ? (
            <div className="mt-1 flex items-baseline gap-2">
              <CardTitle className="text-3xl font-black tabular-nums">
                {display(latest.weight)} {unit}
              </CardTitle>
              {change !== null && change !== 0 ? (
                <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                  {change > 0 ? "+" : "−"}
                  {display(Math.abs(change))}
                </span>
              ) : null}
            </div>
          ) : (
            <CardTitle className="mt-1 text-lg">Sin pesadas todavía</CardTitle>
          )}
        </div>

        {toGoal !== null ? (
          <Badge variant="outline" className="shrink-0 tabular-nums">
            {Math.abs(toGoal) < 0.05
              ? "En tu objetivo"
              : `${display(Math.abs(toGoal))} ${unit} ${toGoal > 0 ? "por bajar" : "por subir"}`}
          </Badge>
        ) : null}
      </div>

      {history.length >= 2 ? (
        <>
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="mt-4 h-20 w-full"
            role="img"
            aria-label={`Evolución de tu peso en las últimas ${history.length} pesadas, de ${display(history[0]!.weight)} a ${display(history.at(-1)!.weight)} ${unit}`}
          >
            {(() => {
              const { line, goalY, last } = shape(history, goal);
              return (
                <>
                  {goalY === null ? null : (
                    <line
                      x1={0}
                      x2={WIDTH}
                      y1={goalY}
                      y2={goalY}
                      className="stroke-muted-foreground/50"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  <polyline
                    points={line}
                    fill="none"
                    className="stroke-foreground"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle cx={last.x} cy={last.y} r={3} className="fill-foreground" />
                </>
              );
            })()}
          </svg>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{dayFormatter.format(localDate(history[0]!.measuredOn))}</span>
            {goal !== null ? <span className="tabular-nums">meta {display(goal)} {unit}</span> : null}
            <span>{dayFormatter.format(localDate(history.at(-1)!.measuredOn))}</span>
          </div>
        </>
      ) : null}

      <BodyWeightForm latest={latest?.weight ?? null} unit={unit} />

      <p className="mt-3 text-[11px] text-muted-foreground">
        Una pesada al día: si registras otra hoy, sustituye a la anterior.
        {goal === null ? (
          <>
            {" "}
            <Link href="/ajustes" className="font-semibold text-foreground underline-offset-2 hover:underline">
              Ponte un objetivo
            </Link>{" "}
            y aparecerá como línea en la gráfica.
          </>
        ) : null}
      </p>
    </Card>
  );
}
