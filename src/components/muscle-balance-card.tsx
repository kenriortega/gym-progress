import { BodyMap } from "@/components/body-map";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { MUSCLE_LABELS, MUSCLE_REGIONS, isMuscleRegion, type MuscleRegion } from "@/lib/muscles";

export type MuscleVolume = { muscle: string; volume: number };

/**
 * Dónde fue tu volumen. La intensidad es relativa al músculo que más trabajaste,
 * no absoluta: nadie mueve los mismos kilos con gemelos que con piernas, y en
 * una escala común el tren superior quedaría siempre apagado. Lo que esta
 * tarjeta responde es "¿qué estoy descuidando?", y para eso vale lo relativo.
 */
export function MuscleBalanceCard({ volumes, days }: { volumes: MuscleVolume[]; days: number }) {
  const worked = volumes.filter((item) => isMuscleRegion(item.muscle) && item.volume > 0);
  const top = Math.max(...worked.map((item) => item.volume), 1);

  const intensity: Partial<Record<MuscleRegion, number>> = {};
  for (const item of worked) {
    intensity[item.muscle as MuscleRegion] = item.volume / top;
  }

  const untrained = MUSCLE_REGIONS.filter((region) => !intensity[region]);
  const best = [...worked].sort((a, b) => b.volume - a.volume)[0];

  return (
    <Card className="mt-6 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardDescription>Últimos {days} días</CardDescription>
          <CardTitle className="mt-1 text-lg">Dónde fue tu volumen</CardTitle>
        </div>
        {best ? (
          <Badge variant="outline" className="shrink-0 capitalize">
            {MUSCLE_LABELS[best.muscle as MuscleRegion]}
          </Badge>
        ) : null}
      </div>

      {worked.length > 0 ? (
        <>
          <BodyMap intensity={intensity} className="mx-auto mt-5 max-w-xs" />
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            El tono es relativo a tu músculo más trabajado, no a una escala fija.
            {untrained.length > 0 && untrained.length < MUSCLE_REGIONS.length ? (
              <>
                {" "}
                Sin tocar estos días:{" "}
                <span className="text-foreground">
                  {untrained.map((region) => MUSCLE_LABELS[region]).join(", ")}
                </span>
                .
              </>
            ) : null}
          </p>
        </>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Termina una sesión y el cuerpo se irá tiñendo por donde entrenes.
        </p>
      )}
    </Card>
  );
}
