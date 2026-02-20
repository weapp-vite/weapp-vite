# AGENTS Guidelines (packages/weapp-vite)

Scope: everything under `packages/weapp-vite/`.

Use this file as an optimization layer on top of root `AGENTS.md`.

## 1. High-Value Paths

- Compiler and transform logic:
  - `src/plugins/vue/transform/*`
  - `src/plugins/vue/compiler/*`
  - `src/wxml/*`
  - `src/wxs/*`
- Runtime-facing integration assertions:
  - `test/vue/*`
  - `src/plugins/vue/transform/compileVueFile.test.ts`

## 2. Fast Test Matrix

- If touching Vue transform output semantics (`compileVueFile`, class/style runtime, props fallback):
  - `pnpm vitest run packages/weapp-vite/src/plugins/vue/transform/compileVueFile.test.ts packages/weapp-vite/test/vue/class-style-runtime.test.ts packages/weapp-vite/test/vue/sfc-integration.test.ts`
- If touching issue #300 related behavior:
  - `pnpm vitest run -c ./e2e/vitest.e2e.devtools.config.ts e2e/ide/github-issues.runtime.test.ts -t "issue #300"`
  - `pnpm vitest run -c ./e2e/vitest.e2e.ci.config.ts e2e/ci/github-issues.build.test.ts -t "issue #300"`
- For broader package regression:
  - `pnpm vitest run packages/weapp-vite/test`

Run full monorepo `pnpm test` only when cross-package impact is likely or explicitly requested.

## 3. Compiler Output Invariants

- Template call expressions must compile to runtime bindings (for example `__wv_bind_*`) instead of leaving raw calls in WXML.
- Script setup expression access should preserve `__wevuProps` first and instance fallback semantics.
- Keep runtime safety guards (`try/catch`) around generated class/style and call-expression bindings where expected.
- Do not weaken existing issue regression coverage when adjusting generated code strings.

## 4. Editing Guardrails

- Prefer minimal diffs in generated-code string assertions: verify behavior intent, not fragile formatting trivia.
- When a behavior change is intentional, update:
  - transform implementation
  - unit tests
  - related e2e (if runtime-visible)
- Keep changes local to `packages/weapp-vite` unless there is a clear interface contract change.
