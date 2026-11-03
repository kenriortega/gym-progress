import { formatPrescribedSet, nextSetPosition, type SetPrescription as Prescription } from "@/lib/set-prescription";

export function SetPrescription({ value, recorded }: { value?: Prescription | null; recorded?: Array<{ position: number }> }) {
  if (!value) return null;
  const next = recorded ? nextSetPosition(recorded, true) : null;
  return (
    <div className="mt-3 space-y-2 text-sm leading-6">
      {next !== null && next < value.sets.length && <p className="font-semibold">Siguiente · Serie {next + 1}: {formatPrescribedSet(value.sets[next])}</p>}
      <details className="border-t border-border pt-2">
        <summary className="min-h-11 cursor-pointer py-2 font-medium">Microciclo {value.microcycle} · Objetivos por serie</summary>
        <ol className="space-y-1">
          {value.sets.map((set, index) => <li key={index}><span className="font-medium">Serie {index + 1}</span> · {formatPrescribedSet(set)}</li>)}
        </ol>
      </details>
    </div>
  );
}
