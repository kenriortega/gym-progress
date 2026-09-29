"use client";

import { useEffect, useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OPCIONES: Record<string, string> = {
  "60": "1:00",
  "90": "1:30",
  "120": "2:00",
  "180": "3:00",
};

/**
 * Cuenta atrás de descanso. Se reinicia cada vez que cambia `restartKey`, que
 * el llamante mueve al guardar una serie. Es cálculo local: funciona sin red.
 */
export function RestTimer({ restartKey }: { restartKey: number }) {
  const [seconds, setSeconds] = useState(90);
  const [remaining, setRemaining] = useState(0);
  const [lastKey, setLastKey] = useState(restartKey);

  if (restartKey !== lastKey) {
    setLastKey(restartKey);
    if (restartKey > 0) setRemaining(seconds);
  }

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setInterval(() => {
      setRemaining((actual) => Math.max(0, actual - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [remaining]);

  const minutos = Math.floor(remaining / 60);
  const segundos = remaining % 60;

  return (
    <div className="mt-3 flex items-center justify-between rounded-xl bg-card px-3 py-2">
      <label className="flex items-center text-xs font-semibold text-muted-foreground">
        Descanso
        <Select
          value={String(seconds)}
          items={OPCIONES}
          onValueChange={(valor) => setSeconds(Number(valor))}
        >
          <SelectTrigger className="ml-2 h-8 w-24" aria-label="Tiempo de descanso">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(OPCIONES).map(([valor, etiqueta]) => (
              <SelectItem key={valor} value={valor}>
                {etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <span
        className={`font-mono text-sm font-black ${
          remaining > 0 ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {remaining > 0
          ? `${minutos}:${String(segundos).padStart(2, "0")}`
          : "Listo"}
      </span>
    </div>
  );
}
