import { Input } from "@/components/ui/input";
import { LOAD_LABELS, type SetMetrics } from "@/lib/training-metrics";

/** Editar valores de una serie sin cambiar su variante histórica. */
export function RecordedSetFields({ value, unit }: { value: SetMetrics & { rpe?: string | number | null }; unit: string }) {
  const type = value.loadType ?? "external";
  return <fieldset className="space-y-3">
    <legend className="text-sm text-muted-foreground">{LOAD_LABELS[type]}</legend>
    <input type="hidden" name="loadType" value={type} />
    <input type="hidden" name="rpe" value={value.rpe ?? ""} />
    <div className="grid grid-cols-2 gap-3">
      <label className="grid gap-2 text-sm">{value.durationSeconds != null ? "Segundos" : "Repeticiones"}
        <Input name={value.durationSeconds != null ? "durationSeconds" : "reps"} type="number" min="1" max={value.durationSeconds != null ? 86400 : 1000} required defaultValue={value.durationSeconds ?? value.reps} />
      </label>
      {type === "bodyweight" ? <input type="hidden" name="weight" value="0" /> : <label className="grid gap-2 text-sm">{type === "weighted" ? "Lastre" : type === "assisted" ? "Asistencia" : "Peso"} ({unit})
        <Input name="weight" type="number" min="0" max="99999" step="0.01" required defaultValue={value.weight} />
      </label>}
    </div>
    {type === "assisted" && <label className="grid gap-2 text-sm">Banda o asistencia<Input name="assistanceNote" maxLength={120} defaultValue={value.assistanceNote ?? ""} /></label>}
  </fieldset>;
}
