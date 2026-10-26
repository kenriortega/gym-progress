"use client";
import { WeightView, WeightSet } from "@/components/weight-view";
import { useOfflinePlans } from "@/components/offline-plans-provider";
import type { WeightUnit } from "@/lib/weight-units";
import { TrainingBlockCard } from "@/components/training-block-card";
import type { BlockProgress } from "@/lib/training-blocks";
import { formatTarget, validSet, type SetMetrics } from "@/lib/training-metrics";

import { DocumentLink } from "@/components/document-link";
import { OfflineSyncStatus } from "@/components/offline-sync-status";

import { FlagIcon, HistoryIcon, PlusIcon, Trash2Icon, WifiOffIcon } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PlateCalculator } from "@/components/plate-calculator";
import { RestTimer } from "@/components/rest-timer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import {
  encolar,
  refrescarSesion,
  sincronizar,
  suscribirCambios,
} from "@/lib/offline-queue";
import { subscribeOfflinePlans } from "@/lib/offline/plans";
import { leerEstado } from "@/lib/offline/storage";
import type { LocalWorkout, WorkoutSnapshot } from "@/lib/offline/types";
import { ButtonLink } from "@/components/button-link";
import {
  ExerciseProgress,
  SessionProgress,
} from "@/components/session-progress";

/**
 * Pantalla de entrenamiento que funciona sin cobertura.
 *
 * Se renderiza entera en el cliente y lee de IndexedDB, así que el service
 * worker puede servirla desde la caché. El servidor solo aporta la copia
 * fresca cuando hay red.
 */
