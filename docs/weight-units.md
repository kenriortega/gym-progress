# Unidades de peso

## Comportamiento para el usuario

- Ajustes permite combinar **medidas corporales métricas o imperiales** con
  **entrenamiento en kg o lb**. Actualmente las medidas corporales de la app
  son el peso y su objetivo; no se añaden altura ni perímetros.
- El peso corporal, su formulario, el objetivo y la gráfica siguen la preferencia
  corporal. El resto de las vistas de cargas parten de la preferencia de
  entrenamiento, también al consultar sesiones antiguas.
- Los ejercicios con carga ofrecen **kg / lb / Ambas** en Entrenar, ajustes de
  sesión, historial, planes guardados y detalle de progreso. Los ejercicios de
  peso corporal sin carga cuantificada no necesitan el selector.
- Ambas es opcional. La unidad del perfil aparece primero; por ejemplo,
  **20 kg · 44,09 lb** o **44,09 lb · 20 kg**.
- La gráfica del ejercicio conserva una sola unidad en sus etiquetas para no
  duplicar el eje. El resto del detalle permite consultar ambas unidades.
- El selector cambia la consulta, sin modificar la preferencia del perfil ni
  la unidad de entrada. El formulario de entrenamiento indica explícitamente
  en qué unidad deben registrarse las nuevas series.
- Cada plantilla tiene una página `/plans/templates/[id]` con ejercicios,
  objetivos e instrucciones. Abrirla no crea planes. La copia sigue siendo
  una acción explícita mediante «Usar este plan».

## Persistencia y conversión

`users.preferredBodySystem` (`metric` / `imperial`) es independiente de
`users.preferredWeightUnit` (`kg` / `lb`). La migración **0029** asigna `metric`
a los usuarios existentes y conserva su preferencia de entrenamiento.

Los pesos de entrenamiento mantienen su valor y la unidad de la sesión
(`workouts.weightUnit`). El peso corporal y el objetivo siguen almacenándose en
kg con dos decimales. No se convierte ni reescribe el historial al cambiar la
visualización o las preferencias.

La selección de consulta usa `sessionStorage`, con claves por cuenta, sesión y
aparición del ejercicio. Se conserva al recargar y sin conexión en esa pestaña;
un entrenamiento nuevo tiene otra clave y vuelve a la preferencia del perfil.
En el detalle del catálogo y los planes guardados se recuerda durante la sesión
de la pestaña. No se sincroniza entre dispositivos. Si el navegador impide
escribir, se permite cambiar la vista y se avisa de que no sobrevivirá a recargar.

Entrenar toma la preferencia del catálogo offline de la cuenta. Sin red se usa
la última preferencia descargada; a falta de catálogo se utiliza la unidad
original de la sesión. No cambia el formato de IndexedDB ni el de la cola.

- Equivalencia: **1 lb = 0,45359237 kg**.
- `src/lib/weight-units.ts` centraliza conversión y presentación.
- Se normaliza cada serie a kg **antes** de sumar volúmenes, calcular reparto
  muscular, comparar récords o calcular progresión.
- Las sugerencias mantienen los incrementos existentes de 1,25 / 2,5 kg y se
  convierten a la unidad consultada. No se añade una política de discos en lb.
- La conversión no redondea valores intermedios. La presentación usa formato
  español y hasta dos decimales, sin ceros finales innecesarios.
- Registrar una pesada corporal nueva convierte a kg y aplica la precisión de
  almacenamiento existente. Sus límites se validan a esa precisión, de modo que
  una meta de 20 kg pueda guardarse también como su equivalente visible de 44,09 lb.
- Notas y prescripciones escritas como texto libre no se reinterpretan ni se
  convierten automáticamente.

## Archivos principales

- Modelo y migración: `src/db/schema.ts`, `drizzle/0029_useful_sunset_bain.sql`.
- Preferencias: `src/app/ajustes/page.tsx`, `src/app/actions/settings.ts`,
  `src/db/preferences.ts`.
- Peso corporal: `src/app/actions/body-weight.ts`, componentes
  `body-weight-card.tsx` y `body-weight-form.tsx`.
- Consulta reutilizable: `src/components/weight-view.tsx` y
  `src/lib/training-metrics.ts`; integrada en las páginas de entrenamiento,
  progreso, historial y planes guardados.
- Plantillas: `src/components/plan-templates.tsx` y
  `src/app/plans/templates/[id]/page.tsx`.

## Validación

- `node --test tests/weight-units.test.mjs`: conversión, presentación simultánea,
  consulta repetida, progresión y agregación sobre PostgreSQL temporal.
- `node --test tests/units.ui.test.mjs`: app compilada y Chrome con PostgreSQL
  temporal. Cubre combinaciones independientes, detalle sin crear planes,
  progreso e historial, referencias de sesión, objetivo y registro corporal en
  lb, tamaños móviles/escritorio, alternancia repetida y recarga sin conexión.
  Compara todas las series antes y después para comprobar que no cambian.
- `node --test tests/offline.browser.test.mjs`: regresión de IndexedDB y cola
  offline (34 comprobaciones aprobadas).
- `npm run build` y `npm run lint`.

Las pruebas PostgreSQL necesitan `initdb` y `pg_ctl` en PATH, o `PG_TEST_BIN`.
Las pruebas de navegador admiten `PLAYWRIGHT_MODULE_PATH` y
`PLAYWRIGHT_EXECUTABLE_PATH` para usar herramientas ya instaladas. No necesitan
credenciales ni usan la base del proyecto.

## Publicación del 26 de octubre de 2026

La migración 0029 se aplicó y verificó en Neon después de crear y comprobar un
backup completo en `backups/deploy-units-20261026/`, fuera de Git. El historial
de producción coincide con las 30 migraciones del proyecto y no quedan
migraciones pendientes. Se verificaron el enum, el valor predeterminado y la
restricción NOT NULL de la nueva columna. Las huellas de las 12 tablas públicas,
excluyendo esa columna nueva, coinciden antes y después de migrar.

Para otras instalaciones, aplicar las migraciones antes de arrancar la nueva
versión, siguiendo el procedimiento de AGENTS.md.
