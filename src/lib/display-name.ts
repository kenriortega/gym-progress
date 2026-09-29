/**
 * Nombre corto para saludar. Google suele devolver el nombre completo con
 * iniciales sueltas delante ("J. Enrique Ortega"), así que se salta las
 * iniciales y se queda con la primera palabra real.
 */
export function greetingName(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  const isInitial = (word: string) => word.replace(/\./g, "").length <= 1;

  return words.find((word) => !isInitial(word)) ?? words[0] ?? "Atleta";
}
