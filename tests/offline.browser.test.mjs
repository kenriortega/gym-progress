import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import { plansFixture } from "./fixtures/offline-plans.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const ts = require("typescript");
const root = new URL("../", import.meta.url);
const modules = {
  "/training-blocks": "src/lib/training-blocks.ts",
  "/training-metrics": "src/lib/training-metrics.ts",
  "/offline-queue": "src/lib/offline-queue.ts",
  "/offline/storage": "src/lib/offline/storage.ts",
  "/offline/database": "src/lib/offline/database.ts",
  "/offline/events": "src/lib/offline/events.ts",
  "/offline/sync-state": "src/lib/offline/sync-state.ts",
  "/offline/sync-engine": "src/lib/offline/sync-engine.ts",
  "/offline/background-sync": "src/lib/offline/background-sync.ts",
  "/offline/plans": "src/lib/offline/plans.ts",
  "/offline/plan-types": "src/lib/offline/plan-types.ts",
  "/offline/plan-storage": "src/lib/offline/plan-storage.ts",
  "/schedule": "src/lib/schedule.ts",
  "/dates": "src/lib/dates.ts",
};
const snapshot = {
  userId: "user-a", trainingPlanId: null, workoutId: "workout", planName: "Plan", weightUnit: "kg",
  performedAt: "2026-10-24T12:00:00.000Z", fetchedAt: 1,
  exercises: [{ workoutExerciseId: "exercise", exerciseId: "catalog", name: "Sentadilla",
    muscleGroup: "Piernas", position: 0, targetSets: 3, targetRepsMin: 8,
    targetRepsMax: 12, completed: false, sets: [], previous: [] }],
};
const mutation = (id, extra = {}) => ({ id, userId: "user-a", kind: "addSet", workoutId: "workout",
  workoutExerciseId: "exercise", setId: id, weight: 50, reps: 8, rpe: 7,
  createdAt: 100, ...extra });

// Servidor aislado: no carga Next, credenciales ni la base de datos de la aplicación.
const server = createServer(async (request, response) => {
  const file = modules[request.url];
  if (file) {
    response.setHeader("Content-Type", "text/javascript");
    response.end(ts.transpileModule(await readFile(new URL(file, root), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText.replaceAll('"@/lib/dates"', '"/dates"'));
  } else if (request.url === "/api/offline/plans") {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(plansFixture));
  } else if (request.url === "/api/offline/workout-ownership") {
    let body = "";
    for await (const chunk of request) body += chunk;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ userId: "user-a", workoutIds: JSON.parse(body).workoutIds }));
  } else if (request.url === "/api/snapshot") {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ userId: "user-a", workout: snapshot }));
  } else if (request.url === "/api/sync") {
    response.setHeader("Content-Type", "application/json");
    response.end('{"ok":true}');
  } else {
    response.setHeader("Content-Type", "text/html");
    response.end("<!doctype html><title>Offline persistence tests</title>");
  }
});

