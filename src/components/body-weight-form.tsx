"use client";

import { logBodyWeight } from "@/app/actions/body-weight";
import { PendingButton } from "@/components/pending-button";
import { Input } from "@/components/ui/input";
import { dayOf } from "@/lib/dates";

/**
 * El día lo pone el navegador, no el servidor: pesarte a las 00:30 en Madrid es
 * el día 19 para ti y el 18 en UTC, y la tabla guarda un `date` sin zona.
 */
const today = () => dayOf(new Date());

export function BodyWeightForm({ latest }: { latest: number | null }) {
  return (
    <form action={logBodyWeight} className="mt-4 flex gap-2">
      {/*
        El servidor no conoce la zona del usuario, así que renderiza el campo
        vacío y el navegador lo rellena al montar. Con `defaultValue` el HTML de
        los dos lados no coincidiría y React se quejaría al hidratar.
      */}
      <input
        type="hidden"
        name="measuredOn"
        ref={(node) => {
          if (node) node.value = today();
        }}
      />
      <Input
        name="weight"
        type="number"
        inputMode="decimal"
        step="0.1"
        min={20}
        max={500}
        required
        defaultValue={latest ?? undefined}
        placeholder="78.4"
        aria-label="Peso de hoy en kilos"
        className="h-12 flex-1 rounded-xl px-4 text-base font-semibold tabular-nums"
      />
      <PendingButton type="submit" className="h-12">
        Registrar
      </PendingButton>
    </form>
  );
}