export default function EntrenoPage() {
  const { catalog } = useOfflinePlans();
  const [sesion, setSesion] = useState<LocalWorkout | null>(null);
  const [workouts, setWorkouts] = useState<LocalWorkout[]>([]);
  const [legacyPending, setLegacyPending] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [sinRed, setSinRed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarLocal = useCallback(async () => {
    const local = await leerEstado();
    setSesion(local.workout);
    setWorkouts(local.workouts);
    setLegacyPending(local.legacyPending);
  }, []);

  const reintentar = useCallback(async () => {
    try {
      const account = await leerEstado();
      const resultado = await sincronizar();
      const current = await leerEstado();
      if (account.userId !== current.userId || account.generation !== current.generation) return;
      setError(null);
      if (resultado.quedan === 0) await refrescarSesion();
      setSinRed(!navigator.onLine);
    } catch {
      setSinRed(!navigator.onLine);
      setError("No se pudo actualizar la sesión. Si hay cambios guardados en el dispositivo, se conservan.");
    } finally {
      try { await cargarLocal(); } catch {
        setError("No se puede acceder al almacenamiento local. No registres cambios hasta recuperarlo.");
      }
    }
  }, [cargarLocal]);

  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      try {
        const local = await leerEstado();
        if (!vivo) return;
        setSesion(local.workout);
        setWorkouts(local.workouts);
        setLegacyPending(local.legacyPending);
          } catch {
        if (vivo) setError("No se puede acceder al almacenamiento local. No registres cambios hasta recuperarlo.");
      } finally {
        if (vivo) setCargando(false);
      }
    };
    const alVolver = () => { void reintentar(); };
    const unsubscribe = suscribirCambios(() => { void cargar(); });
    const unsubscribePlans = subscribeOfflinePlans(() => {
      setError(null);
      void cargar();
      alVolver();
    });
    void cargar().then(() => { if (vivo) alVolver(); });
    window.addEventListener("online", alVolver);
    return () => {
      vivo = false;
      unsubscribe();
      unsubscribePlans();
      window.removeEventListener("online", alVolver);
    };
  }, [reintentar]);

  const registrar = useCallback(
    async (
      ejercicio: WorkoutSnapshot["exercises"][number],
      peso: number,
      reps: number,
      rpe: number | null,
      metrics: Pick<SetMetrics, "durationSeconds" | "loadType" | "assistanceNote">,
    ) => {
      if (!sesion) return;
      const setId = crypto.randomUUID();
      // La pantalla solo confirma cuando snapshot y cola están persistidos.
      await encolar({
        id: setId,
        kind: "addSet",
        userId: sesion.userId,
        workoutId: sesion.workoutId,
        workoutExerciseId: ejercicio.workoutExerciseId,
        setId,
        weight: peso,
        reps,
        rpe,
        ...metrics,
        createdAt: Date.now(),
      });
      await cargarLocal();
      void reintentar();
    },
    [sesion, cargarLocal, reintentar],
  );

  const borrarSerie = useCallback(
    async (_workoutExerciseId: string, setId: string) => {
      if (!sesion) return;
      try {
        await encolar({
          id: crypto.randomUUID(),
          kind: "deleteSet",
          userId: sesion.userId,
        workoutId: sesion.workoutId,
          setId,
          createdAt: Date.now(),
        });
        await cargarLocal();
        void reintentar();
      } catch {
        toast.error("No se pudo guardar el borrado en el dispositivo. Inténtalo de nuevo.");
      }
    },
    [sesion, cargarLocal, reintentar],
  );

  const finalizar = useCallback(async () => {
    if (!sesion) return;
    try {
      await encolar({
        id: crypto.randomUUID(),
        kind: "finishWorkout",
        userId: sesion.userId,
        workoutId: sesion.workoutId,
        createdAt: Date.now(),
      });
      await cargarLocal();
      toast.success("Entrenamiento finalizado en este dispositivo. Pendiente de sincronizar.");
      void reintentar();
    } catch {
      toast.error("No se pudo guardar la finalización. La sesión sigue abierta.");
    }
  }, [sesion, cargarLocal, reintentar]);

  const saveBlock = async (blockId: string, next: Pick<BlockProgress, "startedAt" | "elapsedSeconds" | "result">) => {
    if (!sesion) return;
    const id = crypto.randomUUID();
    const createdAt = Math.max(Date.now(), (sesion.blockProgress?.[blockId]?.updatedAt ?? 0) + 1);
    await encolar({ id, kind: "blockProgress", userId: sesion.userId, workoutId: sesion.workoutId, blockId,
      progress: { ...next, mutationId: id, updatedAt: createdAt }, createdAt });
    await cargarLocal(); void reintentar();
  };

  const estadoSync = (
    <>
      <OfflineSyncStatus />
      {legacyPending > 0 && <p role="status" className="mt-4 text-sm text-muted-foreground">Hay cambios de una versión anterior pendientes de recuperar. Conéctate con su cuenta original para verificarlos; siguen guardados.</p>}
      {workouts.some((workout) => workout.localCompletedAt) && <section aria-label="Sesiones finalizadas pendientes" className="mt-5">
        <h2 className="text-sm font-semibold">Sesiones finalizadas pendientes de enviar</h2>
        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
          {workouts.filter((workout) => workout.localCompletedAt).map((workout) => <li key={workout.workoutId}>
            {workout.planName ?? "Sesión libre"} · {new Date(workout.performedAt).toLocaleDateString("es")} · {workout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0)} series
          </li>)}
        </ul>
      </section>}
      {error && <p role="alert" className="mt-4 text-sm text-muted-foreground">{error}</p>}
    </>
  );

  if (cargando) return <ScreenSkeleton />;

  if (!sesion || sesion.localCompletedAt) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md md:max-w-3xl lg:max-w-5xl flex-col justify-center px-5 py-10">
        <Alert>
          <WifiOffIcon />
          <AlertTitle>{sesion?.localCompletedAt ? "Entrenamiento finalizado en este dispositivo" : "Elige tu próximo entrenamiento"}</AlertTitle>
          <AlertDescription>
            {sesion?.localCompletedAt
              ? "La sesión y sus cambios se conservan hasta que el servidor confirme la sincronización."
              : "Puedes empezar otro entrenamiento desde tus planes guardados, también sin conexión."}
          </AlertDescription>
        </Alert>
        {estadoSync}
        <a href="/planes-guardados" className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">Elegir un plan guardado</a>
        <ButtonLink href="/" className="mt-6 h-12">
          Ir al inicio
        </ButtonLink>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md md:max-w-3xl lg:max-w-5xl px-5 pb-16 pt-12">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
            En curso · sin depender de la red
          </p>
          <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-foreground">
            {sesion.planName ?? "Sesión libre"}
          </h1>
        </div>
        <ButtonLink href="/" variant="outline" size="sm">
          Inicio
        </ButtonLink>
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

      {estadoSync}

      <SessionProgress
        ejercicios={sesion.exercises.filter((e) => !(sesion.blocks ?? []).some((block) => block.format !== "sets" && block.exerciseIds.includes(e.exerciseId))).map((e) => ({
          name: e.name,
          targetSets: e.targetSets,
          setsDone: e.sets.length,
        }))}
      />

      <div className="mt-6 grid items-start gap-4 md:grid-cols-2">
        {sesion.exercises.filter((exercise) => !(sesion.blocks ?? []).some((block) => block.exerciseIds.includes(exercise.exerciseId))).map((ejercicio, indice) => (
          <TarjetaEjercicio
            key={ejercicio.workoutExerciseId}
            ejercicio={ejercicio}
            indice={indice}
            unidad={sesion.weightUnit}
            displayUnit={catalog?.userId === sesion.userId ? catalog.data.weightUnit : sesion.weightUnit}
            viewKey={`${sesion.userId}:${sesion.workoutId}:${ejercicio.workoutExerciseId}`}
            onRegistrar={registrar}
            onBorrar={borrarSerie}
          />
        ))}
      </div>

      {(sesion.blocks ?? []).map((block) => <div key={block.id}>
        {block.format === "sets" ? <section className="mt-6" aria-label={`Bloque ${block.name}`}><h2 className="text-xl font-bold">{block.name}</h2>
          <div className="mt-4 grid items-start gap-4 md:grid-cols-2">{block.exerciseIds.map((exerciseId, index) => {
            const exercise = sesion.exercises.find((item) => item.exerciseId === exerciseId);
            return exercise && <TarjetaEjercicio key={exercise.workoutExerciseId} ejercicio={exercise} indice={index} unidad={sesion.weightUnit} displayUnit={catalog?.userId === sesion.userId ? catalog.data.weightUnit : sesion.weightUnit} viewKey={`${sesion.userId}:${sesion.workoutId}:${exercise.workoutExerciseId}`} onRegistrar={registrar} onBorrar={borrarSerie} />;
          })}</div>
        </section> : <TrainingBlockCard block={block} exercises={block.exerciseIds.map((id) => sesion.exercises.find((item) => item.exerciseId === id)!).filter(Boolean)} progress={sesion.blockProgress?.[block.id]} onSave={saveBlock} />}
      </div>)}

      <form
        className="mt-8"
        action={async () => {
          await finalizar();
        }}
      >
        <ConfirmSubmitButton
          type="submit"
          size="lg"
          className="h-14 w-full"
          title="¿Finalizar el entrenamiento?"
          confirmation="Se guardará como completado y dejará de aparecer aquí."
          pendingLabel="Finalizando…"
        >
          <FlagIcon className="size-4" />
          Finalizar sesión
        </ConfirmSubmitButton>
      </form>

      {sesion.serverCreated && <ButtonLink href={`/workout/${sesion.workoutId}`} variant="outline" className="mt-4 min-h-11 w-full">Ajustes de la sesión · requiere conexión</ButtonLink>}
      <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
        Para reordenar ejercicios o cambiar objetivos, entra desde el inicio.
        Eso necesita conexión.
      </p>
    </main>
  );
}

