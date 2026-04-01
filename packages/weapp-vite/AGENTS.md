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

## 5. Mini-Program Runtime Debug Heuristics

- When a third-party request library fails in WeChat DevTools with messages like `fetch is not a function`, `URL is not a constructor`, adapter detection failure, or `instanceof` right-hand-side errors, do not stop at `globalThis` injection. Check the final emitted `common.js` and page chunks under `apps/*/dist/**` first.
- Treat mini-program runtime compatibility as a final-bundle problem, not only a source-transform problem. `load` / `transform` can succeed while the final page wrapper still loses the injected code.
- If request globals are bundled into `common.js`, verify two separate requirements:
  - the runtime installer is actually executed in the final shared chunk
  - page/component chunks get local bindings for free variables such as `fetch`, `AbortController`, `XMLHttpRequest`, `URL`, `URLSearchParams`, `Blob`, and `FormData`
- Third-party libraries may probe environment support during module initialization, before later installer code runs. For shared chunks, prefer a two-phase strategy:
  - prepend safe placeholder bindings to avoid early `instanceof` / adapter-detection crashes
  - run the real installer and then replace those bindings with actual polyfills
- For request-globals work, inspect built output with targeted searches before changing more source:
  - `rg "__weappViteRequestGlobals" apps/<app>/dist`
  - `rg "var fetch =|var URL =|var XMLHttpRequest =" apps/<app>/dist/pages`
  - `rg "fetch is not a function|URL is not a constructor|instanceof" apps/<app>/dist/common.js`
- In DevTools e2e, distinguish infra failure from product failure:
  - websocket/bootstrap/login problems are infra
  - page snapshot errors like `fetch is not a function` mean the test already reached app code
- If DevTools e2e fails but unit tests pass, assume bundle-scope mismatch first. Inspect generated chunks before rewriting runtime code again.
- After touching `packages/weapp-vite/src/**`, always rebuild `weapp-vite` before validating apps or e2e. If downstream output looks stale or inconsistent, stale `dist` is the first suspect.
