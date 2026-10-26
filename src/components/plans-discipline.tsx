"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { DISCIPLINES, validDiscipline, type Discipline } from "@/lib/training-blocks";
import { prioritizePlans } from "@/lib/plan-order";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PlansDisciplineContext = createContext({
  discipline: "strength" as Discipline,
  setDiscipline: (() => {}) as (value: Discipline) => void,
});

export function PlansDisciplineProvider({ children }: { children: ReactNode }) {
  const [discipline, setDiscipline] = useState<Discipline>("strength");
  return (
    <PlansDisciplineContext.Provider value={{ discipline, setDiscipline }}>
      {children}
    </PlansDisciplineContext.Provider>
  );
}

export function usePlansDiscipline() {
  return useContext(PlansDisciplineContext).discipline;
}

export function PlansDisciplineSelect() {
  const { discipline, setDiscipline } = useContext(PlansDisciplineContext);
  return (
    <div>
      <Select name="discipline" items={DISCIPLINES} value={discipline}
        onValueChange={(value) => { if (validDiscipline(value)) setDiscipline(value); }}>
        <SelectTrigger aria-label="Disciplina" aria-describedby="discipline-order-hint"
          className="h-12 w-full rounded-xl px-4 text-base font-semibold">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(DISCIPLINES).map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p id="discipline-order-hint" className="mt-2 text-sm text-primary-foreground/75">
        También muestra primero los planes y plantillas de esta disciplina.
      </p>
    </div>
  );
}

export function DisciplineOrderedPlans({ items }: {
  items: { id: string; discipline: Discipline; content: ReactNode }[];
}) {
  const discipline = usePlansDiscipline();
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {prioritizePlans(items, discipline).map((item) => (
        <div key={item.id} className="min-w-0">{item.content}</div>
      ))}
    </div>
  );
}