function TarjetaEjercicio({
  ejercicio,
  indice,
  unidad,
  displayUnit,
  viewKey,
  onRegistrar,
  onBorrar,
}: {
  ejercicio: WorkoutSnapshot["exercises"][number];
  indice: number;
  unidad: string;
  displayUnit: string;
  viewKey: string;
  onRegistrar: (
    ejercicio: WorkoutSnapshot["exercises"][number],
    peso: number,
    reps: number,
    rpe: number | null,
    metrics: Pick<SetMetrics, "durationSeconds" | "loadType" | "assistanceNote">,
  ) => Promise<void>;
  onBorrar: (workoutExerciseId: string, setId: string) => Promise<void>;
}) {
  const fieldId = useId();
  const timed = ejercicio.measurement === "time";
  const loadType = ejercicio.loadType ?? "external";
  const bodyweight = loadType === "bodyweight";
  const currentSet = ejercicio.sets.at(-1);
  const ultima = currentSet ?? ejercicio.previous.at(-1);
  const referenceUnit = currentSet ? unidad : ejercicio.previousWeightUnit ?? unidad;
  const initialWeight = ultima ? referenceUnit === unidad ? ultima.weight : referenceUnit === "lb" ? ultima.weight * 0.45359237 : ultima.weight / 0.45359237 : null;
  const [peso, setPeso] = useState(initialWeight === null ? "" : String(Math.round(initialWeight * 100) / 100));
  const [reps, setReps] = useState(ultima ? String(timed ? ultima.durationSeconds ?? "" : ultima.reps) : "");
  const [assistanceNote, setAssistanceNote] = useState(ultima?.assistanceNote ?? "");
  const [rpe, setRpe] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [guardadas, setGuardadas] = useState(0);

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
          <h2 className="text-lg font-semibold leading-tight text-balance text-foreground">
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

      <div className="px-5"><WeightView defaultUnit={displayUnit as WeightUnit} storageKey={viewKey} selectable={!bodyweight}>
      <div className="space-y-2 pt-4">
        {faltan !== null && (
          <div className="space-y-2">
            <Badge variant={faltan === 0 ? "default" : "outline"}>
              {faltan === 0 ? "Objetivo alcanzado" : `Faltan ${faltan}`}
            </Badge>
            <ExerciseProgress
              setsDone={ejercicio.sets.length}
              targetSets={ejercicio.targetSets}
            />
          </div>
        )}

        {ejercicio.previous.length > 0 && (
          <Alert className="bg-muted/40">
            <HistoryIcon />
            <AlertTitle>Última vez</AlertTitle>
            <AlertDescription>
              {ejercicio.previous.map((s, index) => <span key={index}>{index > 0 ? " · " : ""}<WeightSet value={s} from={(ejercicio.previousWeightUnit ?? unidad) as WeightUnit} /></span>)}
            </AlertDescription>
          </Alert>
        )}

        <p className="text-sm text-muted-foreground">{formatTarget(ejercicio)}</p>
        {ejercicio.progressionStep && ejercicio.progressionSteps?.[ejercicio.progressionStep] && <p className="text-xs leading-5 text-muted-foreground">Siguiente paso de tu plan: {ejercicio.progressionSteps[ejercicio.progressionStep]}. Puedes avanzar editando el plan cuando lo decidas.</p>}
        {ejercicio.notes && <p className="whitespace-pre-wrap break-words text-sm leading-6">{ejercicio.notes}</p>}
        <DocumentLink
          href={`/exercises/${ejercicio.exerciseId}`}
          className="inline-block text-xs font-bold text-muted-foreground transition hover:text-primary"
        >
          Ver progreso y gráfica →
        </DocumentLink>
      </div>

      {ejercicio.sets.length > 0 && (
        <ul className="mt-4 space-y-1 px-5">
          {ejercicio.sets.map((serie, i) => (
            <li
              key={serie.id}
              className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm"
            >
              <span className="text-muted-foreground">{i + 1}</span>
              <span className="flex-1 text-right font-semibold text-foreground">
                <WeightSet value={serie} from={unidad as WeightUnit} />
              </span>
              <button
                type="button"
                aria-label={`Borrar serie ${i + 1}`}
                onClick={() => void onBorrar(ejercicio.workoutExerciseId, serie.id)}
                className="ml-3 grid size-7 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2Icon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      </WeightView></div>
      {!bodyweight && <p className="px-5 pt-3 text-xs text-muted-foreground">Registra las nuevas series en {unidad}. El selector solo cambia la consulta.</p>}
      <form
        className="mt-4 grid grid-cols-[1fr_1fr_auto] gap-2 border-t border-border p-5"
        onSubmit={async (evento) => {
          evento.preventDefault();
          const p = bodyweight ? 0 : Number(peso);
          const r = timed ? 0 : Number(reps);
          const metrics = { loadType, durationSeconds: timed ? Number(reps) : null, assistanceNote: loadType === "assisted" ? assistanceNote.trim() || null : null };
          if (!validSet({ ...metrics, weight: p, reps: r })) {
            toast.error("Revisa la medición y la carga. La asistencia requiere kilos o una descripción de la banda.");
            return;
          }
          const esfuerzo = rpe === "" ? null : Number(rpe);
          if (esfuerzo !== null && (!Number.isFinite(esfuerzo) || esfuerzo < 1 || esfuerzo > 10)) {
            toast.error("El RPE va de 1 a 10.");
            return;
          }
          setGuardando(true);
          try {
            await onRegistrar(ejercicio, p, r, esfuerzo, metrics);
            setGuardadas((n) => n + 1);
          } catch {
            toast.error("No se pudo guardar la serie en el dispositivo. Inténtalo de nuevo.");
          } finally {
            setGuardando(false);
          }
        }}
      >
        {!bodyweight ? <div className="grid gap-1">
          <Label htmlFor={`${fieldId}-weight`} className="text-[11px]">{loadType === "weighted" ? "LASTRE" : loadType === "assisted" ? "ASISTENCIA" : "PESO"} {unidad.toUpperCase()}</Label>
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            required={loadType !== "assisted" || !assistanceNote.trim()}
            id={`${fieldId}-weight`}
            max="99999"
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
            className="h-12 text-center text-lg font-semibold"
          />
        </div> : <p className="self-center text-sm text-muted-foreground">Peso corporal</p>}
        <div className="grid gap-1">
          <Label htmlFor={`${fieldId}-reps`} className="text-[11px]">{timed ? "SEGUNDOS" : "REPS"}</Label>
          <Input
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            required
            id={`${fieldId}-reps`}
            max={timed ? 86400 : 1000}
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="h-12 text-center text-lg font-semibold"
          />
        </div>
        <Button type="submit" aria-label="Registrar serie" disabled={guardando} className="mt-5 h-12">
          {guardando ? "…" : <PlusIcon className="size-4" />}
        </Button>

        {loadType === "assisted" && <div className="col-span-3 grid gap-1">
          <Label htmlFor={`${fieldId}-assistance`}>Banda o asistencia (opcional si indicas kilos)</Label>
          <Input id={`${fieldId}-assistance`} maxLength={120} value={assistanceNote} onChange={(event) => setAssistanceNote(event.target.value)} placeholder="Ej.: banda verde, marca y resistencia" className="h-12" />
          <p className="text-xs leading-5 text-muted-foreground">Con banda, deja los kilos vacíos. Usa la misma descripción para comparar tus marcas.</p>
        </div>}
        <div className="col-span-3 grid gap-1">
          <Label htmlFor={`${fieldId}-rpe`} className="text-[11px] text-muted-foreground">
            RPE · esfuerzo del 1 al 10 (opcional)
          </Label>
          <Input
            type="number"
            inputMode="decimal"
            min="1"
            max="10"
            step="0.5"
            placeholder="—"
            id={`${fieldId}-rpe`}
            value={rpe}
            onChange={(e) => setRpe(e.target.value)}
            className="h-10 text-center"
          />
        </div>
      </form>

      <div className="px-5 pb-5">
        {(loadType === "external" || loadType === "weighted") && <PlateCalculator onUse={(kg) => setPeso((unidad === "lb" ? kg / 0.45359237 : kg).toFixed(2))} />}
        <RestTimer restartKey={guardadas} />
      </div>
    </Card>
  );
}
