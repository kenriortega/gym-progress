# Gym Progress

Aplicación para registrar entrenamientos de gimnasio desde el móvil: planes por día, series, repeticiones y peso, con el historial de la sesión anterior siempre a la vista.

Está pensada para usarse **dentro del gimnasio, donde la cobertura falla**. La pantalla de entrenamiento funciona sin conexión y lo que anotas se envía solo cuando vuelve la señal.

En producción: <https://gym-progress-ochre.vercel.app>

## Stack

- **Next.js 16** con App Router y React 19. La compilación usa webpack (`next build --webpack`), no Turbopack, porque Serwist añade configuración de webpack.
- **TypeScript** y **Tailwind CSS 4**.
- **shadcn/ui** sobre **Base UI**, estilo `base-nova`. Paleta monocroma con acento verde: lima en tema oscuro, verde profundo en claro.
- **PostgreSQL** con **Drizzle ORM** y migraciones SQL versionadas.
- **Auth.js** con Google y sesiones persistidas en la base de datos.
- **Serwist** para el service worker, **IndexedDB** para la cola offline.
- **Vercel Web Analytics**, con los identificadores de las URLs redactados antes de enviarse.

La aplicación se conecta con una sola variable `DATABASE_URL` usando el cliente `pg` estándar. No hay nada atado a un proveedor concreto: funciona igual en Neon, en un VPS o en Docker local.

## Primer inicio

```bash
cp .env.example .env.local   # 1. variables locales
docker compose up -d         # 2. PostgreSQL en Docker
npm install                  # 3. dependencias
npm run db:migrate           # 4. esquema y catálogo de ejercicios
npm run dev                  # 5. servidor de desarrollo
```

Abre <http://localhost:3000>.

Las migraciones siembran el catálogo: 44 ejercicios repartidos en ocho grupos musculares.

### Google OAuth

1. Crea un cliente OAuth de tipo aplicación web en Google Cloud.
2. Añade como URI de redirección autorizada:

   ```text
   http://localhost:3000/api/auth/callback/google
   ```

3. Rellena `AUTH_GOOGLE_ID` y `AUTH_GOOGLE_SECRET` en `.env.local`.
4. Genera un `AUTH_SECRET` propio con `npx auth secret`.

Mientras detecte los valores de ejemplo, `/login` deja el botón de Google deshabilitado.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (Turbopack; el service worker va desactivado). |
| `npm run build` | Compilación de producción. Genera `public/sw.js`. |
| `npm run lint` | Análisis estático. |
| `npm run db:generate` | Genera migraciones a partir de `src/db/schema.ts`. |
| `npm run db:migrate` | Aplica las migraciones pendientes **en local**. |
| `npm run db:migrate:prod` | Las aplica **en producción**, leyendo `.env.neon`. |
| `npm run db:studio` | Explorador de la base de datos. |
| `./scripts/backup.sh` | Volcado comprimido de la base de producción. |

## Entornos y variables

| Archivo | Para qué | ¿En git? |
|---|---|---|
| `.env.local` | Desarrollo: apunta al PostgreSQL de Docker. | no |
| `.env.neon` | Credenciales de producción, solo para migrar y hacer copias. | no |
| `.env.example` | Plantilla documentada. | sí |

En producción las variables viven en Vercel: `DATABASE_URL` (la de Neon **con `-pooler`**), `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` y `AUTH_TRUST_HOST=true`.

> `neon link` y `neon deploy` sobrescriben `DATABASE_URL` en `.env.local`. Usa `neon deploy --no-env-pull` para no perder el apuntador al Docker local.

## Modelo de datos

- `users` — propietario de los datos y su preferencia kg/lb.
- `accounts`, `sessions` — identidad de Google y sesiones activas.
- `exercises` — catálogo. Con `user_id` nulo son del sistema; con valor, propios de esa persona.
- `training_plans` — planes reutilizables, con día de la semana opcional y archivado lógico.
- `training_plan_exercises` — ejercicios ordenados y objetivos de series y repeticiones.
- `workouts` — sesiones activas, completadas o abandonadas. Un índice único garantiza **una sola activa por usuario**.
- `workout_exercises` — orden, notas y **objetivos congelados** al iniciar la sesión.
- `workout_sets` — repeticiones, peso, RPE y orden.

