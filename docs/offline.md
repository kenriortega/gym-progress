# Entrenamiento offline: entrega 1

Esta entrega hace fiable la sesión existente. Empezar un entrenamiento todavía
requiere conexión. No descarga planes ni habilita varios entrenamientos locales.

## Decisiones

- `src/lib/offline/storage.ts` mantiene la base `gym-progress`, versión 2, con
  los almacenes `sesion` y `cola`. No borra ni reemplaza los datos existentes.
- Cada mutación escribe la sesión y la operación pendiente en una sola
  transacción. El guardado se confirma en `transaction.oncomplete`; un error
  de almacenamiento se comunica a la interfaz y no se presenta como éxito.
- Una secuencia local asignada dentro de la transacción mantiene el orden entre
  pestañas y aunque cambie el reloj. Las operaciones antiguas se procesan antes
  de las nuevas, ordenadas por su `createdAt` original.
- Al leer, se aplican las operaciones pendientes sobre la sesión. Esto permite
  recuperar colas anteriores cuyo snapshot no incluía todavía esas series.
- Una finalización local conserva el snapshot y bloquea nuevas modificaciones
  de esa sesión hasta recibir confirmación. La pantalla indica que está pendiente.
- La cola solo elimina una operación tras una respuesta HTTP exitosa, sin
  redirección, cuyo JSON confirme `ok: true`. Los rechazos, incluido un `401`,
  conservan la operación y detienen el envío para respetar las dependencias.
- Web Locks permite un único emisor por origen, entre pestañas. Si no está
  disponible, se conserva la cola y se pide actualizar el navegador. No se usa
  un bloqueo exclusivamente en memoria que dejaría competir a otras pestañas.
- Se reintenta al abrir `/entreno`, recuperar conexión, registrar cambios o
  pulsar el botón de reintento. Cada petición tiene un límite de 15 segundos.
- BroadcastChannel avisa a otras pestañas de los cambios confirmados localmente.
  La propia pestaña recibe un evento local. Los avisos no sustituyen las
  transacciones ni el bloqueo de sincronización.
- Antes de descargar un snapshot se captura una revisión local. Solo se acepta
  la respuesta si la revisión sigue igual y no hay operaciones pendientes.
  Así una petición antigua tampoco pisa cambios que ya se sincronizaron.
- `/api/snapshot` usa `Cache-Control: private, no-store` y `NetworkOnly` en
  Serwist. La copia offline se gestiona en IndexedDB, no en la caché HTTP.
- `/api/sync` responde con conflicto al finalizar una sesión inexistente o
  abandonada, y al borrar series de una sesión que ya no está activa. Finalizar
  una sesión propia ya completada continúa siendo idempotente.

## Validación automatizada

`tests/offline.browser.test.mjs` sirve los módulos TypeScript transpilados en un
origen local aislado y usa IndexedDB y Web Locks reales del navegador. Los
endpoints usan datos ficticios: no lee credenciales ni accede a PostgreSQL.

Ejecutar con Playwright disponible, sin necesidad de cambiar dependencias de
producción:

```sh
node --test tests/offline.browser.test.mjs
```

Si Playwright pertenece a un runtime externo o el navegador está instalado en
otra ruta, indicar `PLAYWRIGHT_MODULE_PATH` (módulo absoluto) y
`PLAYWRIGHT_EXECUTABLE_PATH` (ejecutable del navegador).

Cubre cierre/reapertura de pestaña, pérdida de conexión, rollback de una
transacción, almacenamiento bloqueado, errores HTTP, confirmación explícita,
finalización pendiente, respuesta antigua, concurrencia entre pestañas,
compatibilidad con colas anteriores y reenvío con el mismo identificador.

Estas pruebas no sustituyen una prueba de la PWA completa en un móvil ni una
prueba integrada de `/api/sync` contra una base de datos de pruebas.

## Pendiente para las siguientes entregas

Descarga de planes y calendario, separación de datos por usuario, creación de
sesiones locales, fechas originales, varias sesiones pendientes y un recorrido
unificado de entrenamiento. La ruta heredada `/workout/[id]` sigue usando server
actions con red; su formulario offline comparte esta cola y comunica los errores
de almacenamiento. La edición de planes, objetivos y estadísticas sigue online.

