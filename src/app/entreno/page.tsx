"use client";

import Link from "next/link";
import { HistoryIcon, PlusIcon, WifiOffIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import {
  contar,
  encolar,
  guardarSesion,
  leerSesion,
  sincronizar,
} from "@/lib/offline-queue";
import type { WorkoutSnapshot } from "@/app/api/snapshot/route";

/**
 * Pantalla de entrenamiento que funciona sin cobertura.
 *
 * Se renderiza entera en el cliente y lee de IndexedDB, así que el service
 * worker puede servirla desde la caché. El servidor solo aporta la copia
 * fresca cuando hay red.
 */
export default function EntrenoPage() {
  const [sesion, setSesion] = useState<WorkoutSnapshot | null>(null);
  const [cargando, setCargando] = useState(true);
  const [sinRed, setSinRed] = useState(false);
  const [pendientes, setPendientes] = useState(0);

  const refrescar = useCallback(async () => {
    try {
      const respuesta = await fetch("/api/snapshot", { cache: "no-store" });
      if (!respuesta.ok) throw new Error("sin datos");
      const datos = (await respuesta.json()) as { workout: WorkoutSnapshot | null };
      if (datos.workout) {
        await guardarSesion(datos.workout);
        setSesion(datos.workout);
      } else {
        setSesion(null);
      }
      setSinRed(false);
    } catch {
      setSinRed(true);
    }
  }, []);

  useEffect(() => {
    let vivo = true;

    (async () => {
      // Primero lo guardado: la pantalla aparece al instante, con o sin red.
      const local = await leerSesion<WorkoutSnapshot>();
      if (vivo && local) setSesion(local);
      if (vivo) setCargando(false);

      await refrescar();
      if (vivo) setPendientes(await contar());
    })();

    const alVolver = async () => {
      const { enviadas, quedan } = await sincronizar();
      if (!vivo) return;
      setPendientes(quedan);
      if (enviadas > 0) {
        toast.success(
          `${enviadas} ${enviadas === 1 ? "serie enviada" : "series enviadas"}`,
        );
      }
      await refrescar();
    };

    window.addEventListener("online", alVolver);
    return () => {
      vivo = false;
      window.removeEventListener("online", alVolver);
    };
  }, [refrescar]);

  const registrar = useCallback(
    async (ejercicio: WorkoutSnapshot["exercises"][number], peso: number, reps: number) => {
      if (!sesion) return;

      const setId = crypto.randomUUID();

      // Se pinta al instante y se guarda en el móvil. El envío viene después.
      setSesion((actual) => {
        if (!actual) return actual;
        return {
          ...actual,
          exercises: actual.exercises.map((e) =>
            e.workoutExerciseId === ejercicio.workoutExerciseId
              ? {
                  ...e,
                  sets: [
                    ...e.sets,
                    { id: setId, position: e.sets.length, reps, weight: peso },
                  ],
                }
              : e,
          ),
        };
      });

      await encolar({
        id: setId,
        kind: "addSet",
        workoutId: sesion.workoutId,
        workoutExerciseId: ejercicio.workoutExerciseId,
        setId,
        weight: peso,
        reps,
        createdAt: Date.now(),
      });

      const { quedan } = await sincronizar();
      setPendientes(quedan);
      if (quedan === 0) {
        await guardarSesion({ ...sesion, fetchedAt: Date.now() });
      }
    },
    [sesion],
  );

  if (cargando) return <ScreenSkeleton />;

  if (!sesion) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
        <Alert>
          <WifiOffIcon />
          <AlertTitle>No hay entrenamiento guardado</AlertTitle>
          <AlertDescription>
            Empieza una sesión con conexión y quedará disponible aquí aunque
            luego te quedes sin cobertura.
          </AlertDescription>
        </Alert>
        <Button className="mt-6 h-12" render={<Link href="/" />}>
          Ir al inicio
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-16 pt-6">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
            En curso · sin depender de la red
          </p>
          <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-foreground">
            {sesion.planName ?? "Sesión libre"}
          </h1>
        </div>
        <Button variant="outline" size="sm" render={<Link href="/" />}>
          Inicio
        </Button>
      </header>

      {sinRed && (
        <Alert className="mt-4">
          <WifiOffIcon />
          <AlertTitle>Trabajando desde el móvil</AlertTitle>
          <AlertDescription>
            Estás viendo la copia guardada. Todo lo que anotes se enviará al
            volver la conexión.
          </AlertDescription>
        </Alert>
      )}

      {pendientes > 0 && (
        <p className="mt-4 rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-200">
          {pendientes} {pendientes === 1 ? "serie" : "series"} sin enviar
          todavía.
        </p>
      )}

      <div className="mt-6 space-y-4">
        {sesion.exercises.map((ejercicio, indice) => (
          <TarjetaEjercicio
            key={ejercicio.workoutExerciseId}
            ejercicio={ejercicio}
            indice={indice}
            unidad={sesion.weightUnit}
            onRegistrar={registrar}
          />
        ))}
      </div>

      <p className="mt-8 text-center text-xs leading-5 text-muted-foreground">
        Para editar series, marcar ejercicios o finalizar, entra en la pantalla
        completa desde el inicio. Eso necesita conexión.
      </p>
    </main>
  );
}