Dos decisiones que conviene conocer antes de tocar el esquema:

**Los objetivos se copian a la sesión al empezarla.** Editar un plan no reescribe los entrenamientos pasados ni mueve el objetivo de una sesión en curso.

**Los identificadores de las series los genera el móvil.** Es lo que permite reenviar la cola sin duplicar: el servidor inserta ignorando el conflicto por id.

El navegador nunca habla directamente con PostgreSQL. Todas las consultas se ejecutan en el servidor filtrando por el usuario autenticado.

## Pantallas

| Ruta | Qué es |
|---|---|
| `/` | Inicio: plan de hoy, tus planes y resumen del último entrenamiento. |
| `/entreno` | **Entrenamiento. Funciona sin conexión.** Estática y precacheada. |
| `/workout/[id]` | Ajustes de la sesión: reordenar, editar objetivos, notas. Necesita red. |
| `/plans`, `/plans/[id]` | Planes, plantillas y archivados. |
| `/progress`, `/exercises/[id]` | Récords y evolución por ejercicio. |
| `/history`, `/history/[id]` | Historial de sesiones. |
| `/ajustes`, `/ayuda`, `/novedades` | Unidad de peso, guía de uso y registro de cambios. |
| `/privacidad`, `/terminos` | Páginas legales, públicas porque Google las consulta sin sesión. |
| `/api/snapshot`, `/api/sync` | Descarga de la sesión y recepción de la cola offline. |

## Cómo funciona sin conexión

1. Al abrir `/entreno` con red, la app descarga la sesión completa (`/api/snapshot`) y la guarda en IndexedDB. Son unos 650 bytes por ejercicio.
2. La pantalla se pinta desde esa copia, haya red o no.
3. Al registrar, editar o borrar una serie, el cambio se ve al instante, se guarda en el móvil y se encola.
4. Al volver la conexión, la cola se envía en orden a `/api/sync`. Todas las operaciones son idempotentes.

**Lo que todavía necesita red:** empezar un entrenamiento, iniciar sesión, y las pantallas de historial y progreso.

## Despliegue

**Vercel** es el despliegue actual, con la base en Neon. El cliente OAuth está publicado, así que no aparece el aviso de aplicación no verificada.

**Autoalojamiento**: `deploy/docker-compose.yml` levanta PostgreSQL, PgBouncer y dos instancias de la app, pensado para Dokploy en un VPS. Medido en marcha, el conjunto consume unos 134 MB de memoria.

Dos detalles que no son evidentes y están documentados en ese archivo:

- Las dos instancias **deben compartir `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`**. Sin eso, una instancia no puede descifrar una server action cifrada por la otra y fallan todas las escrituras.
- PgBouncer va en modo `transaction` con `server_reset_query` vacío.

## Copias de seguridad

Neon conserva **6 horas** de historial en el plan gratuito, que no basta para notar un descuido al día siguiente. `./scripts/backup.sh` genera un volcado propio y comprueba que contenga las tablas esperadas antes de darlo por bueno.

Hay un flujo de GitHub Actions en `.github/workflows/backup.yml`, **desactivado a propósito**: el cron está comentado. Para activarlo hace falta el secreto `DATABASE_URL_UNPOOLED`. No lo actives en un repositorio público: los artefactos contienen datos reales de personas.

## Convenciones

- Los textos de la interfaz están en español. El código y los nombres de archivo, en inglés, salvo los módulos nuevos del lado offline.
- Los colores se definen con tokens (`bg-card`, `text-muted-foreground`, `bg-primary`), nunca con valores sueltos de la paleta.
- Todo lo que se nota al usar la app se anota en `src/lib/changelog.ts`, escrito para quien la usa y no para quien la programa.