Los conflictos y operaciones inválidas se conservan y se muestran; todavía no
hay una interfaz de resolución. Background Sync y la apertura completa desde el
icono de la PWA se tratarán en la entrega correspondiente. El usuario sigue
pudiendo borrar los datos desde los ajustes del navegador; IndexedDB no equivale
a una copia de seguridad remota.

# Descarga de planes: entrega 2

## Qué puede hacerse

Al abrir una pantalla de la app con conexión, se descargan todos los planes
activos del usuario, aunque nunca se haya visitado su detalle. También se
actualizan al navegar, recuperar conexión, volver a la app o pulsar
«Actualizar planes». No se depende de una tarea programada por la mañana.

Inicio y Planes muestran cuántos planes se han guardado y la fecha de la copia.
La disponibilidad sin conexión se confirma después de comprobar que también
está guardada la página de consulta. `/planes-guardados` muestra todos los
planes, ejercicios, objetivos, notas y últimas series conocidas. El calendario
se resuelve en el móvil con `plansOn` y su fecha local, usando el calendario
semanal y todas las excepciones descargadas. Permite consultar otra fecha.

La referencia del entrenamiento anterior incluye su unidad original (kg/lb),
fecha, peso, repeticiones y RPE. Una actualización reemplaza el paquete de
planes activos completo: los archivados desaparecen de esta copia. Un fallo
de red, descarga incompleta o error del servidor conserva la copia anterior.
Un paquete vacío válido representa una cuenta sin planes activos.

## Almacenamiento e identidad

`database.ts` eleva IndexedDB a versión 3 y añade `planes` y `offline-meta`, sin
borrar ni modificar `cola` o `sesion`. Esta versión sustituye el acceso a la
base descrito en la entrega 1. Las transacciones siguen confirmándose en
`oncomplete` y las conexiones se cierran si cambia la versión. Si otra pestaña
bloquea la actualización, se muestra que debe cerrarse.

Cada paquete de planes se guarda bajo su `userId`. La identidad activa es una
referencia local a la última cuenta reconocida; no es una credencial. El header
autenticado la identifica y el endpoint verifica la sesión en cada descarga.
Al cerrar sesión o recibir un 401 vigente se oculta la copia activa, sin borrar
los paquetes de las cuentas ni sus entrenamientos pendientes. Iniciar sesión
con otra cuenta selecciona otra clave y no muestra los planes anteriores.

Cada petición obtiene un número y una generación en una transacción. Una
respuesta solo puede guardarse si sigue siendo la petición vigente. Cambiar o
cerrar cuenta invalida las peticiones anteriores; un cierre de sesión también
las invalida si todavía no se había identificado al usuario. Los avisos entre
pestañas actualizan los lectores sin provocar otra descarga recursiva.

Esta separación se aplica a los nuevos paquetes de planes. La sesión activa y
la cola heredadas conservan su formato para no perder trabajo; su migración por
usuario forma parte del recorrido unificado de la entrega 3.

## Endpoint y apertura offline

`GET /api/offline/plans` exige autenticación y solo consulta planes activos,
programación y entrenamientos previos de ese usuario. Usa una transacción de
solo lectura con aislamiento `repeatable read`, para no mezclar ejercicios de
un plan de antes y después de una edición. Agrupa las consultas de ejercicios
y marcas anteriores, sin ejecutar una consulta por ejercicio.

El endpoint devuelve `Cache-Control: private, no-store`; Serwist excluye
`/api/offline/*` de la caché HTTP. El layout raíz conserva su render estático:
la descarga es cliente y la identidad se conecta desde los headers ya
autenticados, sin añadir `auth()` al layout raíz.

La revisión del build detectó que la configuración anterior precacheaba los
scripts pero no el HTML de las pantallas offline. Se añaden entradas explícitas
para `/planes-guardados`, `/entreno` y `/offline`, con revisión por compilación.
Así la consulta abre sin una visita anterior a su pantalla. La pantalla fallback
y el menú incluyen un acceso a los planes guardados. La apertura completa del
Inicio y el flujo para empezar sin conexión siguen pendientes.

## Validación de esta entrega

