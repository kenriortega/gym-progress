"use client";

import { useEffect, useState } from "react";
import { leerEstado } from "@/lib/offline/storage";
import { DocumentLink } from "@/components/document-link";

export default function LaunchPage() {
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    void leerEstado().then((data) => {
      if (!alive) return;
      const active = data.workouts.some((workout) => !workout.localCompletedAt);
      const target = active ? "/entreno" : navigator.onLine ? "/" : "/planes-guardados";
      // Entrada de documento precacheada, disponible incluso sin datos RSC.
      window.location.replace(target);
    }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, []);
  return <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-16">
    <h1 className="text-2xl font-bold">{error ? "No se puede abrir el almacenamiento local" : "Abriendo Gym Progress…"}</h1>
    {error ? <p role="alert" className="mt-4 text-sm leading-6 text-muted-foreground">No registres cambios hasta recuperar el almacenamiento. Puedes volver a intentarlo o abrir Inicio cuando tengas conexión.</p>
      : <p role="status" className="mt-3 text-sm text-muted-foreground">Buscando tu sesión y tus planes guardados.</p>}
    <DocumentLink href="/" className="mt-6 inline-flex min-h-12 items-center font-semibold underline underline-offset-4">Abrir Inicio</DocumentLink>
    {error && <DocumentLink href="/abrir" className="mt-3 inline-flex min-h-12 items-center font-semibold underline underline-offset-4">Volver a intentar</DocumentLink>}
  </main>;
}
