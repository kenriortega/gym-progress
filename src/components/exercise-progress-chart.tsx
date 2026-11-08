"use client";

import { useState } from "react";
import { WeightValue } from "@/components/weight-view";
import { Badge } from "@/components/ui/badge";
import { cn } from "cn";
import { chartGeometry } from "@/lib/exercise-chart";

export type ChartSession = {
  id: string;
  /** ISO: el servidor no puede pasar un Date a un componente de cliente. */
  date: string;
  maxWeight: number;
  volume: number;
  oneRepMax: number | null;
};

type Metric = "peso" | "1rm" | "volumen";

const METRICS: Array<{ id: Metric; label: string; corto: string; pie: string }> = [
  { id: "peso", label: "Peso máximo", corto: "Peso", pie: "La serie más pesada de cada sesión." },
  { id: "1rm", label: "1RM estimado", corto: "1RM", pie: "Lo que podrías mover una sola vez, estimado desde tus series. Solo cuenta las de hasta 12 repeticiones." },
  { id: "volumen", label: "Volumen", corto: "Volumen", pie: "Peso por repeticiones, sumado en toda la sesión." },
];

const valueOf = (session: ChartSession, metric: Metric) =>
  metric === "peso" ? session.maxWeight : metric === "volumen" ? session.volume : session.oneRepMax;

const dayFormatter = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });
const longFormatter = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "2-digit" });

export function ExerciseProgressChart({ sessions }: { sessions: ChartSession[] }) {
  const [metric, setMetric] = useState<Metric>("peso");
  const activa = METRICS.find((item) => item.id === metric)!;

  const puntos = sessions
    .map((session) => ({ session, value: valueOf(session, metric), time: new Date(session.date).getTime() }))
    .filter((punto): punto is { session: ChartSession; value: number; time: number } => punto.value !== null && Number.isFinite(punto.time));

  const { points: plots, first: primero, last: ultimo, single: unDia } = chartGeometry(puntos);
  const x = (i: number) => plots[i].x;
  const y = (i: number) => plots[i].y;

  const linea = plots.map((plot, i) => `${i === 0 ? "M" : "L"} ${plot.x.toFixed(2)} ${plot.y.toFixed(2)}`).join(" ");
  const area = plots.length > 1 ? `${linea} L ${plots.at(-1)!.x.toFixed(2)} 100 L ${plots[0].x.toFixed(2)} 100 Z` : "";
  const etiquetar = puntos.length <= 8;
  const ultimoPunto = puntos.at(-1) ?? null;

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2">
        {METRICS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setMetric(item.id)}
            aria-pressed={metric === item.id}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              metric === item.id
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            <span className="sm:hidden">{item.corto}</span>
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        ))}
      </div>

      {puntos.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Ninguna sesión tiene este dato todavía.
          {metric === "1rm" ? " El 1RM solo se estima en series de hasta 12 repeticiones." : null}
        </p>
      ) : (
        <>
          {ultimoPunto ? (
            <div className="mt-5 flex items-baseline gap-2">
              <p className="text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
                <WeightValue value={ultimoPunto.value} />
              </p>
              <span className="text-sm text-muted-foreground">{longFormatter.format(new Date(ultimoPunto.time))}</span>
            </div>
          ) : null}

          <div className="relative mt-6 h-44 w-full">
            <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              {area ? <path d={area} className="fill-foreground/8" /> : null}
              {puntos.length > 1 ? (
                <path d={linea} className="stroke-foreground" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              ) : null}
            </svg>

            {puntos.map((punto, i) => (
              <div
                key={punto.session.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${x(i)}%`, top: `${y(i)}%` }}
              >
                <span className="block size-2.5 rounded-full border-2 border-background bg-foreground" />
                {etiquetar ? (
                  <span className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold tabular-nums text-muted-foreground">
                    <WeightValue value={punto.value} single />
                  </span>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            <span>{dayFormatter.format(new Date(primero))}</span>
            {unDia ? null : <span>{dayFormatter.format(new Date(ultimo))}</span>}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            {activa.pie} Las sesiones van separadas por la fecha real, así que una pausa se ve como
            una pausa. El eje vertical no empieza en cero, para que se note el cambio entre sesiones.
          </p>
        </>
      )}

      <Badge variant="outline" className="mt-4">
        {sessions.length} {sessions.length === 1 ? "sesión" : "sesiones"}
      </Badge>
    </>
  );
}