- `tests/offline.browser.test.mjs`: añade descarga completa, persistencia sin
  red, reemplazo de planes archivados, conservación ante errores, aislamiento
  de cuentas, respuestas antiguas, cierre de sesión, migración desde v2 y
  calendario de varias fechas. Mantiene los escenarios de la entrega 1.
- `tests/offline-plans.ui.test.mjs`: requiere `npm run build` previo. Arranca la
  app compilada detrás de un proxy local que responde las APIs con datos
  ficticios. Comprueba descarga automática desde `/entreno`, primera visita a
  `/planes-guardados` sin conexión mediante el service worker real, consulta de
  notas y marcas, actualización, 401, cuenta vacía y anchuras móvil/escritorio.
  Las APIs de prueba no llegan al backend ni a la base de datos real.

```sh
node --test tests/offline.browser.test.mjs
node --test tests/offline-plans.ui.test.mjs
```

Ambos admiten `PLAYWRIGHT_MODULE_PATH` y `PLAYWRIGHT_EXECUTABLE_PATH`. La prueba
visual guarda capturas ficticias en `/tmp/gym-offline-plans-mobile.png` y
`/tmp/gym-offline-plans-desktop.png`. Queda pendiente validar el endpoint contra
una base de pruebas y el recorrido en un móvil físico.

Empezar sesiones offline, varias sesiones pendientes y resolver conflictos
siguen fuera de esta entrega. Las copias reflejan la última descarga correcta;
los cambios que otro dispositivo haga después requieren una actualización.

# Sesiones locales completas: entrega 3

## Recorrido

Inicio, el detalle del plan y Planes guardados usan `StartWorkoutButton`. El
inicio consulta la copia local y crea los UUID de la sesión y sus ejercicios.
La sesión y `startWorkout` se guardan en una sola transacción antes de abrir
`/entreno`. Si falta el plan y hay conexión, se intenta descargar el paquete.
Si existe una sesión activa local del mismo plan, se continúa esa sesión; otra
rutina requiere finalizar la abierta. Dos pestañas no crean dos sesiones.

La sesión copia los ejercicios, su orden, objetivos y notas. Cambiar la rutina
posteriormente no cambia esos datos de la sesión. Las referencias anteriores
conservan su unidad; los valores sugeridos y la calculadora se convierten a la
unidad de la sesión cuando corresponde. Al empezar otra sesión sin red se usa
la marca local completada más reciente, si es posterior a la descargada. El nombre mostrado por el servidor
sigue siendo el del plan relacionado; no se modifica el esquema PostgreSQL.

Registrar y borrar series siguen actualizando sesión y operación juntas.
Finalizar marca la sesión localmente y permite empezar otra, incluso si la
primera todavía no se ha enviado. `/entreno` muestra las sesiones completadas
pendientes. Cada confirmación elimina únicamente la operación y, al finalizar,
la copia de la sesión correspondiente: no afecta a otra sesión más reciente.

`/workout/[id]` conserva los ajustes que necesitan red y la resolución de una
sesión remota abierta. Su formulario de series dirige al recorrido común en
`/entreno`. Los inicios de planes desde server actions antiguas dirigen a los
planes guardados. Inicio ya no descarta una sesión automáticamente al empezar
otra: ofrece revisar la sesión pendiente.

## Separación por cuenta y recuperación

IndexedDB pasa a versión 4. Añade `entrenamientos` y `mutaciones`, con claves
compuestas `[userId, workoutId]` y `[userId, id]` e índice por usuario. La revisión
y secuencia se mantienen por cuenta. Todas las lecturas y escrituras incluyen
la identidad activa en su transacción. Cerrar sesión oculta también sesiones
y cola; volver a entrar con la misma cuenta permite recuperarlas.

Los almacenes antiguos `cola` y `sesion` se conservan. No se asignan a la cuenta
que casualmente esté abierta: `/api/offline/workout-ownership` verifica en el
servidor qué sesiones pertenecen al usuario autenticado. La importación de
snapshot y operaciones y la retirada de las filas antiguas son atómicas. Las
filas no verificadas permanecen intactas y se muestra un aviso. La recuperación
inicial de datos sin propietario necesita conexión; las sesiones nuevas ya
nacen con propietario y no necesitan esta verificación.

