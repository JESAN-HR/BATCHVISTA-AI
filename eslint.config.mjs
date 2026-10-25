import { defineConfig, globalIgnores } from "eslint/config";
import next from "eslint-config-next/core-web-vitals";
import ts from "eslint-config-next/typescript";
export default defineConfig([
  ...next,
  ...ts,
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "data/**",
    "playwright-report/**",
    "test-results/**",
    "test-results-station/**",
    "test-results-browser/**",
    "public/ocr/**",
  ]),
  { rules: { "@next/next/no-img-element": "off" } },
]);
