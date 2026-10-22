import { BODY_REGIONS, BODY_SILHOUETTE, BODY_VIEWBOX } from "@/lib/body-paths";
import { MUSCLE_LABELS, type MuscleRegion } from "@/lib/muscles";

/**
 * El cuerpo de frente y de espalda, con cada región teñida según cuánto la
 * trabajaste. La intensidad va de 0 a 1 y la decide quien lo usa: puede ser el
 * volumen del último mes, los músculos de un ejercicio, o lo que haga falta.
 *
 * Es un componente de servidor a propósito: los paths pesan 50 KB y no hay
 * motivo para mandarlos al navegador.
 */
export function BodyMap({
  intensity,
  className,
}: {
  intensity: Partial<Record<MuscleRegion, number>>;
  className?: string;
}) {
  return (
    <div className={className ? `flex gap-2 ${className}` : "flex gap-2"}>
      {(["front", "back"] as const).map((side) => (
        <svg
          key={side}
          viewBox={BODY_VIEWBOX[side]}
          className="h-auto w-full flex-1"
          role="img"
          aria-label={labelOf(side, intensity)}
        >
          <path d={BODY_SILHOUETTE[side]} className="fill-muted" />
          {Object.entries(BODY_REGIONS[side]).map(([region, d]) => {
            const value = intensity[region as MuscleRegion] ?? 0;
            return (
              <path
                key={region}
                d={d}
                className={value > 0 ? "fill-primary" : "fill-muted"}
                // Un suelo de 0.25: por debajo el tinte no se distingue del
                // hueco y la región parece sin trabajar cuando sí lo está.
                fillOpacity={value > 0 ? 0.25 + value * 0.75 : undefined}
              />
            );
          })}
        </svg>
      ))}
    </div>
  );
}

function labelOf(side: "front" | "back", intensity: Partial<Record<MuscleRegion, number>>) {
  const worked = Object.entries(BODY_REGIONS[side])
    .filter(([region]) => (intensity[region as MuscleRegion] ?? 0) > 0)
    .map(([region]) => MUSCLE_LABELS[region as MuscleRegion]);
  const view = side === "front" ? "de frente" : "de espalda";
  return worked.length
    ? `Cuerpo ${view}, con ${worked.join(", ")} marcados`
    : `Cuerpo ${view}, sin músculos marcados`;
}
