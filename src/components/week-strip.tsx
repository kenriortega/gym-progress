import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { cn } from "cn";
import { weekTally, type StripDay, type StripState } from "@/lib/week-strip";

/**
 * La semana en curso, debajo del titular y encima del mapa del año: lo
 * cercano antes que el contexto.
 *
 * Sin colores de juicio. Un día perdido se apaga, no se pinta de rojo: quien
 * abre esto ya sabe que no fue, y el programa dura ocho microciclos.
 */
const DOT: Record<StripState, string> = {
  hecho: "border-primary bg-primary text-primary-foreground",
  // Entrenaste, pero no lo que tocaba: el aro dice que hubo sesión y el relleno
  // vacío dice que el plan del día sigue sin hacerse.
  otro: "border-primary/60 text-primary/80",
  hoy: "border-primary text-primary",
  pendiente: "border-border text-muted-foreground",
  perdido: "border-dashed border-border text-muted-foreground/60",
  libre: "border-transparent bg-muted/40 text-muted-foreground/60",
  extra: "border-foreground text-foreground",
};

const MARK: Record<StripState, string> = {
  hecho: "✓",
  otro: "~",
  hoy: "•",
  pendiente: "",
  perdido: "",
  libre: "—",
  extra: "✓",
};

export function WeekStrip({ days }: { days: StripDay[] }) {
  const { hechos, previstos, extras, otros } = weekTally(days);
  if (!previstos && !extras) return null;

  return (
    <Card className="mt-8 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardDescription>Esta semana</CardDescription>
          <CardTitle className="mt-1 text-lg">Lo que llevas</CardTitle>
        </div>
        {previstos > 0 ? (
          <Badge variant="outline" className="shrink-0 tabular-nums">
            {hechos} de {previstos}
          </Badge>
        ) : null}
      </div>

      <ol className="mt-5 grid grid-cols-7 gap-1">
        {days.map((day) => (
          <li key={day.day} className="flex min-w-0 flex-col items-center gap-1.5">
            <span className="text-[11px] font-bold text-muted-foreground">{day.label}</span>
            <span
              className={cn(
                "grid size-9 place-items-center rounded-full border-2 text-sm font-black tabular-nums",
                DOT[day.state],
              )}
              title={day.plans.join(" · ") || "Descanso"}
            >
              {MARK[day.state]}
            </span>
            {/* Dos líneas antes que recortar: la columna mide 44 px y «Día suave»
                se quedaba en «Día sua…», que no dice qué toca. */}
            <span className="line-clamp-2 w-full text-center text-[10px] leading-tight text-balance text-muted-foreground">
              {day.plans[0] ?? ""}
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        {resumen({ hechos, previstos, extras, otros, days })}
      </p>
    </Card>
  );
}

function resumen({
  hechos,
  previstos,
  extras,
  otros,
  days,
}: ReturnType<typeof weekTally> & { days: StripDay[] }) {
  const hoy = days.find((day) => day.state === "hoy");
  if (hoy) return `Hoy toca ${hoy.plans.join(" y ")}.`;
  if (otros > 0 && hechos === 0) {
    return `Entrenaste ${otros} ${otros === 1 ? "día" : "días"}, pero no lo que tocaba: el plan es nuevo.`;
  }
  if (previstos > 0 && hechos === previstos) {
    return extras > 0 ? "Semana completa, y un día de más." : "Semana completa.";
  }
  const quedan = days.filter((day) => day.state === "pendiente").length;
  if (quedan > 0) return `Quedan ${quedan} ${quedan === 1 ? "sesión" : "sesiones"} esta semana.`;
  if (extras > 0 && previstos === 0) return "Entrenaste sin que tocara. Cuenta igual.";
  return "La semana se cierra el domingo.";
}
