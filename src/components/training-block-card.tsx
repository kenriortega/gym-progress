"use client";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { describeBlock, describeResult, elapsedBlock, type TrainingBlock, type BlockProgress, type BlockResult } from "@/lib/training-blocks";
import { formatTarget } from "@/lib/training-metrics";
import type { SnapshotExercise } from "@/lib/offline/types";

const clock = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
export function TrainingBlockCard({ block, exercises, progress, onSave }: {
  block: TrainingBlock; exercises: SnapshotExercise[]; progress?: BlockProgress;
  onSave: (blockId: string, next: Pick<BlockProgress, "startedAt" | "elapsedSeconds" | "result">) => Promise<void>;
}) {
  const id = useId();
  const [elapsed, setElapsed] = useState(() => elapsedBlock(progress));
  const [busy, setBusy] = useState(false);
  const result = progress?.result;
  const [draft, setDraft] = useState(() => ({ rounds: String(result?.rounds ?? 0), reps: String(result?.reps ?? 0),
    duration: String(result?.durationSeconds ?? ""), intervals: String(result?.intervals ?? 0),
    completed: result?.completed ?? true, adaptation: result?.adaptation ?? "rx", note: result?.adaptationNote ?? "" }));
  useEffect(() => {
    const update = () => setElapsed(elapsedBlock(progress));
    const timer = setInterval(update, 250);
    document.addEventListener("visibilitychange", update);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", update); };
  }, [progress]);
  const save = async (next: Pick<BlockProgress, "startedAt" | "elapsedSeconds" | "result">) => {
    if (busy) return;
    setBusy(true);
    try { await onSave(block.id, next); }
    catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo guardar el bloque. Inténtalo de nuevo."); }
    finally { setBusy(false); }
  };
  const base = (): Pick<BlockProgress, "startedAt" | "elapsedSeconds" | "result"> => ({ startedAt: progress?.startedAt ?? null, elapsedSeconds: progress?.elapsedSeconds ?? 0, result: result ?? null });
  const rounds = result?.rounds ?? 0;
  const limit = block.durationSeconds ?? block.timeCapSeconds;
  const interval = block.intervalSeconds ?? 60;
  const totalIntervals = block.format === "emom" ? Number(block.durationSeconds) / interval : 0;
  const currentInterval = Math.min(totalIntervals, Math.floor(elapsed / interval) + 1);
  const currentExercise = exercises[(currentInterval - 1) % Math.max(exercises.length, 1)];
  const defaultResult: BlockResult = { rounds: 0, reps: 0, durationSeconds: null, intervals: 0, completed: false, adaptation: "rx", adaptationNote: null };
  return <section aria-label={`Bloque ${block.name}`} className="mt-6 rounded-xl border border-border p-5">
    <h2 className="text-xl font-bold">{block.name}</h2>
    <p className="mt-1 text-sm text-muted-foreground">{describeBlock(block)}</p>
    {block.prescription && <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{block.prescription}</p>}
    <ol className="mt-4 space-y-3">{exercises.map((exercise, index) => <li key={exercise.workoutExerciseId} className="text-sm">
      <span className="font-semibold">{index + 1}. {exercise.name}</span>
      <p className="mt-1 text-muted-foreground">{formatTarget({ ...exercise, targetSets: 1 })}</p>
    </li>)}</ol>
    <div className="mt-5 border-t border-border pt-4">
      <p className="font-semibold tabular-nums" role="timer" aria-label={`Cronómetro de ${block.name}`}>{clock(limit ? Math.max(0, limit - elapsed) : elapsed)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{limit ? "Tiempo restante" : "Tiempo transcurrido"} · se recupera al volver a la app</p>
      {block.format === "emom" && <p className="mt-2 text-sm">Intervalo {currentInterval}/{totalIntervals} · {currentExercise?.name} · siguiente en {Math.max(0, interval - elapsed % interval)} s</p>}
      {limit !== null && elapsed >= limit && <p className="mt-2 text-sm font-semibold" role="status">Tiempo agotado. Guarda tu resultado.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" disabled={busy} variant="outline" className="min-h-11" onClick={() => void save(progress?.startedAt != null ? { ...base(), startedAt: null, elapsedSeconds: elapsedBlock(progress) } : { ...base(), startedAt: Date.now() })}>{progress?.startedAt != null ? "Pausar cronómetro" : "Iniciar cronómetro"}</Button>
        <Button type="button" disabled={busy || progress?.startedAt != null} variant="outline" className="min-h-11" onClick={() => void save({ ...base(), startedAt: null, elapsedSeconds: 0 })}>Reiniciar cronómetro</Button>
      </div>
    </div>
    {(block.format === "circuit" || block.format === "amrap") && <div className="mt-5 flex flex-wrap items-center gap-3">
      <span className="font-semibold tabular-nums">{rounds} rondas</span>
      <Button type="button" disabled={busy || block.format === "circuit" && rounds >= Number(block.rounds)} className="min-h-12" onClick={() => { setDraft((value) => ({ ...value, rounds: String(rounds + 1) })); void save({ ...base(), result: { ...defaultResult, ...result, rounds: rounds + 1, completed: block.format === "circuit" && rounds + 1 === block.rounds } }); }}>Completar ronda</Button>
      <Button type="button" variant="outline" disabled={busy || rounds === 0} className="min-h-11" onClick={() => { setDraft((value) => ({ ...value, rounds: String(rounds - 1) })); void save({ ...base(), result: { ...defaultResult, ...result, rounds: rounds - 1, completed: false } }); }}>Deshacer ronda</Button>
    </div>}
    {result && <p className="mt-4 text-sm font-semibold" role="status">Guardado: {describeResult(block, result)}</p>}
    <form className="mt-5 space-y-3 border-t border-border pt-4" onSubmit={(event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      const completed = form.get("completed") === "on";
      const next: BlockResult = {
        rounds: Number(form.get("rounds") ?? rounds), reps: Number(form.get("reps") ?? 0),
        durationSeconds: block.format === "for-time" ? !completed && block.timeCapSeconds ? block.timeCapSeconds : Number(form.get("durationSeconds")) : null,
        intervals: Number(form.get("intervals") ?? 0), completed,
        adaptation: form.get("adaptation") === "scaled" ? "scaled" : "rx", adaptationNote: String(form.get("adaptationNote") ?? "").trim() || null,
      };
      if (block.format === "for-time" && next.completed) next.rounds = Number(block.rounds);
      if (block.format === "circuit") next.completed = next.rounds === block.rounds;
      if (block.format === "emom") next.completed = next.intervals === totalIntervals;
      void save({ startedAt: null, elapsedSeconds: elapsedBlock(progress), result: next });
    }}>
      <h3 className="font-semibold">Resultado del bloque</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {(block.format !== "emom" && (block.format !== "for-time" || !draft.completed)) && <label className="grid gap-2 text-sm">Rondas completadas<Input name="rounds" type="number" min="0" max={block.format === "circuit" ? Number(block.rounds) : 10000} required value={draft.rounds} onChange={(event) => setDraft({ ...draft, rounds: event.target.value })} /></label>}
        {(block.format === "amrap" || block.format === "for-time" && !draft.completed) && <label className="grid gap-2 text-sm">Repeticiones adicionales<Input name="reps" type="number" min="0" max="100000" required value={draft.reps} onChange={(event) => setDraft({ ...draft, reps: event.target.value })} /></label>}
        {block.format === "for-time" && <div className="grid gap-2"><label className="grid gap-2 text-sm">Tiempo final (segundos)<Input name="durationSeconds" type="number" min="1" max={block.timeCapSeconds ?? 604800} required value={draft.duration} onChange={(event) => setDraft({ ...draft, duration: event.target.value })} /></label><Button type="button" variant="outline" disabled={elapsed < 1} className="min-h-11" onClick={() => setDraft({ ...draft, duration: String(elapsed) })}>Usar tiempo del cronómetro</Button></div>}
        {block.format === "emom" && <label className="grid gap-2 text-sm">Intervalos completados<Input name="intervals" type="number" min="0" max={totalIntervals} required value={draft.intervals} onChange={(event) => setDraft({ ...draft, intervals: event.target.value })} /></label>}
      </div>
      {block.format === "for-time" && <label className="flex min-h-11 items-center gap-3 text-sm"><input name="completed" type="checkbox" checked={draft.completed} onChange={(event) => setDraft({ ...draft, completed: event.target.checked })} className="size-5 accent-primary" />Completé todo el trabajo{block.timeCapSeconds ? " antes del límite" : ""}</label>}
      <label htmlFor={`${id}-adaptation`} className="grid gap-2 text-sm">Versión realizada<select id={`${id}-adaptation`} name="adaptation" aria-label="Versión realizada" value={draft.adaptation} onChange={(event) => setDraft({ ...draft, adaptation: event.target.value as "rx" | "scaled" })} className="h-12 rounded-lg border border-input bg-background px-3"><option value="rx">Según el plan (Rx)</option><option value="scaled">Adaptada (Scaled)</option></select></label>
      <label className="grid gap-2 text-sm">Cambios de carga o movimiento (obligatorio si adaptas)<Input name="adaptationNote" maxLength={1000} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="Ej.: dominadas con banda verde; 20 kg en lugar de 30" /></label>
      <Button type="submit" disabled={busy} className="min-h-12 w-full">{busy ? "Guardando…" : "Guardar resultado"}</Button>
    </form>
  </section>;
}
