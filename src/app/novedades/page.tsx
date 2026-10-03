"use client";

import { SparklesIcon } from "lucide-react";
import { useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { CHANGELOG, marcarVistas } from "@/lib/changelog";

export default function NovedadesPage() {
  // Visitar la pantalla cuenta como leerlas: el aviso del menú desaparece.
  useEffect(() => {
    marcarVistas();
  }, []);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md md:max-w-3xl lg:max-w-5xl px-5 pb-12 pt-6">
      <header className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
            Qué ha cambiado
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground md:text-3xl">
            Novedades
          </h1>
        </div>
      </header>

      <div className="mt-8 space-y-4">
        {CHANGELOG.map((entrada, indice) => (
          <Card key={entrada.id} className="gap-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">{entrada.title}</CardTitle>
              {indice === 0 && (
                <Badge>
                  <SparklesIcon className="size-3" />
                  Lo último
                </Badge>
              )}
            </div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {entrada.date}
            </p>
            <ul className="space-y-2">
              {entrada.items.map((item) => (
                <li
                  key={item}
                  className="flex gap-2 text-sm leading-6 text-muted-foreground"
                >
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </main>
  );
}
