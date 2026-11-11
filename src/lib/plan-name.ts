/**
 * «Especialización · Brazos · 8 microciclos · PIERNA 1» no cabe en ninguna
 * parte: ni bajo la inicial de un día, ni dentro de un botón —que además nace
 * con `whitespace-nowrap` y se desborda por los dos lados en vez de partirse.
 *
 * El último tramo es el que distingue una sesión del programa de sus hermanas
 * —«Pierna 1», «Torso 2»— y es el que se dice en voz alta. Pero no siempre:
 * en «Día suave · Barras, core y carrera» el último tramo es la lista de lo
 * que hay dentro y el primero es el nombre. Así que el último si cabe, y si no
 * el primero, que en esos nombres es el corto.
 */
export function shortPlanName(name: string, max = 12): string {
  const parts = name.split("·").map((part) => part.trim()).filter(Boolean);
  const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  const last = capitalise(parts.at(-1) ?? name.trim());
  if (last.length <= max) return last;
  const first = capitalise(parts[0] ?? name.trim());
  if (first.length <= max) return first;
  return `${last.slice(0, max - 1).trimEnd()}…`;
}