El emisor se detiene si cambia la identidad durante un envío. Una respuesta
que ya estuviera en vuelo confirma únicamente la fila de su propietario. El
backend exige además que `mutation.userId` coincida con la sesión autenticada;
una cookie que haya cambiado de cuenta no autoriza la cola anterior.

## Protocolo y conflictos

La cola envía `startWorkout`, `addSet`, `deleteSet` y `finishWorkout` en orden.
El backend reutiliza los UUID del cliente, valida plan y ejercicios accesibles,
y copia objetivos y notas del inicio recibido, sin reconstruirlo desde una
rutina que podría haber cambiado después de entrenar. Un plan propio archivado
sigue siendo una referencia válida para una sesión realizada offline.

- `performedAt` conserva el inicio original.
- `workoutSets.completedAt` conserva la fecha de la serie.
- `workouts.completedAt` conserva la finalización original.
- `updatedAt` sigue indicando la actualización en el servidor.

Los reenvíos de inicios y finalizaciones ya aceptados no duplican filas ni
alteran fechas. Una serie existente con el mismo ID y contenido se confirma
aunque la sesión se haya completado; un ID con otro contenido es conflicto.
Un borrado ya aplicado también puede confirmarse después de finalizar.

Los inicios bloquean la fila del usuario y respetan el índice de una sesión
activa por usuario. Las mutaciones de series bloquean la fila del entrenamiento.
Si otra sesión está activa en el servidor, se devuelve `ACTIVE_WORKOUT` con su
ID. La app conserva los entrenamientos locales y ofrece revisar la sesión
remota para finalizarla o descartarla con conexión y después reintentar. No
fusiona, reemplaza ni descarta sesiones por su cuenta.

La sincronización se reanuda también desde otras pantallas al recuperar red,
volver a primer plano, navegar o actualizar la identidad/planes. Cada petición
mantiene su timeout y el emisor conserva el bloqueo Web Locks entre pestañas.
No se promete sincronización con la aplicación cerrada.

El registro del service worker se concentra en un `useEffect` del provider
React. Se desactivan el registro, los parches de `history` y las recargas
`reloadOnOnline` del entry automático de Serwist. La prueba real de navegación
mostró que ambos mecanismos activos devolvían la app a la pantalla anterior al
abrir Entrenar. El precache explícito y las estrategias del worker conservan
las páginas offline sin esos parches.

El header autenticado pide revalidar planes, pero no activa una cuenta por su
cuenta: un header servido desde caché podría corresponder a otra sesión. Solo
la respuesta autenticada del paquete confirma la identidad. Los resultados de
sincronización de la pantalla también se ignoran si la identidad cambia mientras
se esperaba la respuesta.

## Pruebas de esta entrega

Las pruebas de navegador añaden dos sesiones de fechas diferentes, reapertura,
inicio atómico abortado, copia estable del plan, doble inicio entre pestañas,
aislamiento de sesiones/cola, conflicto remoto y cambio de cuenta en vuelo.
La prueba de la PWA compilada añade registro, reapertura, finalización de dos
sesiones offline y envío posterior. Usa un backend ficticio local.

`tests/sync.postgres.test.mjs` prueba los handlers reales de sincronización,
snapshot y recuperación contra un clúster PostgreSQL temporal. Crea una base
vacía en `/private/tmp`, aplica las migraciones del proyecto, sustituye solo
los módulos de autenticación y conexión de las pruebas y destruye el clúster
al terminar. No carga `.env`, no usa `@/db` real y no conecta a producción.

```sh
node --test tests/sync.postgres.test.mjs
```

Requiere `initdb` y `pg_ctl` disponibles en PATH; `PG_TEST_BIN` permite indicar
su directorio. Comprueba IDs y fechas originales, reenvíos, concurrencia,
autorización por cuenta, planes/ejercicios ajenos, planes archivados, borrados
y validación de la copia inicial. No añade dependencias al proyecto.

Quedan para la entrega 4 la revisión de la apertura desde el icono/Inicio y
las mejoras opcionales de Background Sync. Edición de planes, ajustes de sesión
y estadísticas completas siguen necesitando red. La primera descarga del
plan también necesita conexión. La comprobación en móvil físico sigue pendiente.

# Apertura y sincronización en segundo plano: entrega 4

## Entrada de la PWA e Inicio sin red

