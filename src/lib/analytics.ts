/**
 * Las URLs de la app llevan identificadores dentro —/workout/<uuid>,
 * /plans/<uuid>—, así que se sustituyen antes de que el evento salga del
 * navegador. Queda "/workout/[id]", que es lo que de verdad interesa saber,
 * sin mandar a qué entrenamiento concreto entró nadie.
 */
const UUID =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

/** Vale tanto para una URL completa como para una ruta suelta. */
export function redactUrl(raw: string): string {
  if (raw.startsWith("/")) {
    // Ruta sin origen: solo hay que limpiar el camino.
    const [path] = raw.split("?");
    return path.replace(UUID, "[id]");
  }
  try {
    const url = new URL(raw);
    url.pathname = url.pathname.replace(UUID, "[id]");
    // Ninguna pantalla necesita parámetros de consulta para su analítica.
    url.search = "";
    return url.toString();
  } catch {
    return raw;
  }
}

/**
 * PostHog reparte la dirección actual por varias propiedades según el evento
 * ($current_url, $pathname, $referrer, las $initial_* de la persona...) y va
 * añadiendo más con cada versión. En vez de ir listándolas una a una, se
 * limpia cualquier propiedad de texto cuyo nombre hable de una dirección.
 */
function esPropiedadDeDireccion(key: string): boolean {
  const k = key.toLowerCase();
  return k.includes("url") || k.includes("pathname") || k.includes("referrer");
}

export function redactProperties<T extends Record<string, unknown>>(props: T): T {
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === "string" && esPropiedadDeDireccion(key)) {
      (props as Record<string, unknown>)[key] = redactUrl(value);
    }
  }
  return props;
}
