# Modalidades, mediciones y bloques

La ampliación se entrega en cuatro partes que comparten el mismo calendario,
sesión, historial e infraestructura offline. No añade servicios ni dependencias.

## 1. Calistenia y mediciones

Cada entrada del plan separa `measurement` (`reps` o `time`) de `loadType`
(`external`, `bodyweight`, `weighted`, `assisted`). Se elige al añadir o editar
el ejercicio. Un movimiento del catálogo puede usarse con distintas variantes
en planes diferentes; la modalidad del plan es una etiqueta, no limita sus campos.

- Repeticiones y carga externa conservan el comportamiento previo.
- Peso corporal no pide kilos. Internamente conserva `weight = 0`, sin inferir
  que todo el peso corporal se desplaza ni calcular un tonelaje ficticio.
- Lastre registra el peso añadido, no el peso corporal total.
- Asistencia registra kilos de máquina/polea, o una descripción de la banda
  cuando no existe un peso conocido. No se atribuyen kilos al color de una banda.
- Tiempo guarda `durationSeconds` y cero repeticiones; nunca convierte segundos
  en repeticiones. El objetivo por tiempo tiene sus repeticiones a null.

Las series y las operaciones se escriben atómicamente en IndexedDB. Los tipos
antiguos sin campos nuevos se interpretan como repeticiones con carga externa.
No se reclasifica automáticamente el historial anterior.

La sesión copia configuración, objetivos, notas y referencias al comenzar.
La referencia anterior debe coincidir en medición, tipo de carga y variante.
Las bandas, cargas y variantes tienen comparaciones separadas en Progreso.
El volumen de fuerza se calcula solo con carga externa y repeticiones. La
constancia cuenta también sesiones de peso corporal o WOD sin series de fuerza.

## 2. Bloques y circuitos

`training_plans.blocks` es una lista JSON tipada y validada de bloques pequeños:
identificador, nombre, formato, receta y ejercicios ordenados. Se eligió una
lista embebida porque pertenece al plan y se descarga como una unidad; no se
consulta como catálogo independiente. El máximo es 50 bloques por plan.

`workouts.blocks` congela esa definición al empezar. Cambiar o quitar un bloque
del plan no cambia sesiones anteriores. Duplicar un plan copia la configuración
con identificadores nuevos de bloque. Quitar un ejercicio retira también su
referencia y los bloques que queden vacíos, dentro de la misma transacción.

Al iniciar desde el editor con conexión se actualiza el paquete antes de crear
la sesión, para incluir las últimas ediciones. Desde Planes guardados el inicio
sigue siendo local.

Los planes existentes tienen una lista vacía y siguen mostrando sus series.
Los ejercicios sin bloque conservan ese recorrido. Un bloque de series agrupa
las mismas tarjetas. Un circuito muestra una receta por ronda, contador para
completar/deshacer rondas y resultado editable; no exige registrar cada repetición.
El objetivo del movimiento se realiza una vez por ronda (el número de series
individual del plan no multiplica las rondas).

La primera versión mantiene la restricción existente de un movimiento del
catálogo por plan y lo asigna como máximo a un bloque. Para dos variantes en el
mismo plan se pueden crear entradas distintas en el catálogo. No hay bloques
anidados ni esquemas de repeticiones diferentes para cada ronda.

## 3. AMRAP y por tiempo

AMRAP guarda duración, rondas y repeticiones adicionales. Por tiempo guarda
rondas previstas y tiempo final, con límite opcional. Cuando se alcanza el
límite sin terminar, conserva el trabajo alcanzado y el tiempo límite en vez
de presentarlo como finalizado. También admite un registro incompleto sin límite.

Cada resultado distingue ejecución según el plan (Rx) de una adaptación
(Scaled). La adaptación requiere describir los cambios; la receta del bloque
permite especificar cargas, variantes y material. Se conserva lo prescrito y
lo realmente declarado. No se estima automáticamente el resultado a partir del
cronómetro: el usuario confirma el trabajo realizado.

Progreso compara receta, objetivos, unidad y adaptación iguales. Un tiempo más
bajo solo es mejor cuando se terminó el mismo trabajo. Los resultados parciales
se comparan por rondas y repeticiones; AMRAP por trabajo, EMOM por intervalos.
La consulta está limitada a las últimas 100 sesiones e informa ese límite.
No hay clasificaciones públicas ni comparación automática entre Rx y Scaled.

Se incluyen plantillas editables de calistenia y AMRAP. Los movimientos que
falten en las plantillas nuevas se crean en el catálogo privado del usuario,
para no construir un WOD incompleto por omisión silenciosa.

## 4. EMOM y progresiones por variante

