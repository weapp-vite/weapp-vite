## 2. Build and Verification

- Install with `pnpm install`.
- Prefer the smallest proof that covers the change: targeted `pnpm vitest run <files>`, owning-package `typecheck` / `test:types`, then scoped builds. Use `pnpm test` or repository E2E only when their wider coverage is required.
- Use `pnpm build:pkgs`, `pnpm build:apps`, and `pnpm build:templates` for their corresponding scopes. Follow [CONTRIBUTING.md](CONTRIBUTING.md#pr-%E9%AA%8C%E8%AF%81) for the quick/review/full verification contract and CI handoff.

### 2.1 Keep `dist` Current

- Downstream apps, templates, E2E fixtures, published entrypoints, and CLI checks consume package `dist`, not live `src`. After changing `packages/*/src/**` or `packages-runtime/*/src/**`, rebuild every touched package before downstream validation. Rebuild again after later source edits.
- For changes under `packages/weapp-vite/src/cli/**`, `packages/weapp-vite/src/mcp.ts`, or another dependency of `dist/cli.mjs`, run `pnpm --filter weapp-vite build` before any `apps/*`, `templates/*`, or `e2e-apps/*` command. Before the downstream command, report `dist sync: rebuilt weapp-vite before downstream validation`. Then assert the specific downstream behavior or expected output.
- If downstream behavior does not reflect a recent source edit, rebuild the owning package and rerun the check once before deeper diagnosis.

### 2.2 Cross-Platform Changes

- Treat an OS-only matrix failure as a platform compatibility issue first when touching workflows, `e2e/scripts/**`, process launchers, filesystem utilities, path normalization, or shared scripts. Report `cross-platform suspect: checking command launch, path normalization, line endings, and filesystem assumptions before product logic`.
- Find the earliest divergent layer in `workflow -> package.json script -> Node wrapper -> child process`. Check Windows command resolution and quoting, native path separators and case, CRLF, temp-directory assumptions, executable bits, and deletion semantics before changing product logic.
- Prefer Node/TypeScript orchestration and `execa` for shared launchers. A raw `spawn` implementation must explicitly handle Windows `.cmd`, built-ins, quoting, and the minimal required `shell` boundary. Shared scripts must not depend on POSIX-only `&&`, inline environment assignment, permissions, or path shapes.
- Normalize persisted paths and snapshot/report labels to repo-relative POSIX form. Add the narrowest regression for the platform-sensitive primitive, rebuild package artifacts when applicable, and rerun the smallest affected workflow or job.

### 2.3 Long-Running Work

- Store a compact continuation index under `.tmp/current-run/<task>/` with goal/scope, authorization and object, base/head/worktree, commands and exit results, evidence, and remaining work. On resume, read the index and re-read current remote identity/state.
- Treat follow-up messages as steering the active task unless the user clearly cancels or replaces it. Existing authorization remains valid only for the same object and scope.
- Reuse successful checks only while their source, inputs, environment, and required gates remain unchanged. New failures, source changes, or missed gates require the affected check again.
- Partition parallel work by files, resources, and evidence. Run dependency-sensitive mutations and shared resources serially. Assign one monitor per CI, release, or E2E run and share its complete snapshot instead of polling or rerunning from multiple agents. Poll at ordinary intervals of at least 60 seconds.
