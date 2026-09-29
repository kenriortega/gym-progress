#!/usr/bin/env bash
# Copia de seguridad de la base de datos de producción (Neon).
#
# Neon guarda solo 6 horas de historial en el plan gratuito. Esto crea un
# volcado completo que tú controlas y que no depende de esa ventana.
#
#   ./scripts/backup.sh              → guarda en ./backups/
#   ./scripts/backup.sh /otra/ruta   → guarda donde le digas
#
# Restaurar:
#   gunzip -c backups/FICHERO.sql.gz | docker run -i --rm postgres:18-alpine psql "URL"

set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env.neon ]; then
  echo "Falta .env.neon con la URL de producción." >&2
  exit 1
fi

# La conexión directa, no la agrupada: los volcados son sesiones largas.
URL=$(grep '^DATABASE_URL_UNPOOLED=' .env.neon | cut -d= -f2- | tr -d '"')
if [ -z "$URL" ]; then
  URL=$(grep '^DATABASE_URL=' .env.neon | cut -d= -f2- | tr -d '"')
fi

DESTINO="${1:-./backups}"
mkdir -p "$DESTINO"
FICHERO="$DESTINO/gym-progress-$(date +%Y%m%d-%H%M%S).sql.gz"

echo "Volcando la base de datos de producción…"
docker run --rm postgres:18-alpine pg_dump "$URL" --no-owner --no-privileges \
  | gzip > "$FICHERO"

TAMANO=$(du -h "$FICHERO" | cut -f1)
echo "Copia creada: $FICHERO ($TAMANO)"

# Comprobación mínima: que el volcado contenga las tablas esperadas.
TABLAS=$(gunzip -c "$FICHERO" | grep -c "^CREATE TABLE" || true)
echo "Tablas en la copia: $TABLAS"
if [ "$TABLAS" -lt 9 ]; then
  echo "AVISO: se esperaban al menos 9 tablas. Revisa la copia." >&2
  exit 1
fi

# Se conservan las 14 últimas.
ls -1t "$DESTINO"/gym-progress-*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm --
echo "Copias guardadas: $(ls -1 "$DESTINO"/gym-progress-*.sql.gz 2>/dev/null | wc -l | tr -d ' ')"
