## 2. Fast Test Matrix

- If touching Vue transform output semantics (`compileVueFile`, class/style runtime, props fallback):
  - `pnpm vitest run packages/weapp-vite/src/plugins/vue/transform/compileVueFile.test.ts packages/weapp-vite/test/vue/class-style-runtime.test.ts packages/weapp-vite/test/vue/sfc-integration.test.ts`
- If touching issue #300 related behavior:
  - `pnpm vitest run -c ./e2e/vitest.e2e.devtools.config.ts e2e/ide/github-issues.runtime.test.ts -t "issue #300"`
  - `pnpm vitest run -c ./e2e/vitest.e2e.ci.config.ts e2e/ci/github-issues.build.test.ts -t "issue #300"`
- For broader package regression:
  - `pnpm vitest run packages/weapp-vite/test`

Run full monorepo `pnpm test` only when cross-package impact is likely or explicitly requested.
