import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Service worker generado por Serwist en cada build.
    "public/sw.js",
    "public/swe-worker-*.js",
    // Kit de terceros (skill anatomy, MIT) copiado sin tocar: se actualiza
    // volviendo a copiarlo, no editándolo, así que no se lintea aquí.
    "src/components/iso/**",
    // Skills instaladas con `npx skills add`.
    ".agents/**",
  ]),
]);

export default eslintConfig;
