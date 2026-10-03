"use client";

import { PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@/components/ui/combobox";
import { FormSelect } from "@/components/form-select";
import { Label } from "@/components/ui/label";

export type PickerExercise = {
  id: string;
  name: string;
  muscleGroup: string;
};

/**
 * Grupos del catálogo, más dos de escape. Deben coincidir con los que usa la
 * tabla de ejercicios: si no, el progreso quedaría repartido entre "Abdomen"
 * y "Core" como si fueran cosas distintas.
 */
const GRUPOS = [
  "Pecho",
  "Espalda",
  "Piernas",
  "Glúteos",
  "Hombros",
  "Bíceps",
  "Tríceps",
  "Abdomen",
  "Cardio",
  "Otros",
];

/**
 * Buscador de ejercicios que además permite crear el que falte.
 *
 * Escribes y filtra el catálogo; si lo que escribes no existe, se ofrece
 * crearlo. El formulario envía `exerciseId` cuando eliges uno existente, o
 * `exerciseName` y `muscleGroup` cuando es nuevo, y el servidor decide.
 */
export function ExercisePicker({
  exercises,
  disabled,
  emptyLabel = "Todos añadidos",
}: {
  exercises: PickerExercise[];
  disabled?: boolean;
  emptyLabel?: string;
}) {
  const [elegido, setElegido] = useState<PickerExercise | null>(null);
  const [texto, setTexto] = useState("");

  const grupos = useMemo(() => {
    const mapa = new Map<string, PickerExercise[]>();
    for (const ejercicio of exercises) {
      mapa.set(ejercicio.muscleGroup, [
        ...(mapa.get(ejercicio.muscleGroup) ?? []),
        ejercicio,
      ]);
    }
    return Array.from(mapa.entries());
  }, [exercises]);

  const escrito = texto.trim();
  // Solo se ofrece crear si no hay ninguno con ese nombre exacto.
  const puedeCrear =
    escrito.length >= 2 &&
    !exercises.some((e) => e.name.toLowerCase() === escrito.toLowerCase());
  const creando = elegido === null && puedeCrear;

  return (
    <div className="grid gap-3">
      {/* Lo que lee la server action. */}
      <input type="hidden" name="exerciseId" value={elegido?.id ?? ""} />
      {creando ? (
        <input type="hidden" name="exerciseName" value={escrito} />
      ) : null}

      <Combobox
        items={exercises}
        itemToStringLabel={(item: PickerExercise) => item.name}
        value={elegido}
        onValueChange={(valor: PickerExercise | null) => setElegido(valor)}
        inputValue={texto}
        onInputValueChange={(valor: string) => setTexto(valor)}
        disabled={disabled}
      >
        <ComboboxInput
          placeholder={disabled ? emptyLabel : "Busca o escribe un ejercicio"}
          className="h-12 text-base"
          aria-label="Ejercicio"
        />
        <ComboboxContent className="max-h-80">
          <ComboboxEmpty>
            {escrito.length >= 2
              ? "No está en la lista. Puedes crearlo abajo."
              : "Escribe para buscar"}
          </ComboboxEmpty>
          <ComboboxList>
            {grupos.map(([grupo, items]) => (
              <ComboboxGroup key={grupo} items={items}>
                <ComboboxLabel>{grupo}</ComboboxLabel>
                {items.map((ejercicio) => (
                  <ComboboxItem key={ejercicio.id} value={ejercicio}>
                    {ejercicio.name}
                  </ComboboxItem>
                ))}
              </ComboboxGroup>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      {creando ? (
        <div className="grid gap-2 rounded-xl border border-dashed border-border p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <PlusIcon className="size-4" />
            Crear «{escrito}»
          </p>
          <Label htmlFor="muscleGroup" className="text-xs text-muted-foreground">
            ¿De qué grupo es? Se usa para ordenar tu progreso.
          </Label>
          <FormSelect
            id="muscleGroup"
            name="muscleGroup"
            defaultValue="Otros"
            placeholder="Grupo muscular"
            options={GRUPOS.map((g) => ({ value: g, label: g }))}
            className="h-11 w-full rounded-xl px-3"
            aria-label="Grupo muscular"
          />
          <p className="text-xs leading-5 text-muted-foreground">
            Al ser nuevo, no tendrá «Última vez» ni sugerencia de peso hasta que
            lo entrenes un par de veces.
          </p>
        </div>
      ) : null}
    </div>
  );
}
