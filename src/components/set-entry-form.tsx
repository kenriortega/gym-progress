"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    <Button type="submit" disabled={pending} className="mt-6 h-12">
      {pending ? "Guardando…" : "+ Serie"}
    </Button>
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
    if (state.status === "idle" || state.savedAt === 0) return;
    if (state.status === "success") {
      toast.success(state.message);
    } else {
      toast.error(state.message);
    }
  }, [state.savedAt, state.status, state.message]);

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
    <div className="border-t border-border p-5">
      <form action={formAction}>
        <input type="hidden" name="workoutId" value={workoutId} />
        <input
          type="hidden"
          name="workoutExerciseId"
          value={workoutExerciseId}
        />
        <div className="grid grid-cols-[1fr_1fr_4.5rem] gap-2">
          <label className="text-xs font-bold text-muted-foreground">
            PESO KG
            <Input
              name="weight"
              type="number"
              inputMode="decimal"
              min="0"
              max="99999"
              step="0.01"
              required
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              className="mt-2 h-12 text-center text-lg font-semibold"
            />
          </label>
          <label className="text-xs font-bold text-muted-foreground">
            REPS
            <Input
              name="reps"
              type="number"
              inputMode="numeric"
              min="1"
              max="1000"
              step="1"
              required
              value={reps}
              onChange={(event) => setReps(event.target.value)}
              className="mt-2 h-12 text-center text-lg font-semibold"
            />
          </label>
          <SubmitSeriesButton />
        </div>

      </form>

      <Collapsible className="mt-3 rounded-xl border border-border bg-muted/40 p-3">
        <CollapsibleTrigger className="w-full text-left text-sm font-medium text-muted-foreground">
          Calcular el peso en kg
        </CollapsibleTrigger>
        <CollapsibleContent>
        <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Cómo está cargado el peso">
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
          onClick={() => setWeight(calculatedWeight.toFixed(2))}
          className="mt-3 h-11 w-full"
        >
          Usar {calculatedWeight.toFixed(2)} kg
        </Button>
        </CollapsibleContent>
      </Collapsible>

      <div className="mt-3 flex items-center justify-between rounded-xl bg-card px-3 py-2">
        <label className="text-xs font-semibold text-muted-foreground">
          Descanso
          <Select
            value={String(restSeconds)}
            onValueChange={(value) => setRestSeconds(Number(value))}
          >
            <SelectTrigger className="ml-2 h-8 w-24" aria-label="Tiempo de descanso">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[60, 90, 120, 180].map((seconds) => (
                <SelectItem key={seconds} value={String(seconds)}>
                  {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <span
          className={`font-mono text-sm font-black ${remaining > 0 ? "text-primary" : "text-muted-foreground"}`}
        >
          {remaining > 0
            ? `${minutes}:${String(seconds).padStart(2, "0")}`
            : "Listo"}
        </span>
      </div>
    </div>
  );
}
