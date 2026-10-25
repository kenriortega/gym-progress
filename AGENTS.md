<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Publicación en producción

Cuando el usuario autorice publicar este proyecto, seguir siempre este orden:

1. Aplicar y verificar las migraciones pendientes en producción (Neon), con
   copia de seguridad previa. La configuración de producción es `.env.neon` y
   el comando del proyecto es `npm run db:migrate:prod`.
2. Actualizar `src/lib/changelog.ts` con las novedades visibles para el usuario.
3. Ejecutar las validaciones pertinentes y crear los commits necesarios.
4. Hacer push del código a `origin/main`; Vercel se encarga del despliegue.

No hacer push si falla una migración o una validación requerida. No ejecutar
un despliegue manual de Vercel salvo que el usuario lo solicite. Conservar fuera
de Git las credenciales y los backups, y respetar los cambios ajenos a la entrega.
