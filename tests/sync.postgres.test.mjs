import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));

// Crea su propio clúster y módulos de auth/db. No importa .env ni @/db reales.
await test("API de sincronización con PostgreSQL temporal real", { timeout: 90_000 }, async (t) => {
  const directory = await mkdtemp("/private/tmp/gym-sync-pg-");
  const modules = await mkdtemp(join(root, ".offline-sync-test-"));
  const data = join(directory, "data");
  const reserve = createServer();
  await new Promise((resolve) => reserve.listen(0, "127.0.0.1", resolve));
  const port = reserve.address().port;
  await new Promise((resolve) => reserve.close(resolve));
  let started = false;
  let pool;
  const binary = (name) => process.env.PG_TEST_BIN ? join(process.env.PG_TEST_BIN, name) : name;
  try {
    await exec(binary("initdb"), ["-D", data, "-U", "gym_test", "-A", "trust", "--locale=C", "--encoding=UTF8"]);
    await exec(binary("pg_ctl"), ["-D", data, "-l", join(directory, "postgres.log"), "-o", `-h 127.0.0.1 -p ${port} -k ${directory}`, "-w", "start"]);
    started = true;
    const url = `postgresql://gym_test@127.0.0.1:${port}/postgres`;
    await writeFile(join(modules, "auth.mjs"), 'let current; export const setUser = (id) => { current = id; }; export const auth = async () => current ? { user: { id: current } } : null;');
    await writeFile(join(modules, "db.mjs"), `import pg from "pg"; import { drizzle } from "drizzle-orm/node-postgres"; export const pool = new pg.Pool({connectionString:${JSON.stringify(url)}}); export const db = drizzle(pool);`);
    const compile = async (file, destination) => {
      const source = await readFile(join(root, file), "utf8");
      const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
        .replaceAll('"next/server"', '"next/server.js"').replaceAll('"@/auth"', '"./auth.mjs"').replaceAll('"@/db"', '"./db.mjs"').replaceAll('"@/db/schema"', '"./schema.mjs"').replaceAll('"@/lib/training-metrics"', '"./metrics.mjs"').replaceAll('"@/lib/training-blocks"', '"./blocks.mjs"')
        .replaceAll('"@/lib/plan-templates"', '"./templates.mjs"').replaceAll('"@/lib/schedule"', '"./schedule.mjs"').replaceAll('"@/lib/dates"', '"./dates.mjs"')
        .replaceAll('"next/cache"', '"./cache.mjs"').replaceAll('"next/navigation"', '"./navigation.mjs"');
      await writeFile(join(modules, destination), js);
      return import(pathToFileURL(join(modules, destination)).href);
    };
    await compile("src/lib/training-blocks.ts", "blocks.mjs");
    await compile("src/lib/training-metrics.ts", "metrics.mjs");
    await compile("src/db/schema.ts", "schema.mjs");
    ({ pool } = await import(pathToFileURL(join(modules, "db.mjs")).href));
    for (const file of (await readdir(join(root, "drizzle"))).filter((name) => name.endsWith(".sql")).sort()) {
      await pool.query(await readFile(join(root, "drizzle", file), "utf8"));
    }
    await writeFile(join(modules, "cache.mjs"), 'export const revalidatePath = () => {};');
    await writeFile(join(modules, "navigation.mjs"), 'export const redirect = (url) => { throw Object.assign(new Error("redirect"), { url }); };');
    await compile("src/lib/dates.ts", "dates.mjs"); await compile("src/lib/schedule.ts", "schedule.mjs"); await compile("src/lib/plan-templates.ts", "templates.mjs");
    const planActions = await compile("src/app/actions/plans.ts", "plans.mjs");
    const { GET: offlinePlans } = await compile("src/app/api/offline/plans/route.ts", "offline-plans.mjs");
    const { POST } = await compile("src/app/api/sync/route.ts", "sync.mjs");
    const { GET: snapshot } = await compile("src/app/api/snapshot/route.ts", "snapshot.mjs");
    const { POST: ownership } = await compile("src/app/api/offline/workout-ownership/route.ts", "ownership.mjs");
    const { setUser } = await import(pathToFileURL(join(modules, "auth.mjs")).href);
    const userA = randomUUID(), userB = randomUUID(), planA = randomUUID(), planB = randomUUID();
    const exerciseA = randomUUID(), exerciseB = randomUUID();
    await pool.query("insert into users(id,email) values ($1,'a@test.invalid'),($2,'b@test.invalid')", [userA, userB]);
    await pool.query("insert into training_plans(id,user_id,name) values ($1,$2,'Plan A'),($3,$4,'Plan B')", [planA, userA, planB, userB]);
    await pool.query("insert into exercises(id,user_id,name,muscle_group) values ($1,$2,'Ejercicio A','Piernas'),($3,$4,'Ejercicio B','Torso')", [exerciseA, userA, exerciseB, userB]);
    const make = (extra = {}) => ({
      id: randomUUID(), userId: userA, kind: "startWorkout", workoutId: randomUUID(), planId: planA,
      weightUnit: "kg", createdAt: Date.parse("2026-10-20T08:00:00Z"), performedAt: "2026-10-20T08:00:00.000Z",
      exercises: [{ workoutExerciseId: randomUUID(), exerciseId: exerciseA, position: 0, targetSets: 4, targetRepsMin: 6, targetRepsMax: 8, notes: "Copia del plan al empezar" }],
      ...extra,
    });
    const send = (operation) => POST(new Request("http://test.invalid/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(operation) }));
    const operation = (workout, kind, extra = {}) => ({ id: randomUUID(), userId: workout.userId, kind, workoutId: workout.workoutId, createdAt: Date.parse(workout.performedAt) + 60_000, ...extra });
    const series = (workout, extra = {}) => operation(workout, "addSet", { workoutExerciseId: workout.exercises[0].workoutExerciseId, setId: randomUUID(), weight: 55, reps: 8, rpe: 7.5, ...extra });
    const scenario = (name, fn) => t.test(name, async () => {
      setUser(userA);
      await pool.query("truncate workouts cascade");
      await fn();
    });

    await scenario("cancelar no completa ni duplica entrenamientos y admite reintentos", async () => {
      const previous = make();
      await send(previous); await send(series(previous)); await send(operation(previous, "finishWorkout"));
      const old = (await pool.query("select id,status,completed_at from workouts where id=$1", [previous.workoutId])).rows;
      const workout = make(); await send(workout); await send(series(workout, { weight: 20 }));
      const cancel = operation(workout, "discardWorkout");
      assert.equal((await send(cancel)).status, 200);
      assert.equal((await send(cancel)).status, 200);
      assert.deepEqual((await pool.query("select id,status,completed_at from workouts where id=$1", [previous.workoutId])).rows, old);
      const saved = (await pool.query("select status,completed_at from workouts where id=$1", [workout.workoutId])).rows[0];
      assert.equal(saved.status, "abandoned"); assert.equal(saved.completed_at, null);
      assert.equal((await (await snapshot()).json()).workout, null);
      assert.equal(Number((await pool.query("select count(*) from workouts where status='completed'")).rows[0].count), 1);
      assert.equal((await send(operation(workout, "finishWorkout"))).status, 409);
      assert.equal((await send(make())).status, 200);
    });
    await scenario("cancelar antes del inicio y en concurrencia impide reabrir la sesión", async () => {
      const workout = make(); const cancel = operation(workout, "discardWorkout");
      assert.equal((await send(cancel)).status, 200);
      assert.equal((await send(workout)).status, 200);
      assert.equal((await send(series(workout))).status, 409);
      assert.equal((await pool.query("select status from workouts where id=$1", [workout.workoutId])).rows[0].status, "abandoned");
      const concurrent = make();
      const results = await Promise.all([send(concurrent), send(operation(concurrent, "discardWorkout"))]);
      assert.deepEqual(results.map((response) => response.status), [200, 200]);
      assert.equal((await pool.query("select status from workouts where id=$1", [concurrent.workoutId])).rows[0].status, "abandoned");
    });
    await scenario("cancelar rechaza sesiones completadas o de otra cuenta", async () => {
      const workout = make(); await send(workout);
      setUser(userB);
      assert.equal((await send({ ...operation(workout, "discardWorkout"), userId: userB })).status, 409);
      setUser(userA);
      assert.equal((await pool.query("select status from workouts where id=$1", [workout.workoutId])).rows[0].status, "active");
      await send(operation(workout, "finishWorkout"));
      assert.equal((await send(operation(workout, "discardWorkout"))).status, 409);
      assert.equal((await pool.query("select status from workouts where id=$1", [workout.workoutId])).rows[0].status, "completed");
    });

    await scenario("dos entrenamientos y reenvíos conservan fechas, IDs, objetivos y RPE", async () => {
      for (let index = 0; index < 2; index++) {
        const workout = make({ performedAt: `2026-10-${20 + index}T08:00:00.000Z` });
        const add = series(workout);
        const finish = operation(workout, "finishWorkout", { createdAt: Date.parse(workout.performedAt) + 3_600_000 });
        for (const mutation of [workout, workout, add, add, finish, finish, workout, add]) assert.equal((await send(mutation)).status, 200);
        const { rows: [saved] } = await pool.query("select * from workouts where id=$1", [workout.workoutId]);
        assert.equal(saved.performed_at.toISOString(), workout.performedAt);
        assert.equal(saved.completed_at.getTime(), finish.createdAt);
        const { rows } = await pool.query("select * from workout_sets where id=$1", [add.setId]);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].completed_at.getTime(), add.createdAt);
        assert.equal(Number(rows[0].rpe), 7.5);
        const { rows: [exercise] } = await pool.query("select * from workout_exercises where id=$1", [workout.exercises[0].workoutExerciseId]);
        assert.equal(exercise.target_sets, 4);
        assert.equal(exercise.notes, "Copia del plan al empezar");
      }
      assert.equal(Number((await pool.query("select count(*) from workouts")).rows[0].count), 2);
    });

    await scenario("dos inicios concurrentes crean una sesión y devuelven el conflicto", async () => {
      const [one, two] = await Promise.all([send(make()), send(make())]);
      assert.deepEqual([one.status, two.status].sort(), [200, 409]);
      const conflict = await (one.status === 409 ? one : two).json();
      assert.equal(conflict.code, "ACTIVE_WORKOUT");
      assert.equal(conflict.workoutId, (await pool.query("select id from workouts where status='active'")).rows[0].id);
    });

    await scenario("una cookie de otra cuenta no puede recibir esta cola", async () => {
      setUser(userB);
      assert.equal((await send(make())).status, 403);
      assert.equal(Number((await pool.query("select count(*) from workouts")).rows[0].count), 0);
      setUser(null);
      assert.equal((await send(make())).status, 401);
    });

    await scenario("planes y ejercicios ajenos se rechazan antes de crear filas", async () => {
      assert.equal((await send(make({ planId: planB }))).status, 409);
      const workout = make();
      workout.exercises[0].exerciseId = exerciseB;
      assert.equal((await send(workout)).status, 409);
      assert.equal(Number((await pool.query("select count(*) from workouts")).rows[0].count), 0);
    });

    await scenario("una rutina archivada después de entrenar conserva su copia", async () => {
      await pool.query("update training_plans set archived_at=now() where id=$1", [planA]);
      assert.equal((await send(make())).status, 200);
      await pool.query("update training_plans set archived_at=null where id=$1", [planA]);
    });

    await scenario("el borrado se puede reenviar después de finalizar", async () => {
      const workout = make();
      const add = series(workout);
      const remove = operation(workout, "deleteSet", { setId: add.setId });
      for (const mutation of [workout, add, remove, operation(workout, "finishWorkout"), remove]) assert.equal((await send(mutation)).status, 200);
      assert.equal(Number((await pool.query("select count(*) from workout_sets")).rows[0].count), 0);
    });

    await scenario("una serie reutilizada con otro contenido no se confirma", async () => {
      const workout = make();
      const add = series(workout);
      await send(workout);
      await send(add);
      assert.equal((await send({ ...add, reps: 9 })).status, 409);
      assert.equal((await pool.query("select reps from workout_sets where id=$1", [add.setId])).rows[0].reps, 8);
    });

    await scenario("un cuerpo inválido no deja un entrenamiento parcial", async () => {
      const workout = make();
      workout.exercises[0].notes = "x".repeat(1001);
      assert.equal((await send(workout)).status, 400);
      assert.equal(Number((await pool.query("select count(*) from workouts")).rows[0].count), 0);
    });

    await scenario("un fallo SQL al crear ejercicios revierte también la sesión", async () => {
      await pool.query(`create function offline_test_fail() returns trigger language plpgsql as $$ begin raise exception 'fallo de prueba'; end $$;
        create trigger offline_test_fail before insert on workout_exercises for each row execute function offline_test_fail()`);
      const original = console.error;
      try {
        console.error = () => {};
        assert.equal((await send(make())).status, 500);
        assert.equal(Number((await pool.query("select count(*) from workouts")).rows[0].count), 0);
      } finally {
        console.error = original;
        await pool.query("drop trigger offline_test_fail on workout_exercises; drop function offline_test_fail()");
      }
    });

    await scenario("un UUID de ejercicio reutilizado no deja una sesión parcial", async () => {
      const first = make();
      await send(first);
      await send(operation(first, "finishWorkout"));
      const second = make({ exercises: first.exercises });
      assert.equal((await send(second)).status, 409);
      assert.equal(Number((await pool.query("select count(*) from workouts")).rows[0].count), 1);
    });

    await scenario("el snapshot conserva la unidad original de la marca anterior", async () => {
      const previous = make({ weightUnit: "lb" });
      await send(previous);
      await send(series(previous, { weight: 110 }));
      await send(operation(previous, "finishWorkout"));
      await send(make());
      const data = await (await snapshot()).json();
      assert.equal(data.workout.weightUnit, "kg");
      assert.equal(data.workout.exercises[0].previousWeightUnit, "lb");
      assert.equal(data.workout.exercises[0].previous[0].weight, 110);
    });

    await scenario("snapshot y recuperación antigua solo entregan la cuenta autenticada", async () => {
      const a = make();
      const b = make({ userId: userB, planId: planB, exercises: [{ ...a.exercises[0], workoutExerciseId: randomUUID(), exerciseId: exerciseB }] });
      await send(a);
      setUser(userB);
      await send(b);
      setUser(userA);
      const data = await (await snapshot()).json();
      assert.equal(data.userId, userA);
      assert.equal(data.workout.workoutId, a.workoutId);
      assert.equal(data.workout.trainingPlanId, planA);
      const verified = await ownership(new Request("http://test.invalid/api/offline/workout-ownership", { method: "POST", body: JSON.stringify({ workoutIds: [a.workoutId, b.workoutId] }) }));
      assert.deepEqual((await verified.json()).workoutIds, [a.workoutId]);
    });
    await scenario("calistenia: duración, lastre y asistencia se guardan y reenvían sin cambiar de variante", async () => {
      for (const [loadType, timed, weight, note] of [["bodyweight", false, 0, null], ["weighted", false, 10, null], ["assisted", false, 20, null], ["assisted", false, 0, "Banda verde"], ["bodyweight", true, 0, null]]) {
        const workout = make();
        Object.assign(workout.exercises[0], { measurement: timed ? "time" : "reps", loadType, targetSeconds: timed ? 30 : null, targetRepsMin: timed ? null : 6, targetRepsMax: timed ? null : 8 });
        assert.equal((await send(workout)).status, 200);
        const set = series(workout, { reps: timed ? 0 : 8, weight, loadType, durationSeconds: timed ? 35 : null, assistanceNote: note });
        assert.equal((await send(set)).status, 200);
        assert.equal((await send(set)).status, 200);
        assert.equal((await send({ ...set, durationSeconds: 40 })).status >= 400, true);
        const snapshotData = await (await snapshot()).json();
        const exercise = snapshotData.workout.exercises[0];
        assert.equal(exercise.loadType, loadType);
        assert.equal(exercise.sets[0].durationSeconds, timed ? 35 : null);
        assert.equal(exercise.sets[0].assistanceNote, note);
        assert.equal((await send(operation(workout, "finishWorkout"))).status, 200);
      }
    });
    await scenario("una serie incompatible o una asistencia vacía nunca se confirma", async () => {
      const workout = make();
      Object.assign(workout.exercises[0], { measurement: "reps", loadType: "bodyweight", targetSeconds: null });
      await send(workout);
      assert.equal((await send(series(workout))).status, 409);
      assert.equal((await send(series(workout, { weight: 10, loadType: "bodyweight" }))).status, 400);
      assert.equal((await send(series(workout, { weight: 0, loadType: "assisted" }))).status, 400);
      assert.equal(Number((await pool.query("select count(*) from workout_sets")).rows[0].count), 0);
    });
    await scenario("bloques: circuito, AMRAP, límite de tiempo y EMOM sobreviven a reenvíos y al snapshot", async () => {
      for (const format of ["circuit", "amrap", "for-time", "emom"]) {
        const workout = make();
        const block = { id: randomUUID(), name: "Bloque", format, exerciseIds: [exerciseA], rounds: ["circuit", "for-time"].includes(format) ? 3 : null,
          durationSeconds: ["amrap", "emom"].includes(format) ? 600 : null, timeCapSeconds: format === "for-time" ? 900 : null, intervalSeconds: format === "emom" ? 60 : null };
        workout.blocks = [block]; workout.discipline = "mixed";
        assert.equal((await send(workout)).status, 200);
        const id = randomUUID(), createdAt = Date.now();
        const progress = { mutationId: id, updatedAt: createdAt, startedAt: null, elapsedSeconds: 200,
          result: { rounds: format === "circuit" ? 3 : 2, reps: 5, intervals: format === "emom" ? 10 : 0, durationSeconds: format === "for-time" ? 900 : null, completed: ["circuit", "emom"].includes(format), adaptation: "scaled", adaptationNote: "Banda verde" } };
        const m = { id, createdAt, userId: userA, kind: "blockProgress", workoutId: workout.workoutId, blockId: block.id, progress };
        assert.equal((await send(m)).status, 200);
        assert.equal((await send(m)).status, 200);
        assert.equal((await send({ ...m, progress: { ...progress, elapsedSeconds: 201 } })).status, 409);
        const data = await (await snapshot()).json();
        assert.equal(data.workout.blocks[0].format, format);
        assert.equal(data.workout.blockProgress[block.id].result.adaptationNote, "Banda verde");
        assert.equal((await send(operation(workout, "finishWorkout"))).status, 200);
        assert.equal((await send(m)).status, 200);
      }
    });
    await scenario("bloques inválidos, resultados incoherentes y accesos ajenos no escriben datos", async () => {
      const workout = make();
      const block = { id: randomUUID(), name: "EMOM", format: "emom", exerciseIds: [exerciseA], rounds: null, durationSeconds: 610, timeCapSeconds: null, intervalSeconds: 60 };
      assert.equal((await send({ ...workout, blocks: [block] })).status, 400);
      block.durationSeconds = 600;
      assert.equal((await send({ ...workout, blocks: [block] })).status, 200);
      const id = randomUUID(), createdAt = Date.now();
      const progress = { mutationId: id, updatedAt: createdAt, startedAt: null, elapsedSeconds: 0, result: { rounds: 0, reps: 0, durationSeconds: null, intervals: 11, completed: true, adaptation: "rx", adaptationNote: null } };
      const m = { id, createdAt, userId: userA, workoutId: workout.workoutId, kind: "blockProgress", blockId: block.id, progress };
      assert.equal((await send(m)).status, 400);
      setUser(userB); assert.equal((await send(m)).status, 403);
      setUser(userA); const data = await (await snapshot()).json();
      assert.deepEqual(data.workout.blockProgress, {});
    });
    await scenario("la progresión congela el paso y no trae referencias de otra variante", async () => {
      const previous = make(); previous.exercises[0].loadType = "bodyweight"; previous.exercises[0].variation = "Negativa";
      await send(previous); await send(series(previous, { loadType: "bodyweight", weight: 0 })); await send(operation(previous, "finishWorkout"));
      const next = make(); Object.assign(next.exercises[0], { loadType: "bodyweight", variation: "Estricta", progressionSteps: ["Negativa", "Estricta"], progressionStep: 2 });
      assert.equal((await send(next)).status, 200);
      const data = await (await snapshot()).json();
      assert.equal(data.workout.exercises[0].variation, "Estricta");
      assert.equal(data.workout.exercises[0].progressionStep, 2);
      assert.deepEqual(data.workout.exercises[0].previous, []);
    });
    await scenario("acciones reales: objetivos por tiempo, bloques, duplicación y descarga completa", async () => {
      const id = randomUUID();
      await pool.query("insert into training_plans(id,user_id,name) values ($1,$2,'Plan de bloques')", [id, userA]);
      const form = (values) => { const f = new FormData(); for (const [k, v] of Object.entries(values)) for (const item of Array.isArray(v) ? v : [v]) f.append(k, String(item)); return f; };
      await planActions.addPlanExercise(form({ planId: id, exerciseId: exerciseA, targetSets: 3, measurement: "time", loadType: "bodyweight", targetSeconds: 30, progressionSteps: "Con apoyo\nEstricta", progressionStep: 2 }));
      const created = (await pool.query("select * from training_plan_exercises where plan_id=$1", [id])).rows[0];
      assert.equal(created.target_reps_min, null); assert.equal(created.variation, "Estricta");
      await planActions.savePlanBlock(form({ planId: id, name: "Circuito", format: "circuit", rounds: 3, exerciseIds: [exerciseA] }));
      await assert.rejects(planActions.savePlanBlock(form({ planId: id, name: "Duplicado", format: "circuit", rounds: 3, exerciseIds: [exerciseA] })));
      const pkg = await (await offlinePlans()).json();
      const plan = pkg.plans.find((item) => item.id === id);
      assert.equal(plan.blocks.length, 1); assert.equal(plan.exercises[0].targetSeconds, 30); assert.equal(plan.exercises[0].progressionStep, 2);
      try { await planActions.duplicatePlan(form({ planId: id })); } catch (error) { assert.ok(error.url?.startsWith("/plans/")); }
      const copy = (await pool.query("select id,blocks from training_plans where name='Plan de bloques copia' and user_id=$1", [userA])).rows[0];
      assert.ok(copy); assert.equal(copy.blocks.length, 1); assert.notEqual(copy.blocks[0].id, plan.blocks[0].id);
      await planActions.removePlanExercise(form({ planId: id, planExerciseId: created.id }));
      assert.deepEqual((await pool.query("select blocks from training_plans where id=$1", [id])).rows[0].blocks, []);
      setUser(userB); await assert.rejects(planActions.savePlanBlock(form({ planId: copy.id, name: "Ajeno", format: "circuit", rounds: 2, exerciseIds: [exerciseA] })));
    });
    await scenario("plantillas nuevas crean movimientos privados completos y conservan los formatos", async () => {
      for (const templateId of ["calistenia", "amrap-editable"]) {
        const form = new FormData(); form.set("templateId", templateId);
        try { await planActions.createPlanFromTemplate(form); } catch (error) { if (!error.url?.startsWith("/plans/")) throw error; }
      }
      const pkg = await (await offlinePlans()).json();
      const calis = pkg.plans.find((item) => item.name === "Calistenia editable");
      const wod = pkg.plans.find((item) => item.name === "AMRAP editable");
      assert.equal(calis.exercises.length, 3); assert.equal(calis.exercises[2].measurement, "time");
      assert.equal(wod.exercises.length, 3); assert.equal(wod.blocks[0].format, "amrap");
    });
  } finally {
    await pool?.end();
    if (started) await exec(binary("pg_ctl"), ["-D", data, "-m", "immediate", "-w", "stop"]);
    await rm(modules, { recursive: true, force: true });
    await rm(directory, { recursive: true, force: true });
  }
});
