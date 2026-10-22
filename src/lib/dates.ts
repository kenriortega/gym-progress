/**
 * Un "YYYY-MM-DD" a Date local. `new Date("2026-10-24")` lo lee como medianoche
 * UTC, así que al formatearlo en una zona negativa sale el día anterior: los
 * tooltips del heatmap decían sábado 24 donde la rejilla tenía el domingo 25.
 */
export const localDate = (day: string) => {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year!, month! - 1, date!);
};

/** Una Date a "YYYY-MM-DD" en su propia zona, sin pasar por UTC. */
export const dayOf = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};
