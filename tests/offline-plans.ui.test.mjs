import assert from "node:assert/strict";
import { createServer, request as httpRequest } from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { plansFixture } from "./fixtures/offline-plans.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const root = fileURLToPath(new URL("../", import.meta.url));
const listen = (server) => new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const close = (server) => new Promise((resolve) => server.close(resolve));
async function until(check, label) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`No se completó: ${label}`);
}

await test("planes en la PWA compilada: descarga automática y primera apertura offline", { timeout: 90_000 }, async () => {
  const reservation = createServer();
  await listen(reservation);
  const port = reservation.address().port;
  await close(reservation);
  const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  let logs = "";
  app.stdout.on("data", (data) => { logs = (logs + data).slice(-3000); });
  app.stderr.on("data", (data) => { logs = (logs + data).slice(-3000); });
  let current = structuredClone(plansFixture);
  let status = 200;
  let downloads = 0;
  let rootMode = "online";
  let syncStatus = 200;
  const serverWorkouts = new Map();
  const receipts = new Set();
  const syncCalls = [];
  // Las APIs se resuelven aquí. Ninguna petición de prueba llega a la base real.
  const proxy = createServer(async (request, response) => {
    if (request.url === "/") {
      response.setHeader("Cache-Control", "private, no-store");
      response.setHeader("Content-Type", "text/html");
      response.statusCode = rootMode === "unavailable" ? 503 : 200;
      response.end(rootMode === "unavailable" ? "No disponible" : "<!doctype html><h1>Inicio online de prueba</h1>");
      return;
    }
    if (request.url.startsWith("/api/") || request.url.startsWith("/ingest")) {
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Content-Type", "application/json");
      if (request.url.startsWith("/api/offline/plans")) {
        downloads++;
        response.statusCode = status;
        response.end(JSON.stringify(status === 200 ? current : { error: "Sin sesión" }));
      } else if (request.url.startsWith("/api/snapshot")) response.end(JSON.stringify({ userId: current.userId, workout: null }));
      else if (request.url.startsWith("/api/sync")) {
        let body = "";
        for await (const chunk of request) body += chunk;
        const mutation = JSON.parse(body);
        syncCalls.push(mutation);
        if (syncStatus !== 200) {
          response.statusCode = syncStatus;
          response.end(JSON.stringify({ error: "Sin sesión de prueba" }));
          return;
        }
        if (!receipts.has(mutation.id)) {
          if (mutation.kind === "startWorkout") serverWorkouts.set(mutation.workoutId, { start: mutation, sets: [], completedAt: null });
          else if (mutation.kind === "addSet") serverWorkouts.get(mutation.workoutId).sets.push(mutation);
          else if (mutation.kind === "finishWorkout") serverWorkouts.get(mutation.workoutId).completedAt = mutation.createdAt;
          receipts.add(mutation.id);
        }
        response.end('{"ok":true}');
      } else response.end("{}");
      return;
    }
    const upstream = httpRequest({ hostname: "127.0.0.1", port, path: request.url, method: request.method, headers: { ...request.headers, host: `127.0.0.1:${port}` } }, (incoming) => {
      response.writeHead(incoming.statusCode, incoming.headers);
      incoming.pipe(response);
    });
    upstream.on("error", () => { response.statusCode = 502; response.end("App no disponible"); });
    request.pipe(upstream);
  });
  let browser;
  try {
    await listen(proxy);
    const origin = `http://127.0.0.1:${proxy.address().port}`;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (app.exitCode !== null) throw new Error(logs);
      try { if ((await fetch(`http://127.0.0.1:${port}/entreno`)).ok) break; }
      catch { /* Esperar al servidor local de pruebas. */ }
      if (attempt === 99) throw new Error(`La app no arrancó: ${logs}`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    browser = await chromium.launch({ headless: true,
      ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
    });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "America/New_York" });
    let page = await context.newPage();
    const manifest = await (await fetch(`${origin}/manifest.webmanifest`)).json();
    assert.equal(manifest.id, "/");
    assert.equal(manifest.start_url, "/abrir");
    const launchUrl = `${origin}${manifest.start_url}`;
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${origin}/entreno`);
    await until(() => page.evaluate(async () => {
      if (!navigator.serviceWorker.controller) return false;
      if (!await caches.match("/planes-guardados", { ignoreSearch: true }) || !await caches.match("/abrir", { ignoreSearch: true })) return false;
      return new Promise((resolve) => {
        const request = indexedDB.open("gym-progress");
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains("planes")) { db.close(); resolve(false); return; }
          const tx = db.transaction("planes", "readonly");
          const get = tx.objectStore("planes").get("user-a");
          get.onsuccess = () => resolve(!!get.result);
          tx.oncomplete = () => db.close();
        };
      });
    }), "descarga automática y precache de la consulta");
    assert.ok(downloads > 0, "la app descargó planes desde otra pantalla");
    await page.getByText("Elige tu próximo entrenamiento", { exact: true }).waitFor();
    const cachedPage = await page.evaluate(async () => {
      const response = await caches.match("/planes-guardados", { ignoreSearch: true });
      const body = await response.text();
      return { url: response.url, isPlans: body.includes("Planes guardados"), isWorkout: body.includes("Elige tu próximo entrenamiento") };
    });
    assert.equal(cachedPage.isPlans, true);
    assert.equal(cachedPage.isWorkout, false);
    await page.evaluate(async () => {
      const cache = await caches.open("phase-3-private-cache");
      for (const path of ["/", "/history"]) await cache.put(path, new Response("<h1>DATOS PRIVADOS ANTIGUOS DE PRUEBA</h1>", { headers: { "Content-Type": "text/html" } }));
    });
    await context.setOffline(true);
    await page.goto(`${origin}/`);
    await page.getByRole("heading", { name: "Tu gimnasio sin conexión", exact: true }).waitFor();
    assert.equal(await page.getByText("DATOS PRIVADOS ANTIGUOS DE PRUEBA").count(), 0);
    await page.goto(`${origin}/history`);
    await page.getByRole("heading", { name: "Tu gimnasio sin conexión", exact: true }).waitFor();
    assert.equal(await page.getByText("DATOS PRIVADOS ANTIGUOS DE PRUEBA").count(), 0);
    await page.screenshot({ path: "/tmp/gym-offline-home-mobile.png", fullPage: true });
    await page.close();
    page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    // Reabrir la app sin red, sin haber visitado antes esta pantalla.
    const navigation = await page.goto(launchUrl);
    assert.equal(navigation?.status(), 200);
    assert.equal(navigation?.fromServiceWorker(), true);
    try {
      await page.getByRole("heading", { name: "Planes guardados", exact: true }).waitFor({ timeout: 10_000 });
    } catch (error) {
      console.error(await page.evaluate(async () => ({
        path: location.pathname, body: document.body.innerText.slice(0, 1800),
        cached: (await (await caches.match("/planes-guardados", { ignoreSearch: true }))?.text())?.slice(0, 500),
      })));
      console.error("Errores de página", errors);
      await page.screenshot({ path: "/tmp/gym-offline-plans-failure.png", fullPage: true });
      throw error;
    }
    await page.getByText("3 planes disponibles para consultar sin conexión", { exact: true }).waitFor();
    await page.getByRole("link", { name: "Inicio", exact: true }).click();
    await page.getByRole("heading", { name: "Tu gimnasio sin conexión", exact: true }).waitFor();
    await page.getByRole("link", { name: "Elegir un plan guardado", exact: true }).click();
    await page.getByRole("heading", { name: "Planes guardados", exact: true }).waitFor();
    await page.getByLabel("Consultar otro día").fill("2026-10-28");
    await page.getByRole("region", { name: "Para la fecha elegida" }).getByRole("link", { name: "Piernas y core" }).waitFor();
    await page.getByText("Baja con control y mantén el apoyo.", { exact: true }).waitFor();
    await page.getByText(/110 lb × 8/).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: "/tmp/gym-offline-plans-mobile.png", fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: "/tmp/gym-offline-plans-desktop.png", fullPage: true });
    const startSession = async () => {
      const details = page.locator(`#plan-${plansFixture.plans[0].id}`);
      if (!await details.getAttribute("open")) {
        if (!await details.evaluate((element) => element.open)) await details.locator("summary").click();
      }
      await page.getByRole("button", { name: "Empezar Piernas y core", exact: true }).click();
      try { await page.getByRole("heading", { name: "Piernas y core", exact: true }).waitFor({ timeout: 10_000 }); }
      catch (error) {
        console.error("Fallo al empezar", await page.evaluate(async () => ({ path: location.pathname, body: document.body.innerText.slice(0, 2400),
          sessions: await new Promise((resolve) => {
            const request = indexedDB.open("gym-progress");
            request.onsuccess = () => { const db = request.result; const tx = db.transaction("entrenamientos", "readonly"); const all = tx.objectStore("entrenamientos").getAll(); all.onsuccess = () => resolve(all.result.map((item) => ({ id: item.workoutId, userId: item.userId }))); tx.oncomplete = () => db.close(); };
          }),
          cache: await Promise.all(["/entreno", "/planes-guardados"].map(async (url) => {
            const response = await caches.match(url, { ignoreSearch: true });
            const text = await response?.text();
            return { url, responseUrl: response?.url, type: response?.headers.get("Content-Type"), sample: text?.slice(0, 110), isPlans: text?.includes("Planes guardados"), isTrain: text?.includes("Elige tu próximo entrenamiento") };
          })) })), errors);
        await page.screenshot({ path: "/tmp/gym-offline-start-failure.png", fullPage: true });
        throw error;
      }
    };
    const register = async (weight) => {
      await page.getByLabel("PESO KG", { exact: true }).fill(String(weight));
      await page.getByLabel("REPS", { exact: true }).fill("8");
      await page.getByLabel("RPE · esfuerzo del 1 al 10 (opcional)").fill("7.5");
      await page.getByRole("button", { name: "Registrar serie", exact: true }).click();
      await page.getByText(`${weight} kg × 8`, { exact: true }).waitFor();
    };
    const finish = async () => {
      await page.getByRole("button", { name: "Finalizar sesión", exact: true }).click();
      await page.getByRole("button", { name: "Sí, continuar", exact: true }).click();
      await page.getByText("Entrenamiento finalizado en este dispositivo", { exact: true }).waitFor();
    };
    await page.setViewportSize({ width: 390, height: 844 });
    await startSession();
    assert.equal(await page.getByLabel("PESO KG", { exact: true }).inputValue(), "49.9");
    await register(55);
    await page.close();
    page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(launchUrl);
    await page.getByText("55 kg × 8", { exact: true }).waitFor();
    await page.getByRole("link", { name: "Inicio", exact: true }).click();
    await page.getByRole("link", { name: "Continuar entrenamiento", exact: true }).waitFor();
    await page.getByRole("link", { name: "Continuar entrenamiento", exact: true }).click();
    await page.getByText("55 kg × 8", { exact: true }).waitFor();
    await page.screenshot({ path: "/tmp/gym-offline-training-mobile.png", fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: "/tmp/gym-offline-training-desktop.png", fullPage: true });
    await finish();
    await page.close();
    page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(launchUrl);
    await page.getByRole("heading", { name: "Planes guardados", exact: true }).waitFor();
    await startSession();
    await register(60);
    await finish();
    assert.equal(await page.getByRole("region", { name: "Sesiones finalizadas pendientes" }).getByRole("listitem").count(), 2);
    await context.setOffline(false);
    await until(async () => serverWorkouts.size === 2 && [...serverWorkouts.values()].every((workout) => workout.completedAt !== null), "sincronizar dos sesiones offline");
    assert.deepEqual([...serverWorkouts.values()].map((workout) => workout.sets.length), [1, 1]);
    assert.deepEqual([...serverWorkouts.values()].map((workout) => workout.sets[0].weight), [55, 60]);
    assert.equal(new Set(syncCalls.filter((call) => call.kind === "startWorkout").map((call) => call.workoutId)).size, 2);
    await until(() => page.evaluate(() => new Promise((resolve) => {
      const request = indexedDB.open("gym-progress");
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("mutaciones", "readonly");
        const count = tx.objectStore("mutaciones").index("userId").count("user-a");
        count.onsuccess = () => resolve(count.result === 0);
        tx.oncomplete = () => db.close();
      };
    })), "confirmar la cola vacía");
    await page.goto(`${origin}/planes-guardados`);
    current = { ...plansFixture, plans: plansFixture.plans.slice(0, 2) };
    await page.getByRole("button", { name: "Actualizar planes", exact: true }).click();
    await page.getByText("2 planes disponibles para consultar sin conexión", { exact: true }).waitFor();
    status = 401;
    await page.getByRole("button", { name: "Actualizar planes", exact: true }).click();
    await page.getByText("Inicia sesión para actualizar los planes de esta cuenta.", { exact: true }).waitFor();
    await page.getByRole("heading", { name: "Todos tus planes" }).waitFor({ state: "detached" });
    status = 200;
    current = { ...plansFixture, userId: "user-b", plans: [], reschedules: [] };
    await page.getByRole("button", { name: "Actualizar planes", exact: true }).click();
    await page.getByText("No tienes planes activos para descargar", { exact: true }).waitFor();
    await page.getByRole("heading", { name: "Todos tus planes" }).waitFor({ state: "detached" });
    // La API de Chrome se usa solo para disparar de forma determinista el
    // evento real del worker. La decisión de cuándo ejecutarlo en producción
    // pertenece al navegador y no se promete al usuario.
    current = structuredClone(plansFixture);
    await page.getByRole("button", { name: "Actualizar planes", exact: true }).click();
    await page.getByText("3 planes disponibles para consultar sin conexión", { exact: true }).waitFor();
    const dispatchWithoutApp = async () => {
      await until(() => page.evaluate(async () => {
        const registration = await navigator.serviceWorker.ready;
        return (await registration.sync.getTags()).includes("gym-progress:outbox");
      }), "registrar Background Sync");
      const control = await context.newPage(); // about:blank, sin código de la app.
      const cdp = await context.newCDPSession(control);
      const workerErrors = [];
      cdp.on("ServiceWorker.workerErrorReported", (error) => workerErrors.push(error.errorMessage));
      let registrationId;
      cdp.on("ServiceWorker.workerRegistrationUpdated", ({ registrations }) => {
        registrationId = registrations.find((item) => item.scopeURL === `${origin}/` && !item.isDeleted)?.registrationId ?? registrationId;
      });
      await cdp.send("ServiceWorker.enable");
      await until(() => !!registrationId, "encontrar el registro del worker");
      await page.close();
      assert.equal(context.pages().filter((item) => item.url().startsWith(origin)).length, 0);
      await context.setOffline(false);
      await cdp.send("ServiceWorker.dispatchSyncEvent", { origin, registrationId, tag: "gym-progress:outbox", lastChance: false });
      const worker = context.serviceWorkers().find((item) => item.url().startsWith(origin));
      assert.ok(worker);
      assert.equal(await worker.evaluate(() => typeof window), "undefined");
      return { worker, control, cdp, workerErrors };
    };
    const workerView = (worker) => worker.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open("gym-progress");
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(["mutaciones", "offline-meta"], "readonly");
        const status = tx.objectStore("offline-meta").get("sync:user-a");
        const count = tx.objectStore("mutaciones").index("userId").count("user-a");
        let remaining = 2;
        const ready = () => { if (--remaining === 0) resolve({ pending: count.result, status: status.result }); };
        count.onsuccess = ready;
        status.onsuccess = ready;
        tx.oncomplete = () => db.close();
        tx.onabort = () => reject(tx.error);
      };
    }));

    await context.setOffline(true);
    await startSession();
    await register(70);
    await finish();
    const success = await dispatchWithoutApp();
    try {
      await until(() => serverWorkouts.size === 3 && [...serverWorkouts.values()].every((workout) => workout.completedAt !== null), "enviar desde el worker sin páginas de la app");
    } catch (error) {
      console.error("Diagnóstico background", await workerView(success.worker), await success.worker.evaluate(() => ({ online: navigator.onLine, locks: !!navigator.locks, origin: self.location.origin })), { total: serverWorkouts.size, calls: syncCalls.map((call) => call.kind) });
      console.error("Lock/errores", await success.worker.evaluate(() => navigator.locks.query()), success.workerErrors);
      console.error("Fetch directo", await success.worker.evaluate(() => Promise.race([
        fetch("/api/offline/plans").then((response) => response.status).catch((error) => error.message),
        new Promise((resolve) => setTimeout(() => resolve("timeout"), 1500)),
      ])));
      throw error;
    }
    await until(async () => {
      const view = await workerView(success.worker);
      return view.pending === 0 && view.status?.state === "synced";
    }, "confirmar desde el worker");
    assert.equal((await workerView(success.worker)).status.state, "synced");
    await success.cdp.detach();
    await success.control.close();
    page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${origin}/planes-guardados`);
    await page.getByText("Cambios sincronizados", { exact: true }).waitFor();

    await context.setOffline(true);
    await startSession();
    await register(75);
    await finish();
    syncStatus = 401;
    const unauthorized = await dispatchWithoutApp();
    await until(async () => (await workerView(unauthorized.worker)).status?.state === "needs-auth", "conservar un 401 del worker");
    assert.equal((await workerView(unauthorized.worker)).pending, 3);
    assert.equal(serverWorkouts.size, 3);
    await unauthorized.cdp.detach();
    await unauthorized.control.close();
    page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${origin}/entreno`);
    await page.getByRole("link", { name: "Iniciar sesión para enviar", exact: true }).waitFor();
    syncStatus = 200;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await until(() => serverWorkouts.size === 4 && [...serverWorkouts.values()].every((workout) => workout.completedAt !== null), "recuperar después de autenticación");
    await page.getByText("Cambios sincronizados", { exact: true }).waitFor();

    // El flujo completo también funciona si SyncManager no está disponible.
    const withoutBackground = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await withoutBackground.addInitScript(() => {
      Object.defineProperty(ServiceWorkerRegistration.prototype, "sync", { configurable: true, get: () => undefined });
    });
    const previousPage = page;
    page = await withoutBackground.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${origin}/planes-guardados`);
    await page.getByText("3 planes disponibles para consultar sin conexión", { exact: true }).waitFor();
    await withoutBackground.setOffline(true);
    await startSession();
    await register(80);
    await finish();
    await withoutBackground.setOffline(false);
    await until(() => serverWorkouts.size === 5 && [...serverWorkouts.values()].every((workout) => workout.completedAt !== null), "reenviar sin Background Sync");
    await page.getByText("Cambios sincronizados", { exact: true }).waitFor();
    await withoutBackground.close();
    page = previousPage;

    current = structuredClone(plansFixture);
    current.schemaVersion = 2;
    current.plans[0].exercises = ["Dominadas", "Fondos con lastre", "Dominadas con banda", "Plancha"].map((name, index) => ({
      ...plansFixture.plans[0].exercises[0], name, id: `calis-${index}`,
      exerciseId: `00000000-0000-4000-8000-00000000001${index}`,
      measurement: index === 3 ? "time" : "reps", loadType: ["bodyweight", "weighted", "assisted", "bodyweight"][index],
      targetSeconds: index === 3 ? 30 : null, targetRepsMin: index === 3 ? null : 8, targetRepsMax: index === 3 ? null : 12, previous: null,
    }));
    await page.goto(`${origin}/planes-guardados`);
    await page.getByRole("button", { name: "Actualizar planes", exact: true }).click();
    await until(() => page.getByText("Plancha", { exact: true }).count(), "descargar el plan de calistenia");
    await context.setOffline(true);
    await startSession();
    for (const [index, name] of ["Dominadas", "Fondos con lastre", "Dominadas con banda", "Plancha"].entries()) {
      const card = page.locator('[data-slot="card"]').filter({ has: page.getByRole("heading", { name, exact: true }) });
      if (index === 1) await card.getByLabel("LASTRE KG", { exact: true }).fill("10");
      if (index === 2) await card.getByLabel("Banda o asistencia (opcional si indicas kilos)", { exact: true }).fill("Banda verde");
      await card.getByLabel(index === 3 ? "SEGUNDOS" : "REPS", { exact: true }).fill(index === 3 ? "35" : "8");
      await card.getByRole("button", { name: "Registrar serie", exact: true }).click();
    }
    await page.getByText("35 s · peso corporal", { exact: true }).waitFor();
    await page.screenshot({ path: "/tmp/gym-calisthenics-mobile.png", fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: "/tmp/gym-calisthenics-desktop.png", fullPage: true });
    await page.close(); page = await context.newPage();
    await page.goto(`${origin}/abrir`);
    await page.getByText("8 reps · banda (Banda verde)", { exact: true }).waitFor();
    await page.getByText("35 s · peso corporal", { exact: true }).waitFor();
    await finish();
    await context.setOffline(false);
    await until(() => serverWorkouts.size === 6 && [...serverWorkouts.values()].every((workout) => workout.completedAt !== null), "sincronizar calistenia tras reabrir");
    const calis = [...serverWorkouts.values()].at(-1);
    assert.equal(calis.sets.length, 4);
    assert.equal(calis.sets[3].durationSeconds, 35);
    assert.equal(calis.sets[2].assistanceNote, "Banda verde");

    rootMode = "unavailable";
    await page.goto(`${origin}/`);
    await page.getByRole("heading", { name: "Tu gimnasio sin conexión", exact: true }).waitFor();
    rootMode = "online";
    await page.goto(`${origin}/`);
    await page.getByRole("heading", { name: "Inicio online de prueba", exact: true }).waitFor();
    const savedPlanCount = await page.evaluate(() => new Promise((resolve) => {
      const request = indexedDB.open("gym-progress");
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("planes", "readonly");
        const count = tx.objectStore("planes").count();
        count.onsuccess = () => resolve(count.result);
        tx.oncomplete = () => db.close();
      };
    }));
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.register("/sw.js?cleanup-check=1", { scope: "/", type: "module" });
      const worker = registration.installing ?? registration.waiting;
      if (!worker || worker.state === "activated") return;
      await new Promise((resolve, reject) => worker.addEventListener("statechange", () => {
        if (worker.state === "activated") resolve();
        if (worker.state === "redundant") reject(new Error("No se pudo actualizar el worker de prueba"));
      }));
    });
    await until(() => page.evaluate(async () => {
      const cache = await caches.open("phase-3-private-cache");
      return !await cache.match("/") && !await cache.match("/history");
    }), "retirar respuestas privadas de la versión anterior");
    const remainingPlanCount = await page.evaluate(() => new Promise((resolve) => {
      const request = indexedDB.open("gym-progress");
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("planes", "readonly");
        const count = tx.objectStore("planes").count();
        count.onsuccess = () => resolve(count.result);
        tx.oncomplete = () => db.close();
      };
    }));
    assert.equal(remainingPlanCount, savedPlanCount);
    assert.deepEqual(errors, []);
    await context.close();
  } finally {
    await browser?.close();
    await close(proxy);
    if (app.exitCode === null) {
      app.kill("SIGTERM");
      await new Promise((resolve) => app.once("exit", resolve));
    }
  }
});
