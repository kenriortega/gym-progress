"use client";

import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { formatSet, type SetMetrics } from "@/lib/training-metrics";
import { isWeightDisplayMode, weightLabel, type WeightDisplayMode, type WeightUnit } from "@/lib/weight-units";

const WeightContext = createContext<{ mode: WeightDisplayMode; primary: WeightUnit }>({ mode: "kg", primary: "kg" });
const eventName = "gym-weight-view";
function subscribe(callback: () => void) {
  window.addEventListener(eventName, callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener(eventName, callback); window.removeEventListener("storage", callback); };
}

/** Clave por cuenta, sesión y ejercicio. Nunca escribe registros de entrenamiento. */
export function WeightView({ defaultUnit, storageKey, children, selectable = true }: {
  defaultUnit: WeightUnit; storageKey?: string; children: ReactNode; selectable?: boolean;
}) {
  const [fallback, setFallback] = useState<WeightDisplayMode | null>(null);
  const [storageError, setStorageError] = useState(false);
  const mode = useSyncExternalStore(subscribe, () => {
    if (fallback) return fallback;
    try {
      const saved = storageKey ? sessionStorage.getItem(`gym-weight:${storageKey}`) : null;
      return isWeightDisplayMode(saved) ? saved : defaultUnit;
    } catch { return defaultUnit; }
  }, () => defaultUnit);
  function choose(next: WeightDisplayMode) {
    try {
      if (storageKey) sessionStorage.setItem(`gym-weight:${storageKey}`, next);
      else setFallback(next);
      window.dispatchEvent(new Event(eventName));
    } catch { setFallback(next); setStorageError(true); }
  }
  return <WeightContext.Provider value={{ mode, primary: defaultUnit }}>
    {selectable && <div className="my-4 space-y-2">
      <div role="group" aria-label="Unidad de visualización" className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-muted-foreground">Mostrar en</span>
        {([ ["kg", "kg"], ["lb", "lb"], ["both", "Ambas"] ] as const).map(([value, label]) =>
          <Button key={value} type="button" variant={mode === value ? "default" : "outline"} className="min-h-11" aria-pressed={mode === value} onClick={() => choose(value)}>{label}</Button>)}
      </div>
      {storageError && <p role="status" className="text-xs text-muted-foreground">La selección funciona, pero no se conservará al recargar este navegador.</p>}
    </div>}
    {children}
  </WeightContext.Provider>;
}

export function WeightValue({ value, from = "kg", single = false }: { value: number; from?: WeightUnit; single?: boolean }) {
  const { mode, primary } = useContext(WeightContext);
  return <>{weightLabel(value, from, single && mode === "both" ? primary : mode, primary)}</>;
}

export function WeightSet({ value, from }: { value: SetMetrics; from: WeightUnit }) {
  const { mode, primary } = useContext(WeightContext);
  return <>{formatSet(value, from, (weight) => weightLabel(weight, from, mode, primary))}</>;
}