El manifest conserva `id: "/"` y usa `/abrir` como `start_url`. `/abrir` es una
página estática precacheada, sin datos personales en su HTML. Lee la identidad
y sesiones locales: continúa una sesión activa en `/entreno`; si no hay una
activa, abre Inicio con red o los planes guardados sin red. Un error de
almacenamiento se muestra con opciones para reintentar o abrir Inicio.

Las instalaciones que todavía abran `/` también tienen salida offline. Las
navegaciones de documento que fallan por red, timeout de cuatro segundos o
respuesta 5xx muestran `/offline`, ahora un inicio que permite continuar la
sesión o elegir un plan. No requiere haber visitado esa pantalla antes.

Las entradas principales usan navegación de documento para que el worker pueda
servir el HTML local y su fallback. Una petición RSC de Next que se queda
pendiente no sirve para este recorrido. Los enlaces con aspecto de botón
conservan semántica de enlace. El menú también permite acceder a pantallas que
requieren red y recibir la salida offline si no están disponibles.

Las páginas privadas y los datos RSC usan `NetworkOnly`. Las APIs tampoco se
guardan en la caché HTTP. Durante la activación se retiran respuestas privadas
de cachés runtime antiguas; los planes, sesiones y colas de IndexedDB no se
tocan. El precache conserva las páginas estáticas, sus scripts, estilos e
iconos. Se comprueba que los cuatro documentos de entrada estén guardados
antes de anunciar disponibilidad completa sin conexión.

## Un solo motor y estado por cuenta

`sync-engine.ts` contiene el emisor compartido. `offline-queue.ts` conserva la
API de la página y registra mejoras opcionales después de guardar. El motor
no usa `window`; los avisos en la página y en el worker pasan por
`events.ts`/BroadcastChannel. Ambos comparten el bloqueo Web Locks
`gym-progress:sync` y las mismas confirmaciones de las operaciones.

`sync-state.ts` guarda por usuario el estado y la fecha del último envío
confirmado. `OfflineSyncStatus` lo muestra en Inicio, Entrenar, Planes guardados
y la salida offline: pendientes, envío en curso, confirmado, autenticación
requerida, conflicto o error. No presenta una cola vacía como un envío realizado
si no hay una confirmación previa. Una indicación «enviando» antigua caduca y
no deja la interfaz indefinidamente en ese estado.

Si `/api/offline/plans` confirma que la sesión caducó, se oculta la identidad y
se muestra una petición genérica de inicio de sesión. No se muestran los
contadores ni el contenido de la cuenta anterior. Un cierre de sesión explícito
quita ese aviso. Volver a entrar con la cuenta propietaria permite recuperar
sus cambios.

## Background Sync y alternativa con la app abierta

Después de guardar el inicio o una mutación se intenta registrar el tag
`gym-progress:outbox`, solo si hay un worker activo y `SyncManager` está
permitido. Un navegador sin soporte o que deniegue el registro no impide guardar
ni usar el emisor con la app abierta. Al activar el worker se registra también
si ya había cambios pendientes.

El evento `sync` ejecuta el motor dentro de `event.waitUntil`. Un fallo de red,
5xx o 429 conserva la cola y rechaza la promesa para permitir reintentos del
navegador. Un 401/403, conflicto o rechazo definitivo conserva los cambios y
el estado, pero no solicita un bucle de reintentos automáticos. El usuario
puede autenticarse, resolver la sesión remota o reintentar desde la app.

La alternativa en primer plano sigue funcionando al abrir, volver a primer
plano, recuperar conexión, cambiar de identidad/planes o registrar cambios.
Los fallos temporales tienen espera progresiva de 2, 5, 15 y 30 segundos; la
espera se cancela al salir de la pantalla y no mantiene un bucle si la app está
oculta. Los avisos del propio emisor no provocan descargas recursivas entre
pestañas cuando la cola ya está vacía.

