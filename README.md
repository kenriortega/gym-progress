# Gym Progress

Aplicación mobile-first para registrar ejercicios, series, repeticiones y peso, y consultar el rendimiento de la sesión anterior.

## Stack

- Next.js con App Router, TypeScript y Tailwind CSS.
- PostgreSQL estándar.
- Drizzle ORM y migraciones SQL versionadas.
- Auth.js con sesiones persistidas en PostgreSQL.
- PostgreSQL local opcional mediante Docker Compose.

La aplicación usa una sola variable `DATABASE_URL`, por lo que no depende de un proveedor específico. En producción puede conectarse a cualquier PostgreSQL accesible desde el servidor de Next.js.

## Primer inicio

1. Crea el archivo local de variables:

   ```bash
   cp .env.example .env.local
   ```

2. Inicia PostgreSQL:

   ```bash
   docker compose up -d
   ```

3. Genera y aplica las migraciones:

   ```bash
   npm run db:generate
   npm run db:migrate
   ```

4. Inicia la aplicación:

   ```bash
   npm run dev
   ```

Abre `http://localhost:3000`.

## Configurar Google OAuth

1. Crea un cliente OAuth para aplicación web en Google Cloud.
2. Añade esta URL de redirección autorizada para desarrollo:

   ```text
   http://localhost:3000/api/auth/callback/google
   ```

3. Completa en `.env.local`:

   ```text
   AUTH_GOOGLE_ID=...
   AUTH_GOOGLE_SECRET=...
   ```

4. Antes de publicar, sustituye también `AUTH_SECRET` por un valor aleatorio generado con:

   ```bash
   npx auth secret
   ```

La pantalla `/login` mantendrá deshabilitado el botón de Google mientras detecte los valores de ejemplo.

## Comandos

- `npm run dev`: servidor de desarrollo.
- `npm run build`: compilación de producción.
- `npm run lint`: análisis estático.
- `npm run db:generate`: genera migraciones desde `src/db/schema.ts`.
- `npm run db:migrate`: aplica las migraciones pendientes.
- `npm run db:studio`: abre el explorador local de Drizzle.

## Modelo de datos

- `users`: propietario de los datos y preferencia kg/lb.
- `accounts`: identidad OAuth asociada al usuario.
- `sessions`: sesiones activas almacenadas en PostgreSQL.
- `exercises`: catálogo global y ejercicios personalizados.
- `training_plans`: planes reutilizables vinculados a un día de la semana.
- `training_plan_exercises`: ejercicios ordenados y objetivos de series/repeticiones de cada plan.
- `workouts`: sesiones activas, completadas o abandonadas, opcionalmente originadas desde un plan.
- `workout_exercises`: orden y notas de cada ejercicio dentro de una sesión.
- `workout_sets`: repeticiones, peso, RPE y orden de las series.

El navegador nunca debe conectarse directamente a PostgreSQL. Las consultas se ejecutarán en el servidor y siempre filtrarán por el usuario autenticado.

## Estado actual

La aplicación ya contiene PostgreSQL local, migraciones, autenticación con Google, sesiones persistentes, protección del dashboard y un recorrido basado en planes diarios.

El recorrido permite:

- Crear planes por día con ejercicios y objetivos de series/repeticiones.
- Ver el plan programado para hoy e iniciarlo desde el dashboard.
- Iniciar un plan carga automáticamente todos sus ejercicios en orden.
- Iniciar o reanudar un entrenamiento activo sin perder las series registradas.
- Añadir ejercicios del catálogo.
- Consultar las series de la última sesión para ese ejercicio.
- Registrar peso y repeticiones serie por serie.
- Copiar automáticamente los valores de la serie anterior en el siguiente formulario.
- Eliminar una serie incorrecta.
- Finalizar el entrenamiento y usarlo como referencia en la siguiente sesión.
- Consultar el historial completo y abrir el detalle de ejercicios y series de cada sesión.

## Próximo incremento

1. Permitir reordenar y editar los objetivos de los ejercicios de un plan.
2. Añadir estados visuales de guardado y errores de formulario.
3. Permitir editar series ya registradas.
4. Incorporar un temporizador de descanso.
5. Añadir historial completo y progreso por ejercicio.
6. Incorporar una cola local para conexiones intermitentes.
