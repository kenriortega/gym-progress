import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const pg = require("pg");
const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
async function freePort() { const s = createServer(); await new Promise((r) => s.listen(0, "127.0.0.1", r)); const port = s.address().port; await new Promise((r) => s.close(r)); return port; }
async function until(check, label) { const end = Date.now() + 30000; while (Date.now() < end) { if (await check()) return; await new Promise((r) => setTimeout(r, 100)); } throw new Error(label); }

// Next, autenticación de sesión y endpoints reales con una base desechable.
await test("disciplina prioriza planes y las seis plantillas se copian completas", { timeout: 120000 }, async () => {
  const directory = await mkdtemp("/private/tmp/gym-training-ui-");
  const data = join(directory, "data"), dbPort = await freePort(), appPort = await freePort();
  const bin = (name) => process.env.PG_TEST_BIN ? join(process.env.PG_TEST_BIN, name) : name;
  const origin = `http://127.0.0.1:${appPort}`;
  let started = false, pool, app, browser;
  let logs = "";
  try {
    await exec(bin("initdb"), ["-D", data, "-U", "gym_test", "-A", "trust", "--locale=C", "--encoding=UTF8"]);
    await exec(bin("pg_ctl"), ["-D", data, "-l", join(directory, "pg.log"), "-o", `-h 127.0.0.1 -p ${dbPort} -k ${directory}`, "-w", "start"]); started = true;
    const connectionString = `postgresql://gym_test@127.0.0.1:${dbPort}/postgres`;
    pool = new pg.Pool({ connectionString });
    for (const name of (await readdir(join(root, "drizzle"))).filter((name) => name.endsWith(".sql")).sort()) await pool.query(await readFile(join(root, "drizzle", name), "utf8"));
    const userId = randomUUID(), planId = randomUUID(), sessionToken = randomUUID();
    await pool.query("insert into users(id,email,name) values ($1,'ui@test.invalid','Prueba')", [userId]);
    await pool.query("insert into sessions(session_token,user_id,expires) values ($1,$2,now()+interval '1 day')", [sessionToken, userId]);
    await pool.query("insert into training_plans(id,user_id,name) values ($1,$2,'Plan de prueba')", [planId, userId]);
    app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(appPort)], {
      cwd: root, env: { ...process.env, DATABASE_URL: connectionString, AUTH_SECRET: "isolated-training-ui-test-secret", AUTH_TRUST_HOST: "true", AUTH_URL: origin, NEXT_PUBLIC_POSTHOG_KEY: "" }, stdio: ["ignore", "pipe", "pipe"],
    });
    app.stdout.on("data", (v) => { logs = (logs + v).slice(-6000); }); app.stderr.on("data", (v) => { logs = (logs + v).slice(-6000); });
    await until(async () => { if (app.exitCode !== null) throw new Error(logs); try { return (await fetch(`${origin}/abrir`)).ok; } catch { return false; } }, "Next no arrancó");
    browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addCookies([{ name: "authjs.session-token", value: sessionToken, url: origin }]);
    await context.route("**/ingest/**", (route) => route.fulfill({ status: 200, json: {} }));
    let page = await context.newPage(); const errors = []; page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem("gym-progress:novedades-vistas", "9999-12-31"));
    await pool.query("insert into training_plans(user_id,name,discipline) values ($1,'A Calistenia','calisthenics'),($1,'B CrossFit','crossfit'),($1,'C Mixto','mixed')", [userId]);
    await page.goto(`${origin}/plans`);
    const selector = page.getByRole("combobox", { name: "Disciplina", exact: true });
    const ownPlans = page.locator("section").filter({ has: page.getByRole("heading", { name: "Tus planes", exact: true }) });
    const templates = page.locator("section").filter({ has: page.getByRole("heading", { name: "Más planes listos para copiar", exact: true }) });
    const allTemplates = await templates.locator('[data-slot="card-title"]').allTextContents();
    for (const [label, firstPlan, firstTemplate] of [
      ["Calistenia", "A Calistenia", "Calistenia · Iniciación"],
      ["CrossFit", "B CrossFit", "CrossFit · AMRAP de iniciación"],
      ["Mixto", "C Mixto", "Calistenia · Iniciación"],
      ["Musculación", "Plan de prueba", "Cuerpo completo"],
    ]) {
      await selector.click();
      await page.getByRole("option", { name: label, exact: true }).click();
      assert.equal(await ownPlans.locator("h3").first().textContent(), firstPlan);
      assert.equal(await templates.locator('[data-slot="card-title"]').first().textContent(), firstTemplate);
      assert.equal(await ownPlans.locator("h3").count(), 4);
      assert.equal(await templates.locator('[data-slot="card-title"]').count(), allTemplates.length);
      assert.equal(await page.locator('input[name="discipline"]').inputValue(), { Calistenia: "calisthenics", CrossFit: "crossfit", Mixto: "mixed", Musculación: "strength" }[label]);
    }
    assert.deepEqual(await ownPlans.locator("h3").allTextContents(), ["Plan de prueba", "A Calistenia", "B CrossFit", "C Mixto"]);
    await selector.click();
    await page.getByRole("option", { name: "CrossFit", exact: true }).click();
    assert.deepEqual(await ownPlans.locator("h3").allTextContents(), ["B CrossFit", "A Calistenia", "C Mixto", "Plan de prueba"]);
    assert.deepEqual((await templates.locator('[data-slot="card-title"]').allTextContents()).slice(0, 4), ["CrossFit · AMRAP de iniciación", "CrossFit · EMOM en gimnasio", "CrossFit · Circuito por tiempo", "AMRAP editable"]);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await templates.locator("h2").evaluate((element) => element.scrollIntoView({ block: "start" }));
      await page.screenshot({ path: `/tmp/gym-plans-discipline-${width}-viewport.png` });
      await page.screenshot({ path: `/tmp/gym-plans-discipline-${width}.png`, fullPage: true });
    }
    for (const [name, discipline, exerciseCount, format] of [
      ["Calistenia · Iniciación", "calisthenics", 4, null],
      ["Calistenia · Torso y control", "calisthenics", 4, null],
      ["Calistenia · Piernas y core", "calisthenics", 4, null],
      ["CrossFit · AMRAP de iniciación", "crossfit", 3, "amrap"],
      ["CrossFit · EMOM en gimnasio", "crossfit", 2, "emom"],
      ["CrossFit · Circuito por tiempo", "crossfit", 3, "for-time"],
    ]) {
      await page.goto(`${origin}/plans`);
      const card = page.locator('[data-slot="card"]').filter({ has: page.getByText(name, { exact: true }) });
      await card.getByRole("button", { name: "Usar este plan", exact: true }).click();
      await page.waitForURL(/\/plans\/[^/]+$/);
      const plan = (await pool.query("select * from training_plans where user_id=$1 and name=$2", [userId, name])).rows[0];
      assert.equal(plan.discipline, discipline);
      assert.equal(Number((await pool.query("select count(*) from training_plan_exercises where plan_id=$1", [plan.id])).rows[0].count), exerciseCount);
      if (format) {
        assert.equal(plan.blocks[0].format, format);
        assert.equal(plan.blocks[0].exerciseIds.length, exerciseCount);
        assert.ok(plan.blocks[0].prescription.includes("Calienta"));
      } else assert.ok(plan.description.includes("Descansa"));
      if (name.endsWith("Iniciación")) {
        const metric = (await pool.query("select measurement,target_seconds from training_plan_exercises where plan_id=$1 and measurement='time'", [plan.id])).rows[0];
        assert.equal(metric.target_seconds, 20);
      }
    }
    assert.deepEqual(errors, []);
  } catch (error) {
    const page = browser?.contexts()[0]?.pages().at(-1);
    if (page && !page.isClosed()) {
      await page.screenshot({ path: "/tmp/gym-training-ui-failure.png", fullPage: true }).catch(() => {});
      console.error(await page.locator("body").innerText().catch(() => "Sin página"));
    }
    console.error(logs); throw error;
  }
  finally {
    await browser?.close();
    if (app && app.exitCode === null) { app.kill("SIGTERM"); await new Promise((r) => app.once("exit", r)); }
    await pool?.end(); if (started) await exec(bin("pg_ctl"), ["-D", data, "-m", "immediate", "-w", "stop"]);
    await rm(directory, { recursive: true, force: true });
  }
});