El soporte y el momento de ejecución de Background Sync dependen del navegador.
No se garantiza un envío con la app cerrada, ni con el navegador terminado por
el sistema. El estado local y los reintentos al abrirla siguen siendo la base.
Referencias: [MDN Background Synchronization API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)
y [especificación](https://wicg.github.io/background-sync/spec/).

## Validación

Las pruebas de IndexedDB mantienen los casos anteriores y comprueban estados
persistidos, separación por cuenta, clasificación de fallos temporales y el
registro opcional/denegado de Background Sync. La prueba de la PWA usa el
manifest real para abrir en frío con y sin sesión activa, prueba Inicio y una
ruta privada sin red, inyecta una portada privada antigua para comprobar que
no se reutiliza y simula un Inicio que responde 503.

Para el worker se usa `ServiceWorker.dispatchSyncEvent` mediante Playwright/CDP
con todas las páginas de la app cerradas; queda solo una pestaña `about:blank`
de control sin código de la app. Esto dispara el evento real de forma
determinista, sin prometer el calendario del navegador en producción. También
se comprueban el 401 del worker, la recuperación desde la página y un contexto
sin `SyncManager`. Las APIs usan datos ficticios y no llegan a la base real.
La actualización del worker elimina las respuestas privadas antiguas sin
alterar los planes guardados en IndexedDB.

Las pruebas PostgreSQL de la entrega 3 siguen verificando los handlers reales
contra un clúster temporal. No se cambian el esquema del backend ni las
dependencias de producción. La instalación y el comportamiento en móvil físico
siguen necesitando una comprobación en el dispositivo; las pruebas automáticas
abren la URL declarada por el icono, sin instalar una app en el equipo.

## Cancelar una sesión desde Entrenar

La pantalla `/entreno` ofrece **Cancelar entreno**, con confirmación explícita y
la alternativa **Seguir entrenando**. Cancelar no finaliza la sesión: no añade un
entrenamiento completado al historial ni al progreso y no cambia sesiones anteriores.

La cancelación se guarda en una transacción de IndexedDB mediante
`discardWorkout` y `localDiscardedAt`, separado de `localCompletedAt`. Libera el
inicio de otra sesión inmediatamente, también sin red, y muestra su estado
pendiente hasta recibir confirmación del servidor. El inicio desde el icono y
la portada offline ya no consideran activa una sesión cancelada.

Los cambios pendientes de esa sesión se sustituyen por la cancelación en la
misma transacción. Se mantienen los de otras sesiones y cuentas. El emisor
ignora solicitudes sustituidas y sus respuestas tardías para que no bloqueen la
cancelación ni envíen series pendientes que ya se descartaron.

El servidor reutiliza `abandoned`. La cancelación es idempotente y se serializa
con los inicios mediante el bloqueo de usuario. Si la sesión aún no existe,
guarda su identificador como sesión abandonada, sin series, para que un inicio
retrasado no pueda reabrirla. Si ya existe, conserva sus datos y solo cambia su
estado. Una sesión completada o perteneciente a otra cuenta no puede cancelarse.
No se necesitan migraciones ni dependencias nuevas.

Las cancelaciones pendientes no se usan como referencia de la sesión anterior.
La copia local se retira únicamente al confirmarse la cancelación. Una caída de
red o un error conserva la operación para reintentar; si otro dispositivo ya
completó esa misma sesión, se muestra un conflicto y se conserva el registro
completado del servidor.

Validaciones: `tests/offline.browser.test.mjs` comprueba persistencia, sustitución
de la cola, respuestas en vuelo, reintentos e inicio posterior sin red;
`tests/sync.postgres.test.mjs` comprueba los handlers contra PostgreSQL temporal,
incluyendo concurrencia y protección de sesiones completadas y de otras cuentas.
`tests/units.ui.test.mjs` recorre el botón real, rechaza primero la confirmación,
cancela con series sin red, recarga, empieza otra sesión y la cancela vacía con
red; verifica que los tres entrenamientos completados de prueba y sus series
siguen intactos. No se utilizan credenciales ni datos de producción.

Resultado de esta entrega (26 de octubre de 2026): 60 comprobaciones de
almacenamiento/API y la prueba completa de interfaz aprobadas; build, lint y
revisión del diff sin errores. Se revisó visualmente la confirmación en móvil y
la pantalla de cancelación pendiente sin conexión.

Preparación de publicación (26 de octubre de 2026): backup completo verificado
en `backups/deploy-cancel-20261026/`, fuera de Git. Neon coincide con las 30
migraciones locales hasta 0029, sin pendientes; `npm run db:migrate:prod`
terminó correctamente como no-op. No se modificaron registros reales para
comprobar esta entrega.
