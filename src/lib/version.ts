/**
 * Identificador del despliegue, fijado al compilar. Sirve para que alguien
 * pueda decir "tengo la 1a2b3c4" y saber si le falta una actualización.
 */
export type AppVersion = {
  commit: string | null;
  buildTime: Date | null;
  label: string;
};

export function getAppVersion(): AppVersion {
  const sha = process.env.APP_COMMIT;
  const commit = sha ? sha.slice(0, 7) : null;

  const raw = process.env.APP_BUILD_TIME;
  const parsed = raw ? new Date(raw) : null;
  const buildTime = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;

  const fecha = buildTime
    ? new Intl.DateTimeFormat("es", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(buildTime)
    : null;

  const partes = [commit ?? "local", fecha].filter(Boolean);

  return { commit, buildTime, label: partes.join(" · ") };
}
