export type WeightUnit = "kg" | "lb";
export type WeightDisplayMode = WeightUnit | "both";
export const bodyWeightUnit = (system: "metric" | "imperial"): WeightUnit => system === "imperial" ? "lb" : "kg";
export const isWeightDisplayMode = (value: unknown): value is WeightDisplayMode => value === "kg" || value === "lb" || value === "both";

export const LB_TO_KG = 0.45359237;

/** Convertir siempre desde el registro original, sin redondear cálculos. */
export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  return from === "lb" ? value * LB_TO_KG : value / LB_TO_KG;
}

const weightFormatter = new Intl.NumberFormat("es", { maximumFractionDigits: 2 });

/** El redondeo pertenece a la presentación, nunca al valor registrado. */
export function formatWeight(value: number): string {
  return weightFormatter.format(value);
}

export function weightLabel(value: number, from: WeightUnit, mode: WeightDisplayMode, primary: WeightUnit = "kg"): string {
  const unit = mode === "both" ? primary : mode;
  const first = `${formatWeight(convertWeight(value, from, unit))} ${unit}`;
  const other = unit === "kg" ? "lb" : "kg";
  return mode === "both" ? `${first} · ${formatWeight(convertWeight(value, from, other))} ${other}` : first;
}
