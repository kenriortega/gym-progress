"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";

const LB_TO_KG = 0.45359237;

type LoadMode = "perSide" | "single";

/**
 * Convierte los discos que hay puestos en el peso total en kilos. Es cálculo
 * puro en el móvil, así que funciona igual sin cobertura.
 */
export function PlateCalculator({ onUse }: { onUse: (kg: number) => void }) {
  const [loadMode, setLoadMode] = useState<LoadMode>("perSide");
  const [barKg, setBarKg] = useState("20");
  const [kgPerSide, setKgPerSide] = useState("0");
  const [lbPerSide, setLbPerSide] = useState("0");

  const sides = loadMode === "perSide" ? 2 : 1;

  const total = useMemo(() => {
    const bar = Number(barKg) || 0;
    const kg = Number(kgPerSide) || 0;
    const lb = Number(lbPerSide) || 0;
    return Math.round((bar + (kg + lb * LB_TO_KG) * sides) * 100) / 100;
  }, [barKg, kgPerSide, lbPerSide, sides]);

  return (
    <Collapsible className="mt-3 rounded-xl border border-border bg-muted/40 p-3">
      <CollapsibleTrigger className="w-full text-left text-sm font-medium text-muted-foreground">
        Calcular el peso en kg
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div
          className="mt-4 grid grid-cols-2 gap-2"
          role="group"
          aria-label="Cómo está cargado el peso"
        >
          {(
            [
              ["perSide", "Barra · dos lados"],
              ["single", "Un lado o mancuerna"],
            ] as Array<[LoadMode, string]>
          ).map(([mode, label]) => (
            <Button
              key={mode}
              type="button"
              variant={loadMode === mode ? "default" : "secondary"}
              aria-pressed={loadMode === mode}
              onClick={() => {
                setLoadMode(mode);
                setBarKg(mode === "perSide" ? "20" : "0");
              }}
              className="h-10 text-xs"
            >
              {label}
            </Button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <label className="text-[11px] font-bold text-muted-foreground">
            {loadMode === "perSide" ? "BARRA KG" : "MANGO KG"}
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={barKg}
              onChange={(event) => setBarKg(event.target.value)}
              className="mt-2 h-11 text-center font-semibold"
            />
          </label>
          <label className="text-[11px] font-bold text-muted-foreground">
            {loadMode === "perSide" ? "KG POR LADO" : "KG"}
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={kgPerSide}
              onChange={(event) => setKgPerSide(event.target.value)}
              className="mt-2 h-11 text-center font-semibold"
            />
          </label>
          <label className="text-[11px] font-bold text-muted-foreground">
            {loadMode === "perSide" ? "LB POR LADO" : "LB"}
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={lbPerSide}
              onChange={(event) => setLbPerSide(event.target.value)}
              className="mt-2 h-11 text-center font-semibold"
            />
          </label>
        </div>

        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          {loadMode === "perSide"
            ? "Total = barra + los dos lados. Las libras se convierten automáticamente."
            : "Total = mango + los discos que indiques, una sola vez. Deja el mango en 0 si solo quieres convertir un disco suelto."}
        </p>

        <Button
          type="button"
          variant="secondary"
          onClick={() => onUse(total)}
          className="mt-3 h-11 w-full"
        >
          Usar {total.toFixed(2)} kg
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
}
