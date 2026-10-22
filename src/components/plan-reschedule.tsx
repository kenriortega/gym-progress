"use client";

import { cancelReschedule, reschedulePlan } from "@/app/actions/plans";
import { PendingButton } from "@/components/pending-button";
import { dayOf, localDate } from "@/lib/dates";
import { nextDays, nextOccurrence } from "@/lib/schedule";

const formatter = new Intl.DateTimeFormat("es", {
  weekday: "long",
  day: "numeric",
  month: "short",
});
const label = (day: string) => formatter.format(localDate(day));

/**
 * Es de cliente por una razón sola: el día de hoy lo tiene que poner el
 * navegador. En el servidor es la zona de Vercel, y un domingo a las 23:00 en
 * Madrid allí ya es lunes, así que "la próxima vez que toca" saldría corrido.
 */
export function PlanReschedule({
  planId,
  weekday,
  movedTo,
}: {
  planId: string;
  weekday: number;
  /** El día al que ya está movido, si lo está. */
  movedTo: { fromDate: string; toDate: string } | null;
}) {
  const today = dayOf(new Date());

  if (movedTo) {
    return (
      <form
        action={cancelReschedule}
        className="mt-2 flex items-center gap-2 px-1"
      >
        <input type="hidden" name="planId" value={planId} />
        <input type="hidden" name="fromDate" value={movedTo.fromDate} />
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          Movido al{" "}
          <span className="font-semibold text-foreground">
            {label(movedTo.toDate)}
          </span>
        </p>
        <PendingButton
          type="submit"
          variant="ghost"
          pendingLabel="…"
          className="h-7 shrink-0 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          Deshacer
        </PendingButton>
      </form>
    );
  }

  const from = nextOccurrence(weekday, new Date());

  return (
    <form action={reschedulePlan} className="mt-2 flex items-center gap-2 px-1">
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="today" value={today} />
      <label className="sr-only" htmlFor={`mover-${planId}`}>
        Mover esta sesión a otro día
      </label>
      <select
        id={`mover-${planId}`}
        name="toDate"
        defaultValue=""
        required
        className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-transparent px-2 text-xs text-muted-foreground"
      >
        <option value="" disabled>
          Mover el {from ? label(from) : "próximo día"} a…
        </option>
        {nextDays(new Date())
          .filter((day) => day !== from)
          .map((day) => (
            <option key={day} value={day}>
              {label(day)}
            </option>
          ))}
      </select>
      <PendingButton
        type="submit"
        variant="ghost"
        pendingLabel="…"
        className="h-7 shrink-0 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        Mover
      </PendingButton>
    </form>
  );
}
