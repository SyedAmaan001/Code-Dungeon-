import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Layer boundaries (docs/architecture-proposal.md §3). Each layer may only depend
// on the layers beneath it; violations fail `npm run lint`.
const frameworkImports = [
  {
    group: ["react", "react/*", "react-dom", "react-dom/*"],
    message: "This layer must stay UI-free.",
  },
  { group: ["next", "next/*"], message: "This layer must stay framework-free." },
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", ".next-e2e/**", "test-results/**", "playwright-report/**", "node_modules/**", "coverage/**", "next-env.d.ts"]),
  {
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...frameworkImports,
            {
              group: ["@/ui/*", "@/app/*", "@/services/*", "@/runner/*", "@/learning/*"],
              message:
                "The game engine is pure: it receives plain data and imports no other layer.",
            },
            {
              group: ["node:*", "fs", "path", "child_process"],
              message: "The game engine performs no I/O.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/learning/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...frameworkImports,
            {
              group: ["@/ui/*", "@/app/*", "@/services/*", "@/domain/*"],
              message: "The learning engine knows content, not UI or scoring.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/ui/**/*.{ts,tsx}", "src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/learning/server", "@/learning/server/*", "@/learning/keys"],
              message: "Answer keys are server-only; use services that return public view models.",
            },
          ],
        },
      ],
    },
  },
]);
