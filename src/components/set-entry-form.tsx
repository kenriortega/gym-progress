"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  addSetWithState,
  type SetActionState,
} from "@/app/actions/workouts";

const LB_TO_KG = 0.45359237;

type LoadMode = "perSide" | "single";

const initialState: SetActionState = {
  status: "idle",
  message: "",
  savedAt: 0,
};

function SubmitSeriesButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-6 h-12 rounded-xl bg-lime-300 text-sm font-black text-zinc-950 transition hover:bg-lime-200 disabled:cursor-wait disabled:bg-zinc-700 disabled:text-zinc-400"
    >
      {pending ? "Guardando…" : "+ Serie"}
    </button>
  );
}

type SetEntryFormProps = {
  workoutId: string;
  workoutExerciseId: string;
  defaultWeight: number | null;
  defaultReps: number | null;
};

export function SetEntryForm({
  workoutId,
  workoutExerciseId,
  defaultWeight,
  defaultReps,
}: SetEntryFormProps) {
  const [state, formAction] = useActionState(addSetWithState, initialState);
  const [weight, setWeight] = useState(defaultWeight?.toString() ?? "");
  const [reps, setReps] = useState(defaultReps?.toString() ?? "");
  const [loadMode, setLoadMode] = useState<LoadMode>("perSide");
  const [barKg, setBarKg] = useState("20");
  const [kgPerSide, setKgPerSide] = useState("0");
  const [lbPerSide, setLbPerSide] = useState("0");
  const [restSeconds, setRestSeconds] = useState(90);
  const [remaining, setRemaining] = useState(0);

  const sides = loadMode === "perSide" ? 2 : 1;

  const calculatedWeight = useMemo(() => {
    const bar = Number(barKg) || 0;
    const kg = Number(kgPerSide) || 0;
    const lb = Number(lbPerSide) || 0;
    return (
      Math.round((bar + (kg + lb * LB_TO_KG) * sides) * 100) / 100
    );
  }, [barKg, kgPerSide, lbPerSide, sides]);

  const [lastSavedAt, setLastSavedAt] = useState(0);
  if (state.status === "success" && state.savedAt > lastSavedAt) {
    setLastSavedAt(state.savedAt);
    setRemaining(restSeconds);
  }

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setInterval(() => {
      setRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [remaining]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className="border-t border-white/8 p-5">
      <form action={formAction}>
        <input type="hidden" name="workoutId" value={workoutId} />
        <input
          type="hidden"
          name="workoutExerciseId"
          value={workoutExerciseId}
        />
        <div className="grid grid-cols-[1fr_1fr_4.5rem] gap-2">
          <label className="text-xs font-bold text-zinc-500">
            PESO KG
            <input
              name="weight"
              type="number"
              inputMode="decimal"
              min="0"
              max="99999"
              step="0.01"
              required
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 text-center text-lg font-bold text-white outline-none focus:border-lime-300"
            />
          </label>
          <label className="text-xs font-bold text-zinc-500">
            REPS
            <input
              name="reps"
              type="number"
              inputMode="numeric"
              min="1"
              max="1000"
              step="1"
              required
              value={reps}
              onChange={(event) => setReps(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 text-center text-lg font-bold text-white outline-none focus:border-lime-300"
            />
          </label>
          <SubmitSeriesButton />
        </div>

        {state.status !== "idle" && (
          <p
            aria-live="polite"
            className={`mt-3 rounded-xl px-3 py-2 text-sm font-semibold ${
              state.status === "success"
                ? "bg-lime-300/10 text-lime-200"
                : "bg-red-400/10 text-red-300"
            }`}
          >
            {state.message}
          </p>
        )}
      </form>

      <details className="mt-3 rounded-xl border border-white/8 bg-black/10 p-3">
        <summary className="cursor-pointer text-sm font-bold text-zinc-400">
          Calcular el peso en kg
        </summary>
        <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Cómo está cargado el peso">
          {(
            [
              ["perSide", "Barra · dos lados"],
              ["single", "Un lado o mancuerna"],
            ] as Array<[LoadMode, string]>
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              aria-pressed={loadMode === mode}
              onClick={() => {
                setLoadMode(mode);
                setBarKg(mode === "perSide" ? "20" : "0");
              }}
              className={`h-10 rounded-xl text-xs font-black transition ${
                loadMode === mode
                  ? "bg-sky-300 text-zinc-950"
                  : "bg-white/5 text-zinc-400 hover:bg-white/10"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <label className="text-[11px] font-bold text-zinc-500">
            {loadMode === "perSide" ? "BARRA KG" : "MANGO KG"}
            <input
              type="number"
              min="0"
              step="0.01"
              value={barKg}
              onChange={(event) => setBarKg(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-zinc-900 px-2 text-center font-bold text-white"
            />
          </label>
          <label className="text-[11px] font-bold text-zinc-500">
            {loadMode === "perSide" ? "KG POR LADO" : "KG"}
            <input
              type="number"
              min="0"
              step="0.01"
              value={kgPerSide}
              onChange={(event) => setKgPerSide(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-zinc-900 px-2 text-center font-bold text-white"
            />
          </label>
          <label className="text-[11px] font-bold text-zinc-500">
            {loadMode === "perSide" ? "LB POR LADO" : "LB"}
            <input
              type="number"
              min="0"
              step="0.01"
              value={lbPerSide}
              onChange={(event) => setLbPerSide(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-zinc-900 px-2 text-center font-bold text-white"
            />
          </label>
        </div>
        <p className="mt-3 text-xs leading-5 text-zinc-500">
          {loadMode === "perSide"
            ? "Total = barra + los dos lados. Las libras se convierten automáticamente."
            : "Total = mango + los discos que indiques, una sola vez. Deja el mango en 0 si solo quieres convertir un disco suelto."}
        </p>
        <button
          type="button"
          onClick={() => setWeight(calculatedWeight.toFixed(2))}
          className="mt-3 h-11 w-full rounded-xl bg-sky-300 text-sm font-black text-zinc-950"
        >
          Usar {calculatedWeight.toFixed(2)} kg
        </button>
      </details>

      <div className="mt-3 flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2">
        <label className="text-xs font-semibold text-zinc-500">
          Descanso
          <select
            value={restSeconds}
            onChange={(event) => setRestSeconds(Number(event.target.value))}
            className="ml-2 rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-white"
          >
            <option value={60}>1:00</option>
            <option value={90}>1:30</option>
            <option value={120}>2:00</option>
            <option value={180}>3:00</option>
          </select>
        </label>
        <span
          className={`font-mono text-sm font-black ${remaining > 0 ? "text-lime-300" : "text-zinc-600"}`}
        >
          {remaining > 0
            ? `${minutes}:${String(seconds).padStart(2, "0")}`
            : "Listo"}
        </span>
      </div>
    </div>
  );
}