await test("persistencia y sincronización con IndexedDB real", async (t) => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ headless: true,
      ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
    });
    const open = async (context) => {
      const page = await context.newPage();
      await page.goto(origin);
      await page.evaluate(async () => {
        window.api = await import("/offline-queue");
        window.storage = await import("/offline/storage");
        window.plansApi = await import("/offline/plans");
        window.planStorage = await import("/offline/plan-storage");
        window.syncState = await import("/offline/sync-state");
        window.background = await import("/offline/background-sync");
      });
      return page;
    };
    const scenario = (name, fn) => t.test(name, async () => {
      const context = await browser.newContext();
      try { await fn(await open(context), context, open); }
      finally { await context.close(); }
    });
    const seed = (page) => page.evaluate(async (value) => {
      await window.plansApi.identifyPlanAccount("user-a");
      const state = await window.storage.leerEstado();
      await window.storage.aceptarSnapshot(value, state.revision, state);
    }, snapshot);
    const enqueue = (page, value) => page.evaluate((m) => window.api.encolar(m), value);
    const state = (page) => page.evaluate(() => window.storage.leerEstado());

    await scenario("cancelar sustituye la cola, persiste al cerrar sin red y permite otro inicio", async (page, context, reopen) => {
      await page.evaluate(() => window.plansApi.downloadOfflinePlans());
      const first = await page.evaluate((id) => window.api.iniciarEntreno("user-a", id), plansFixture.plans[0].id);
      await enqueue(page, mutation("discarded-set", { workoutId: first.workoutId, workoutExerciseId: first.exercises[0].workoutExerciseId }));
      const cancel = { id: "discard", userId: "user-a", kind: "discardWorkout", workoutId: first.workoutId, createdAt: 300 };
      await enqueue(page, cancel); await enqueue(page, { ...cancel, id: "duplicate-discard" });
      assert.deepEqual((await state(page)).queue.map((item) => item.kind), ["discardWorkout"]);
      assert.equal((await state(page)).workout.localCompletedAt, undefined);
      assert.equal((await state(page)).workout.localDiscardedAt, 300);
      await assert.rejects(enqueue(page, { ...cancel, id: "finish-canceled", kind: "finishWorkout" }));
      await page.close(); page = await reopen(context); await context.setOffline(true);
      assert.equal((await state(page)).workout.localDiscardedAt, 300);
      const next = await page.evaluate((id) => window.api.iniciarEntreno("user-a", id), plansFixture.plans[0].id);
      assert.notEqual(next.workoutId, first.workoutId);
      assert.deepEqual(next.exercises[0].previous, plansFixture.plans[0].exercises[0].previous?.sets ?? []);
      assert.equal((await state(page)).workout.workoutId, next.workoutId);
      const calls = [];
      await page.route("**/api/sync", (route) => { calls.push(route.request().postDataJSON().kind); return route.fulfill({ json: { ok: true } }); });
      await context.setOffline(false);
      assert.equal((await page.evaluate(() => window.api.sincronizar())).quedan, 0);
      assert.deepEqual(calls, ["discardWorkout", "startWorkout"]);
      assert.deepEqual((await state(page)).workouts.map((workout) => workout.workoutId), [next.workoutId]);
    });
    await scenario("una respuesta en vuelo de una serie cancelada no bloquea la cancelación", async (page) => {
      await seed(page); await enqueue(page, mutation("in-flight")); await enqueue(page, mutation("not-sent"));
      let release; const blocked = new Promise((resolve) => { release = resolve; });
      let arrived; const waiting = new Promise((resolve) => { arrived = resolve; });
      const calls = [];
      await page.route("**/api/sync", async (route) => {
        const value = route.request().postDataJSON(); calls.push(value.id);
        if (value.id === "in-flight") { arrived(); await blocked; await route.fulfill({ status: 409, json: {} }); }
        else await route.fulfill({ json: { ok: true } });
      });
      await page.evaluate(() => { window.syncing = window.api.sincronizar(); }); await waiting;
      await enqueue(page, { id: "cancel", kind: "discardWorkout", userId: "user-a", workoutId: "workout", createdAt: 300 });
      release();
      const first = await page.evaluate(() => window.syncing);
      assert.equal(first.error, undefined);
      await page.evaluate(() => window.api.sincronizar());
      assert.deepEqual(calls, ["in-flight", "cancel"]);
      assert.equal((await state(page)).workout, null);
      assert.equal((await state(page)).queue.length, 0);
    });
    await scenario("una cancelación sin confirmación conserva sesión y operación", async (page) => {
      await seed(page);
      await enqueue(page, { id: "cancel", kind: "discardWorkout", userId: "user-a", workoutId: "workout", createdAt: 300 });
      await page.route("**/api/sync", (route) => route.fulfill({ status: 500, json: {} }));
      await page.evaluate(() => window.api.sincronizar());
      assert.equal((await state(page)).workout.localDiscardedAt, 300);
      assert.equal((await state(page)).queue.length, 1);
      await page.unroute("**/api/sync");
      await page.evaluate(() => window.api.sincronizar());
      assert.equal((await state(page)).workout, null);
    });

    await scenario("añadir/borrar sobreviven a cerrar y reabrir sin red", async (page, context, reopen) => {
      await seed(page);
      await enqueue(page, mutation("a"));
      await enqueue(page, mutation("b"));
      await enqueue(page, mutation("delete-a", { kind: "deleteSet", setId: "a" }));
      await page.close();
      page = await reopen(context);
      await context.setOffline(true);
      const local = await state(page);
      assert.deepEqual(local.workout.exercises[0].sets.map((s) => s.id), ["b"]);
      assert.equal(local.workout.exercises[0].sets[0].rpe, 7);
      assert.equal(local.queue.length, 3);
      const result = await page.evaluate(() => window.api.sincronizar());
      assert.equal(result.quedan, 3);
      await context.setOffline(false);
      assert.equal((await page.evaluate(() => window.api.sincronizar())).quedan, 0);
      assert.deepEqual((await state(page)).workout.exercises[0].sets.map((s) => s.id), ["b"]);
    });

    await scenario("una transacción abortada no guarda ni serie ni operación", async (page) => {
      await seed(page);
      const rejected = await page.evaluate(async (m) => {
        const original = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (value, key) {
          if (this.name === "entrenamientos") {
            this.transaction.abort();
            throw new Error("Simulación de fallo de almacenamiento");
          }
          return original.call(this, value, key);
        };
        try { await window.api.encolar(m); return false; }
        catch { return true; }
        finally { IDBObjectStore.prototype.put = original; }
      }, mutation("a"));
      assert.equal(rejected, true);
      const local = await state(page);
      assert.equal(local.queue.length, 0);
      assert.equal(local.workout.exercises[0].sets.length, 0);
    });

    await scenario("401/409/400/429/500 conservan toda la cola y su orden", async (page) => {
      await seed(page);
      await enqueue(page, mutation("a", { createdAt: 200 }));
      await enqueue(page, mutation("b", { createdAt: 100 }));
      for (const status of [401, 409, 400, 429, 500]) {
        const calls = [];
        await page.route("**/api/sync", async (route) => {
          calls.push(route.request().postDataJSON().id);
          await route.fulfill({ status, json: { error: "rechazado" } });
        });
        const result = await page.evaluate(() => window.api.sincronizar());
        assert.equal(result.quedan, 2);
        assert.ok(result.error);
        assert.deepEqual(calls, ["a"]);
        await page.unroute("**/api/sync");
      }
    });

    await scenario("finalizar conserva el snapshot hasta recibir confirmación", async (page) => {
      await seed(page);
      await enqueue(page, mutation("a"));
      await enqueue(page, mutation("finish", { kind: "finishWorkout", createdAt: 300 }));
      await page.reload();
      await page.evaluate(async () => {
        window.api = await import("/offline-queue");
        window.storage = await import("/offline/storage");
        window.plansApi = await import("/offline/plans");
        window.planStorage = await import("/offline/plan-storage");
        window.syncState = await import("/offline/sync-state");
        window.background = await import("/offline/background-sync");
      });
      assert.equal((await state(page)).workout.localCompletedAt, 300);
      assert.equal((await state(page)).workout.exercises[0].sets.length, 1);
      await page.evaluate(() => window.api.refrescarSesion());
      assert.equal((await state(page)).workout.localCompletedAt, 300);
      await page.evaluate(() => window.api.sincronizar());
      assert.equal((await state(page)).workout, null);
      assert.equal((await state(page)).queue.length, 0);
    });

    await scenario("un 200 sin confirmación explícita tampoco elimina cambios", async (page) => {
      await seed(page);
      await enqueue(page, mutation("a"));
      await page.route("**/api/sync", (route) => route.fulfill({ json: { accepted: false } }));
      const result = await page.evaluate(() => window.api.sincronizar());
      assert.equal(result.quedan, 1);
      assert.ok(result.error);
    });

    await scenario("almacenamiento bloqueado rechaza la escritura; no finge guardarla", async (page) => {
      const rejected = await page.evaluate(async (m) => {
        const original = indexedDB.open;
        indexedDB.open = () => { throw new DOMException("Bloqueado", "SecurityError"); };
        try { await window.api.encolar(m); return false; }
        catch { return true; }
        finally { indexedDB.open = original; }
      }, mutation("a"));
      assert.equal(rejected, true);
      assert.equal((await state(page)).queue.length, 0);
    });

    await scenario("sin Web Locks conserva la cola y explica el bloqueo", async (page) => {
      await seed(page);
      await enqueue(page, mutation("a"));
      const result = await page.evaluate(async () => {
        Object.defineProperty(navigator, "locks", { value: undefined, configurable: true });
        return window.api.sincronizar();
      });
      assert.equal(result.quedan, 1);
      assert.ok(result.error);
    });

    await scenario("una respuesta antigua no pisa cambios ya sincronizados", async (page) => {
      await seed(page);
      let release;
      let started;
      const waiting = new Promise((resolve) => { started = resolve; });
      const gate = new Promise((resolve) => { release = resolve; });
      await page.route("**/api/snapshot", async (route) => {
        started();
        await gate;
        await route.fulfill({ json: { userId: "user-a", workout: snapshot } });
      });
      await page.evaluate(() => { window.refresh = window.api.refrescarSesion(); });
      await waiting;
      await enqueue(page, mutation("a"));
      await page.evaluate(() => window.api.sincronizar());
      release();
      await page.evaluate(() => window.refresh);
      assert.equal((await state(page)).workout.exercises[0].sets[0].id, "a");
    });

    await scenario("dos pestañas comparten bloqueo y reciben avisos de cambios", async (page, context, reopen) => {
      await seed(page);
      const other = await reopen(context);
      await other.evaluate(() => {
        window.changes = 0;
        window.unsubscribe = window.api.suscribirCambios(() => { window.changes++; });
      });
      await enqueue(page, mutation("a"));
      await enqueue(other, mutation("b"));
      await other.waitForFunction(() => window.changes >= 2);
      let concurrent = 0;
      let maximum = 0;
      const calls = [];
      await context.route("**/api/sync", async (route) => {
        concurrent++;
        maximum = Math.max(maximum, concurrent);
        calls.push(route.request().postDataJSON().id);
        await new Promise((resolve) => setTimeout(resolve, 40));
        concurrent--;
        await route.fulfill({ json: { ok: true } });
      });
      await Promise.all([
        page.evaluate(() => window.api.sincronizar()),
        other.evaluate(() => window.api.sincronizar()),
      ]);
      assert.equal(maximum, 1);
      assert.deepEqual(calls, ["a", "b"]);
      assert.equal((await state(page)).queue.length, 0);
      await other.evaluate(() => window.unsubscribe());
    });

    await scenario("la cola antigua se recupera y se persiste antes de confirmarla", async (page) => {
      await seed(page);
      await page.evaluate(async (m) => {
        await new Promise((resolve, reject) => {
          const request = indexedDB.open("gym-progress");
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction("cola", "readwrite");
            tx.objectStore("cola").put(m);
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onabort = () => reject(tx.error);
          };
        });
      }, mutation("legacy"));
      assert.equal((await state(page)).legacyPending, 1);
      assert.equal((await state(page)).queue.length, 0);
      await page.evaluate(() => window.api.sincronizar());
      assert.equal((await state(page)).queue.length, 0);
      assert.equal((await state(page)).workout.exercises[0].sets[0].id, "legacy");
    });

    await scenario("una respuesta perdida se reintenta con el mismo identificador", async (page) => {
      await seed(page);
      await enqueue(page, mutation("a"));
      const accepted = new Set();
      const attempts = [];
      await page.route("**/api/sync", async (route) => {
        const id = route.request().postDataJSON().id;
        attempts.push(id);
        accepted.add(id);
        if (attempts.length === 1) await route.abort();
        else await route.fulfill({ json: { ok: true } });
      });
      assert.equal((await page.evaluate(() => window.api.sincronizar())).quedan, 1);
      assert.equal((await page.evaluate(() => window.api.sincronizar())).quedan, 0);
      assert.deepEqual(attempts, ["a", "a"]);
      assert.equal(accepted.size, 1);
    });
    await scenario("descarga todos los planes y los recupera sin visitar cada plan", async (page, context, reopen) => {
      await page.evaluate(() => window.plansApi.downloadOfflinePlans());
      await page.close();
      page = await reopen(context);
      await context.setOffline(true);
      const saved = await page.evaluate(() => window.planStorage.readOfflinePlans());
      assert.equal(saved.data.plans.length, 3);
      assert.equal(saved.data.plans[0].exercises[0].notes, plansFixture.plans[0].exercises[0].notes);
      assert.equal(saved.data.plans[0].exercises[0].previous.weightUnit, "lb");
      assert.equal(saved.data.reschedules.length, 1);
      assert.ok(saved.savedAt > 0);
      await assert.rejects(page.evaluate(() => window.plansApi.downloadOfflinePlans()));
      assert.deepEqual((await page.evaluate(() => window.planStorage.readOfflinePlans())).data, saved.data);
    });

    await scenario("una actualización sustituye planes archivados y conserva la sesión", async (page) => {
      await seed(page);
      await enqueue(page, mutation("a"));
      await page.evaluate(() => window.plansApi.downloadOfflinePlans());
      await page.route("**/api/offline/plans", (route) => route.fulfill({ json: { ...plansFixture, plans: [], reschedules: [] } }));
      await page.evaluate(() => window.plansApi.downloadOfflinePlans());
      assert.equal((await page.evaluate(() => window.planStorage.readOfflinePlans())).data.plans.length, 0);
      assert.equal((await state(page)).queue.length, 1);
      assert.equal((await state(page)).workout.exercises[0].sets[0].id, "a");
    });

    await scenario("fallos HTTP y paquetes inválidos conservan la última copia", async (page) => {
      await page.evaluate(() => window.plansApi.downloadOfflinePlans());
      for (const failure of [{ status: 500, json: {} }, { status: 200, json: { plans: [] } },
        { status: 200, json: { ...plansFixture, plans: [{ ...plansFixture.plans[0], exercises: [{}] }] } }]) {
        await page.route("**/api/offline/plans", (route) => route.fulfill(failure));
        await assert.rejects(page.evaluate(() => window.plansApi.downloadOfflinePlans()));
        assert.equal((await page.evaluate(() => window.planStorage.readOfflinePlans())).data.plans.length, 3);
        await page.unroute("**/api/offline/plans");
      }
    });

    await scenario("cada cuenta ve su copia; cerrar sesión la oculta sin eliminarla", async (page) => {
      await page.evaluate(() => window.plansApi.downloadOfflinePlans());
      await page.evaluate(() => window.plansApi.identifyPlanAccount("user-b"));
      assert.equal(await page.evaluate(() => window.planStorage.readOfflinePlans()), null);
      const userB = { ...plansFixture, userId: "user-b", plans: [], reschedules: [] };
      await page.route("**/api/offline/plans", (route) => route.fulfill({ json: userB }));
      await page.evaluate(() => window.plansApi.downloadOfflinePlans());
      assert.equal(await page.evaluate(() => window.planStorage.readOfflinePlans("user-a")), null);
      assert.equal((await page.evaluate(() => window.planStorage.readOfflinePlans())).userId, "user-b");
      await page.evaluate(() => window.plansApi.identifyPlanAccount(null));
      assert.equal(await page.evaluate(() => window.planStorage.readOfflinePlans()), null);
      await page.evaluate(() => window.plansApi.identifyPlanAccount("user-a"));
      assert.equal((await page.evaluate(() => window.planStorage.readOfflinePlans())).data.plans.length, 3);
    });

    await scenario("cerrar sesión invalida una descarga en vuelo incluso sin identidad previa", async (page) => {
      const accepted = await page.evaluate(async (data) => {
        const token = await window.planStorage.beginPlanDownload();
        await window.plansApi.identifyPlanAccount(null);
        return window.planStorage.saveOfflinePlans(data, token);
      }, plansFixture);
      assert.equal(accepted, false);
      assert.equal(await page.evaluate(() => window.planStorage.readOfflinePlans()), null);
    });

    await scenario("una descarga antigua y un 401 antiguo no pisan una cuenta nueva", async (page) => {
      const result = await page.evaluate(async (data) => {
        const old = await window.planStorage.beginPlanDownload();
        await window.plansApi.identifyPlanAccount("user-b");
        const next = await window.planStorage.beginPlanDownload();
        await window.planStorage.saveOfflinePlans({ ...data, userId: "user-b" }, next);
        return [await window.planStorage.saveOfflinePlans(data, old), await window.planStorage.rejectPlanSession(old)];
      }, plansFixture);
      assert.deepEqual(result, [false, false]);
      assert.equal((await page.evaluate(() => window.planStorage.readOfflinePlans())).userId, "user-b");
      await page.route("**/api/offline/plans", (route) => route.fulfill({ status: 401, json: {} }));
      await assert.rejects(page.evaluate(() => window.plansApi.downloadOfflinePlans()));
      assert.equal(await page.evaluate(() => window.planStorage.readOfflinePlans()), null);
    });

    await scenario("la descarga más reciente gana aunque la anterior termine después", async (page) => {
      const accepted = await page.evaluate(async (data) => {
        const first = await window.planStorage.beginPlanDownload();
        const second = await window.planStorage.beginPlanDownload();
        const fresh = await window.planStorage.saveOfflinePlans({ ...data, plans: [], reschedules: [] }, second);
        return [fresh, await window.planStorage.saveOfflinePlans(data, first)];
      }, plansFixture);
      assert.deepEqual(accepted, [true, false]);
      assert.equal((await page.evaluate(() => window.planStorage.readOfflinePlans())).data.plans.length, 0);
    });

    await scenario("migrar desde IndexedDB v2 conserva snapshot y cola pendientes", async (page) => {
      await page.evaluate(async ({ snapshot, mutation }) => {
        await new Promise((resolve, reject) => {
          const request = indexedDB.open("gym-progress", 2);
          request.onupgradeneeded = () => {
            request.result.createObjectStore("cola", { keyPath: "id" });
            request.result.createObjectStore("sesion");
          };
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction(["cola", "sesion"], "readwrite");
            tx.objectStore("cola").put(mutation);
            tx.objectStore("sesion").put(snapshot, "activa");
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onabort = () => reject(tx.error);
          };
        });
        await window.plansApi.downloadOfflinePlans();
      }, { snapshot, mutation: mutation("legacy") });
      assert.equal((await state(page)).workout, null);
      await page.route("**/api/sync", (route) => route.fulfill({ status: 500, json: {} }));
      await page.evaluate(() => window.api.sincronizar());
      assert.equal((await state(page)).queue.length, 1);
      assert.equal((await state(page)).workout.exercises[0].sets[0].id, "legacy");
      assert.equal((await page.evaluate(() => window.planStorage.readOfflinePlans())).data.plans.length, 3);
    });

    await scenario("calendario local: desplazamientos, coincidencias y paso de semana sin red", async (page) => {
      const result = await page.evaluate(async (data) => {
        const { plansOn } = await import("/schedule");
        return ["2026-10-26", "2026-10-28", "2026-11-02"].map((date) =>
          plansOn(data.plans, data.reschedules, date).map((item) => item.plan.id));
      }, plansFixture);
      assert.deepEqual(result, [[], [plansFixture.plans[1].id, plansFixture.plans[0].id], [plansFixture.plans[0].id]]);
    });

    await scenario("dos sesiones locales de días distintos sobreviven a reabrir y se envían en orden", async (page, context, reopen) => {
      await page.evaluate(() => window.plansApi.downloadOfflinePlans());
      await context.setOffline(true);
      const create = async (time) => page.evaluate(async ({ planId, time }) => {
        const original = Date.now;
        Date.now = () => time;
        try { return await window.api.iniciarEntreno("user-a", planId); }
        finally { Date.now = original; }
      }, { planId: plansFixture.plans[0].id, time });
      const one = await create(Date.parse("2026-10-21T08:00:00Z"));
      await enqueue(page, mutation(crypto.randomUUID(), { workoutId: one.workoutId,
        workoutExerciseId: one.exercises[0].workoutExerciseId, setId: crypto.randomUUID(), createdAt: Date.parse(one.performedAt) + 60_000 }));
      await enqueue(page, { id: crypto.randomUUID(), userId: "user-a", kind: "finishWorkout", workoutId: one.workoutId, createdAt: Date.parse(one.performedAt) + 3_600_000 });
      await context.setOffline(false); // Solo para volver a cargar los módulos del harness.
      await page.close();
      page = await reopen(context);
      await context.setOffline(true);
      const two = await create(Date.parse("2026-10-22T08:00:00Z"));
      assert.notEqual(one.workoutId, two.workoutId);
      assert.equal(two.exercises[0].previousWeightUnit, "kg");
      assert.equal(two.exercises[0].previous[0].weight, 50);
      await enqueue(page, mutation(crypto.randomUUID(), { workoutId: two.workoutId,
        workoutExerciseId: two.exercises[0].workoutExerciseId, setId: crypto.randomUUID() }));
      await enqueue(page, { id: crypto.randomUUID(), userId: "user-a", kind: "finishWorkout", workoutId: two.workoutId, createdAt: Date.parse(two.performedAt) + 3_600_000 });
      assert.equal((await state(page)).workouts.length, 2);
      assert.equal((await state(page)).queue.length, 6);
      const calls = [];
      await page.route("**/api/sync", async (route) => {
        calls.push(route.request().postDataJSON());
        await route.fulfill({ json: { ok: true } });
      });
      await context.setOffline(false);
      assert.equal((await page.evaluate(() => window.api.sincronizar())).quedan, 0);
      assert.deepEqual(calls.map((item) => item.kind), ["startWorkout", "addSet", "finishWorkout", "startWorkout", "addSet", "finishWorkout"]);
      assert.equal(calls[0].performedAt, one.performedAt);
      assert.equal(calls[3].performedAt, two.performedAt);
      assert.equal((await state(page)).workouts.length, 0);
    });

    await scenario("el inicio copia los objetivos y notas y no cambia al actualizar el plan", async (page) => {
      await page.evaluate(() => window.plansApi.downloadOfflinePlans());
      const workout = await page.evaluate((planId) => window.api.iniciarEntreno("user-a", planId), plansFixture.plans[0].id);
      await page.route("**/api/offline/plans", (route) => route.fulfill({ json: { ...plansFixture,
        plans: [{ ...plansFixture.plans[0], exercises: [{ ...plansFixture.plans[0].exercises[0], targetSets: 5, notes: "Otra nota" }] }], reschedules: [] } }));
      await page.evaluate(() => window.plansApi.downloadOfflinePlans());
      const current = (await state(page)).workout;
      assert.equal(current.workoutId, workout.workoutId);
      assert.equal(current.exercises[0].targetSets, 3);
      assert.equal(current.exercises[0].notes, plansFixture.plans[0].exercises[0].notes);
      assert.equal(current.exercises[0].previousWeightUnit, "lb");
    });

    await scenario("doble inicio entre pestañas devuelve una única sesión", async (page, context, reopen) => {
      await page.evaluate(() => window.plansApi.downloadOfflinePlans());
      const other = await reopen(context);
      const [a, b] = await Promise.all([
        page.evaluate((id) => window.api.iniciarEntreno("user-a", id), plansFixture.plans[0].id),
        other.evaluate((id) => window.api.iniciarEntreno("user-a", id), plansFixture.plans[0].id),
      ]);
      assert.equal(a.workoutId, b.workoutId);
      assert.equal((await state(page)).queue.length, 1);
      await assert.rejects(page.evaluate(() => window.api.iniciarEntreno("user-a", "otro-plan")));
      assert.equal((await state(page)).workouts.length, 1);
    });

    await scenario("un inicio abortado no deja ni sesión ni operación pendiente", async (page) => {
      await page.evaluate(() => window.plansApi.downloadOfflinePlans());
      const rejected = await page.evaluate(async (planId) => {
        const original = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (value, key) {
          if (this.name === "mutaciones") throw new Error("Sin espacio");
          return original.call(this, value, key);
        };
        try { await window.api.iniciarEntreno("user-a", planId); return false; }
        catch { return true; }
        finally { IDBObjectStore.prototype.put = original; }
      }, plansFixture.plans[0].id);
      assert.equal(rejected, true);
      assert.equal((await state(page)).workouts.length, 0);
      assert.equal((await state(page)).queue.length, 0);
    });

    await scenario("cambiar cuenta oculta sesiones y cola y no permite mutaciones de la anterior", async (page) => {
      await page.evaluate(() => window.plansApi.downloadOfflinePlans());
      const workout = await page.evaluate((id) => window.api.iniciarEntreno("user-a", id), plansFixture.plans[0].id);
      await page.evaluate(() => window.plansApi.identifyPlanAccount("user-b"));
      assert.equal((await state(page)).workout, null);
      assert.equal((await state(page)).queue.length, 0);
      await assert.rejects(enqueue(page, mutation(crypto.randomUUID(), { workoutId: workout.workoutId, workoutExerciseId: workout.exercises[0].workoutExerciseId })));
      await page.evaluate(() => window.plansApi.identifyPlanAccount("user-a"));
      assert.equal((await state(page)).workout.workoutId, workout.workoutId);
      assert.equal((await state(page)).queue.length, 1);
    });

    await scenario("otra sesión remota produce un conflicto recuperable sin borrar datos", async (page) => {
      await page.evaluate(() => window.plansApi.downloadOfflinePlans());
      await page.evaluate((id) => window.api.iniciarEntreno("user-a", id), plansFixture.plans[0].id);
      const remoteId = crypto.randomUUID();
      await page.route("**/api/sync", (route) => route.fulfill({ status: 409, json: { code: "ACTIVE_WORKOUT", workoutId: remoteId } }));
      const result = await page.evaluate(() => window.api.sincronizar());
      assert.equal(result.remoteWorkoutId, remoteId);
      assert.equal(result.quedan, 1);
      assert.equal((await state(page)).workouts.length, 1);
      await page.unroute("**/api/sync");
      assert.equal((await page.evaluate(() => window.api.sincronizar())).quedan, 0);
      assert.equal((await state(page)).workout.serverCreated, true);
    });

    await scenario("una confirmación en vuelo nunca borra ni expone la cola de otra cuenta", async (page) => {
      await seed(page);
      await enqueue(page, mutation("a"));
      await enqueue(page, mutation("b"));
      let release;
      let started;
      const gate = new Promise((resolve) => { release = resolve; });
      const waiting = new Promise((resolve) => { started = resolve; });
      let calls = 0;
      await page.route("**/api/sync", async (route) => {
        calls++;
        started();
        await gate;
        await route.fulfill({ json: { ok: true } });
      });
      await page.evaluate(() => { window.syncing = window.api.sincronizar(); });
      await waiting;
      await page.evaluate(() => window.plansApi.identifyPlanAccount("user-b"));
      release();
      await page.evaluate(() => window.syncing);
      assert.equal(calls, 1);
      assert.equal((await state(page)).queue.length, 0);
      await page.evaluate(() => window.plansApi.identifyPlanAccount("user-a"));
      assert.equal((await state(page)).queue.length, 1);
    });

    await scenario("el estado compartido conserva errores accionables y diferencia fallos temporales", async (page) => {
      await seed(page);
      await enqueue(page, mutation("a"));
      for (const [status, expected, retryable] of [
        [401, "needs-auth", false], [403, "needs-auth", false], [409, "conflict", false],
        [400, "error", false], [429, "error", true], [503, "error", true],
      ]) {
        await page.route("**/api/sync", (route) => route.fulfill({ status, json: {} }));
        const result = await page.evaluate(() => window.api.sincronizar());
        const saved = await page.evaluate(() => window.syncState.readSyncView());
        assert.equal(saved.pending, 1);
        assert.equal(saved.status.state, expected);
        assert.equal(result.retryable, retryable);
        await page.unroute("**/api/sync");
      }
      await page.evaluate(() => window.plansApi.identifyPlanAccount("user-b"));
      assert.equal((await page.evaluate(() => window.syncState.readSyncView())).status, null);
      await page.evaluate(() => window.plansApi.identifyPlanAccount("user-a"));
      await page.evaluate(() => window.api.sincronizar());
      const confirmed = await page.evaluate(() => window.syncState.readSyncView());
      assert.equal(confirmed.pending, 0);
      assert.equal(confirmed.status.state, "synced");
      assert.ok(confirmed.status.lastSyncedAt > 0);
    });

    await scenario("un fallo de red es reintentable y nunca confirma el envío", async (page) => {
      await seed(page);
      await enqueue(page, mutation("a"));
      await page.route("**/api/sync", (route) => route.abort());
      const result = await page.evaluate(() => window.api.sincronizar());
      const saved = await page.evaluate(() => window.syncState.readSyncView());
      assert.equal(result.retryable, true);
      assert.equal(saved.pending, 1);
      assert.equal(saved.status.state, "error");
      assert.equal(saved.status.lastSyncedAt, undefined);
    });

    await scenario("Background Sync opcional o bloqueado no impide guardar cambios", async (page) => {
      await seed(page);
      const result = await page.evaluate(async () => {
        const original = navigator.serviceWorker.getRegistration;
        let calls = 0;
        try {
          navigator.serviceWorker.getRegistration = async () => ({ active: {}, sync: { register: async () => {
            calls++;
            throw new DOMException("No permitido", "NotAllowedError");
          } } });
          const denied = await window.background.requestBackgroundSync();
          navigator.serviceWorker.getRegistration = async () => ({ active: {} });
          const unsupported = await window.background.requestBackgroundSync();
          let tag;
          navigator.serviceWorker.getRegistration = async () => ({ active: {}, sync: { register: async (value) => { calls++; tag = value; } } });
          const accepted = await window.background.requestBackgroundSync();
          return { denied, unsupported, accepted, calls, tag };
        } finally { navigator.serviceWorker.getRegistration = original; }
      });
      assert.deepEqual(result, { denied: false, unsupported: false, accepted: true, calls: 2, tag: "gym-progress:outbox" });
      await enqueue(page, mutation("a"));
      assert.equal((await state(page)).queue.length, 1);
      assert.equal((await page.evaluate(() => window.api.sincronizar())).quedan, 0);
    });

    await scenario("una sesión caducada muestra un aviso genérico sin exponer la cola anterior", async (page) => {
      await seed(page);
      await enqueue(page, mutation("a"));
      const before = await page.evaluate(() => window.planStorage.beginPlanDownload());
      await page.evaluate((token) => window.planStorage.rejectPlanSession(token), before);
      const hidden = await page.evaluate(() => window.syncState.readSyncView());
      assert.equal(hidden.needsAuth, true);
      assert.equal(hidden.userId, null);
      assert.equal(hidden.pending, 0);
      await page.evaluate(() => window.plansApi.identifyPlanAccount(null));
      assert.equal((await page.evaluate(() => window.syncState.readSyncView())).needsAuth, false);
      await page.evaluate(() => window.plansApi.identifyPlanAccount("user-a"));
      assert.equal((await state(page)).queue.length, 1);
    });
    await scenario("calistenia: variantes y segundos sobreviven al cierre y no se confunden con kilos", async (page, context, reopen) => {
      const data = structuredClone(plansFixture);
      data.schemaVersion = 2;
      data.plans[0].exercises = ["bodyweight", "weighted", "assisted", "bodyweight"].map((loadType, index) => ({
        ...data.plans[0].exercises[0], id: `plan-exercise-${index}`, exerciseId: `exercise-${index}`,
        measurement: index === 3 ? "time" : "reps", loadType, targetSeconds: index === 3 ? 30 : null,
        targetRepsMin: index === 3 ? null : 8, targetRepsMax: index === 3 ? null : 12, previous: null,
      }));
      await page.evaluate(async (data) => {
        await window.plansApi.identifyPlanAccount("user-a");
        const token = await window.planStorage.beginPlanDownload();
        if (!await window.planStorage.saveOfflinePlans(data, token)) throw new Error("Paquete rechazado");
        await window.api.iniciarEntreno("user-a", data.plans[0].id);
      }, data);
      await context.setOffline(true);
      const workout = (await state(page)).workout;
      for (const [index, exercise] of workout.exercises.entries()) {
        await enqueue(page, mutation(`calis-${index}`, { workoutId: workout.workoutId,
          workoutExerciseId: exercise.workoutExerciseId, loadType: exercise.loadType,
          reps: index === 3 ? 0 : 8, durationSeconds: index === 3 ? 35 : null,
          weight: index === 1 ? 10 : 0, assistanceNote: index === 2 ? "Banda verde" : null }));
      }
      await assert.rejects(enqueue(page, mutation("invalid", { workoutId: workout.workoutId, workoutExerciseId: workout.exercises[3].workoutExerciseId })));
      await context.setOffline(false);
      await page.close(); page = await reopen(context); await context.setOffline(true);
      const restored = (await state(page)).workout;
      assert.deepEqual(restored.exercises.map((exercise) => exercise.sets[0].loadType), ["bodyweight", "weighted", "assisted", "bodyweight"]);
      assert.equal(restored.exercises[3].sets[0].durationSeconds, 35);
      assert.equal(restored.exercises[2].sets[0].assistanceNote, "Banda verde");
      assert.equal(restored.exercises[3].targetRepsMin, null);
      await context.setOffline(false);
      assert.equal((await page.evaluate(() => window.api.sincronizar())).quedan, 0);
    });
    await scenario("bloques: rondas y cronómetro persisten sin red y rechazan resultados incompatibles", async (page, context, reopen) => {
      await seed(page);
      const data = structuredClone(plansFixture);
      data.schemaVersion = 3;
      const block = { id: "00000000-0000-4000-8000-000000000090", name: "Circuito", format: "circuit", exerciseIds: [data.plans[0].exercises[0].exerciseId], rounds: 3, durationSeconds: null, timeCapSeconds: null, intervalSeconds: null };
      data.plans[0].blocks = [block];
      await page.evaluate(async (data) => { const token = await window.planStorage.beginPlanDownload(); await window.planStorage.saveOfflinePlans(data, token); }, data);
      // Cerrar la sesión de prueba anterior antes de iniciar la del paquete.
      await enqueue(page, { id: "finish-old", userId: "user-a", workoutId: "workout", kind: "finishWorkout", createdAt: 150 });
      const workout = await page.evaluate((id) => window.api.iniciarEntreno("user-a", id), data.plans[0].id);
      await context.setOffline(true);
      const id = "00000000-0000-4000-8000-000000000091", createdAt = Date.now();
      const progress = { mutationId: id, updatedAt: createdAt, startedAt: createdAt - 5000, elapsedSeconds: 10, result: { rounds: 2, reps: 0, intervals: 0, durationSeconds: null, completed: false, adaptation: "rx", adaptationNote: null } };
      const m = { id, createdAt, userId: "user-a", workoutId: workout.workoutId, kind: "blockProgress", blockId: block.id, progress };
      await enqueue(page, m);
      await assert.rejects(enqueue(page, { ...m, id: "00000000-0000-4000-8000-000000000092", progress: { ...progress, result: { ...progress.result, rounds: 4 } } }));
      await context.setOffline(false); await page.close(); page = await reopen(context); await context.setOffline(true);
      const restored = (await state(page)).workout;
      assert.equal(restored.blocks[0].rounds, 3);
      assert.equal(restored.blockProgress[block.id].result.rounds, 2);
      const elapsed = await page.evaluate((value) => import("/training-blocks").then((api) => api.elapsedBlock(value)), progress);
      assert.ok(elapsed >= 15);
      await context.setOffline(false); assert.equal((await page.evaluate(() => window.api.sincronizar())).quedan, 0);
    });
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