function TarjetaEjercicio({
  ejercicio,
  indice,
  unidad,
  onRegistrar,
}: {
  ejercicio: WorkoutSnapshot["exercises"][number];
  indice: number;
  unidad: string;
  onRegistrar: (
    ejercicio: WorkoutSnapshot["exercises"][number],
    peso: number,
    reps: number,
  ) => Promise<void>;
}) {
  const ultima = ejercicio.sets.at(-1) ?? ejercicio.previous.at(-1);
  const [peso, setPeso] = useState(ultima ? String(ultima.weight) : "");
  const [reps, setReps] = useState(ultima ? String(ultima.reps) : "");
  const [guardando, setGuardando] = useState(false);

  const faltan =
    ejercicio.targetSets !== null
      ? Math.max(0, ejercicio.targetSets - ejercicio.sets.length)
      : null;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-start gap-3 border-b border-border p-5">
        <Badge className="size-10 shrink-0 justify-center rounded-xl text-sm font-bold">
          {String(indice + 1).padStart(2, "0")}
        </Badge>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold text-foreground">
            {ejercicio.name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {ejercicio.muscleGroup}
            {ejercicio.targetSets !== null
              ? ` · ${ejercicio.sets.length}/${ejercicio.targetSets} series`
              : ""}
          </p>
        </div>
      </div>

      <div className="space-y-2 px-5 pt-4">
        {faltan !== null && (
          <Badge variant={faltan === 0 ? "default" : "outline"}>
            {faltan === 0 ? "Objetivo alcanzado" : `Faltan ${faltan}`}
          </Badge>
        )}

        {ejercicio.previous.length > 0 && (
          <Alert className="bg-muted/40">
            <HistoryIcon />
            <AlertTitle>Última vez</AlertTitle>
            <AlertDescription>
              {ejercicio.previous.map((s) => `${s.weight}×${s.reps}`).join(" · ")}{" "}
              {unidad}
            </AlertDescription>
          </Alert>
        )}
      </div>

      {ejercicio.sets.length > 0 && (
        <ul className="mt-4 space-y-1 px-5">
          {ejercicio.sets.map((serie, i) => (
            <li
              key={serie.id}
              className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm"
            >
              <span className="text-muted-foreground">{i + 1}</span>
              <span className="font-semibold text-foreground">
                {serie.weight} {unidad} × {serie.reps}
              </span>
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-4 grid grid-cols-[1fr_1fr_auto] gap-2 border-t border-border p-5"
        onSubmit={async (evento) => {
          evento.preventDefault();
          const p = Number(peso);
          const r = Number(reps);
          if (!Number.isFinite(p) || p < 0 || !Number.isInteger(r) || r < 1) {
            toast.error("Revisa el peso y las repeticiones.");
            return;
          }
          setGuardando(true);
          await onRegistrar(ejercicio, p, r);
          setGuardando(false);
        }}
      >
        <div className="grid gap-1">
          <Label className="text-[11px]">PESO {unidad.toUpperCase()}</Label>
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            required
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
            className="h-12 text-center text-lg font-semibold"
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-[11px]">REPS</Label>
          <Input
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            required
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="h-12 text-center text-lg font-semibold"
          />
        </div>
        <Button type="submit" disabled={guardando} className="mt-5 h-12">
          {guardando ? "…" : <PlusIcon className="size-4" />}
        </Button>
      </form>
    </Card>
  );
}
