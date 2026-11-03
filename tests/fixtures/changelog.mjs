import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url), ts = require("typescript");
const source = ts.transpileModule(await readFile(new URL("../../src/lib/changelog.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const catalog = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
export const LATEST_CHANGELOG_ID = catalog.LATEST_CHANGELOG_ID;
export const LATEST_CHANGELOG_TITLE = catalog.CHANGELOG[0].title;