EMOM define duración total e intervalo; la duración debe ser múltiplo del
intervalo. Los movimientos se alternan en el orden indicado, uno por intervalo.
Muestra intervalo actual, movimiento y cuenta atrás; el resultado es el número
de intervalos completados. El intervalo es configurable para variantes como
cada dos minutos. No se asume que transcurrir un minuto equivale a completarlo.

Cada ejercicio puede tener una variante explícita o hasta 12 pasos de una
progresión personal, con un paso actual. Al definir pasos, ese paso determina
la variante. Se muestra el siguiente paso del plan, pero avanzar es una edición
consciente del usuario. No hay recomendaciones automáticas de habilidades o
incrementos; el motor previo de progresión de carga se limita a fuerza externa
sin variante y no usa referencias de calistenia.

## Persistencia y sincronización

La cola añade `blockProgress`: guarda resultado y checkpoint del reloj en una
transacción con la sesión. El checkpoint incluye hora de inicio y segundos
acumulados antes de la pausa. El reloj se reconstruye al reabrir o volver del
segundo plano; no depende de que sigan ejecutándose los intervalos JavaScript.
Solo iniciar, pausar, reiniciar, cambiar rondas o guardar resultado generan una
operación, nunca los ticks de pantalla.

El servidor bloquea la fila de sesión antes de aceptar un checkpoint, valida
su bloque contra la copia congelada y comprueba propietario y estado. Reenvíos
idénticos no cambian el resultado, IDs reutilizados con otro contenido son
conflicto y checkpoints más antiguos no pisan uno posterior. El orden de claves
JSON no afecta a la idempotencia. Los checkpoints usan fecha y UUID como desempate;
no existe edición colaborativa en tiempo real ni fusión de resultados simultáneos.

El paquete offline sube a versión 3. El cliente actual acepta también copias 1
y 2; clientes anteriores rechazan el paquete desconocido y conservan su última
copia. Una operación antigua no puede alterar una sesión cuya medición o carga
ya no coincide. No se cambia la versión de IndexedDB: las propiedades añadidas
son compatibles con los mismos almacenes. Background Sync y los reintentos en
primer plano ejecutan el mismo emisor.

## Migraciones y validación

Las migraciones 0025–0028 añaden mediciones, bloques, progresiones y disciplinas.
Sus defaults conservan la semántica anterior. Se generaron con Drizzle y se
prueban desde el esquema inicial y todas las migraciones en PostgreSQL temporal.
Aplicadas también a la base local `gym_progress` el 25 de octubre de 2026:
historial de 29 migraciones completo, 20 columnas y cuatro restricciones
verificadas, sin cambios en los recuentos de datos.

Aplicadas a Neon de producción el mismo día, con backup previo validado
(`backups/gym-progress-before-0025-2026-10-25T13-19-45-438Z.sql.gz`, excluido de
Git). Se verificaron las 29 migraciones, las 20 columnas, las cuatro restricciones
y los defaults históricos. Los recuentos se mantuvieron: 9 usuarios, 13 planes,
56 entradas de plan, 16 sesiones, 96 ejercicios de sesión y 176 series.
Antes de arrancar esta versión contra otra base destino deben aplicarse las
cuatro mediante el procedimiento habitual, previa autorización para ese entorno.

Validaciones automatizadas:

- `tests/offline.browser.test.mjs`: transacciones IndexedDB, separación de cuentas,
  migración antigua, varias sesiones, nuevas mediciones y checkpoints de bloques.
- `tests/sync.postgres.test.mjs`: handlers y acciones reales con autenticación
  sustituida, PostgreSQL temporal, idempotencia, propietarios, receta congelada,
  variantes, duplicación, edición, plantillas y descarga del paquete.
- `tests/offline-plans.ui.test.mjs`: PWA compilada, apertura fría, Background Sync,
  navegadores sin SyncManager y calistenia sin red tras cerrar/reabrir.
- `tests/training.ui.test.mjs`: Next, sesión de autenticación y PostgreSQL
  desechable reales; editor, circuito, AMRAP, por tiempo y EMOM; cierre offline,
  sincronización y consulta del historial y progreso. No utiliza datos reales.

Las pruebas de interfaz admiten `PLAYWRIGHT_MODULE_PATH` y
`PLAYWRIGHT_EXECUTABLE_PATH`; las de PostgreSQL admiten `PG_TEST_BIN`. Se ejecutan
contra una compilación de producción (`npm run build`). No conviene ejecutarlas
mientras otra compilación modifica `.next`.

Queda la comprobación en un móvil físico. No se prometen alarmas con pantalla
bloqueada, ejecución del reloj mientras el sistema termina la app ni un horario
garantizado para Background Sync. El checkpoint sí permite reconstruir el tiempo
al volver. Distancia y calorías de ergómetro no forman parte de esta entrega;
los objetivos de los movimientos son repeticiones o segundos.
