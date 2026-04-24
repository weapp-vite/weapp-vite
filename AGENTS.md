# AGENTS Guidelines (Global Baseline)

This file defines repository-wide defaults for AI agents.
If a deeper directory contains its own `AGENTS.md`, apply that local file first, then fall back to this one.

## 1. Monorepo Routing

- Core bundler/compiler/runtime work:
  - `packages/weapp-vite`
  - `packages-runtime/wevu`
  - `packages-runtime/wevu-compiler`
  - `packages-runtime/weapi`
  - `packages-runtime/web`
  - `packages-runtime/web-apis`
  - related integration checks in `e2e/` and `e2e-apps/github-issues`
- Template/app parity work:
  - source app in `apps/*`
  - target template in `templates/*`
- Docs and site:
  - `website/`, `docs/`

Avoid cross-package edits unless the change is truly shared.

## 2. Fast-Path Commands (Prefer Smallest Verification First)

- Install once:
  - `pnpm install`
- Narrow builds:
  - `pnpm build:pkgs`
  - `pnpm build:apps`
  - `pnpm build:templates`
- Targeted tests:
  - `pnpm vitest run <single test file>`
  - `pnpm vitest run <fileA> <fileB>`
- Full regression (only when needed):
  - `pnpm test`
  - `pnpm e2e`

Do not default to full monorepo test runs when a targeted test can prove the change.

### 2.1 Dist Sync Guard (Prevent Stale CLI/Runtime)

- When editing `packages/*/src/**` or `packages-runtime/*/src/**`, assume downstream apps/templates/e2e consume built artifacts from `dist` (not live `src`).
- Do not assume `pnpm test`, `pnpm e2e:ci`, or `pnpm --filter <app> build/dev` will pick up fresh `src` changes automatically; if validation goes through a published package entry, CLI entry, or downstream app/template/e2e project, rebuild the touched package first so `dist` is up to date.
- Before validating through `apps/*`, `templates/*`, or `e2e-apps/*`, rebuild each touched package first:
  - `pnpm --filter <package-name> build`
- If the same work session changes `packages/*/src/**` or `packages-runtime/*/src/**` again, rebuild again before the next downstream validation; do not reuse older `dist` from an earlier pass.
- For `weapp-vite` CLI changes specifically (`packages/weapp-vite/src/cli/**`, `packages/weapp-vite/src/mcp.ts`, or other CLI entry dependencies), always run:
  - `pnpm --filter weapp-vite build`
  - then run app-level checks such as `pnpm --filter <app> dev` / `build` / `open` / `run mcp:*`
- If a verification result does not reflect recent source edits, treat stale `dist` as the first suspect and rebuild before deeper debugging.

### 2.2 Standard Execution Template (Required for CLI-linked App Validation)

- Trigger condition:
  - any changes under `packages/weapp-vite/src/cli/**`
  - any changes that can affect `packages/weapp-vite/dist/cli.mjs` runtime behavior
  - then validate via `apps/*`, `templates/*`, or `e2e-apps/*`
- Required command sequence (minimal form):
  1. `pnpm --filter weapp-vite build`
  2. `pnpm --filter <target-app> <dev|build|open|run mcp:*>`
  3. targeted assertion command (for example `rg`, `test`, or output-file existence check)
- Required assistant status line before step 2:
  - `dist sync: rebuilt weapp-vite before downstream validation`
- If step 1 was skipped by mistake:
  - stop current diagnosis
  - rebuild `weapp-vite`
  - rerun downstream validation once
  - only then continue root-cause analysis

### 2.3 Cross-Platform CI/CD Guard (Required for Windows/macOS/Linux-sensitive changes)

- Trigger condition:
  - any changes under `e2e/scripts/**`, workflow files, CLI/process-launch code, filesystem utilities, or path-normalization logic
  - any failure pattern where Linux/macOS pass but Windows fails, or only one OS fails within the same matrix
- Treat a matrix split by OS as a platform compatibility bug first, not a product-feature regression first.
- Before editing, identify whether the failure happens:
  - before tests start
  - during process launch / command resolution
  - during filesystem/path assertions
  - only after runtime behavior diverges
- For process execution code:
  - prefer `execa` or an equivalent cross-platform wrapper unless there is a clear reason to use raw `spawn`
  - if using `spawn` directly, explicitly evaluate Windows command resolution (`.cmd`, shell built-ins, quoting) and set `shell` only when needed
  - never assume `pnpm`, `npm`, `git`, or other CLI commands resolve the same way on Windows as on Unix runners
- For paths and files:
  - normalize path separators in any persisted snapshot, report, matcher, or emitted label that can be consumed across OSes
  - do not assume case-sensitive filesystems; double-check import path casing and fixture filenames
  - avoid assertions that depend on native path separators, drive-letter shape, or platform-specific temp directories
  - prefer repo-relative or normalized POSIX-style paths in logs, reports, and snapshot-like output
- For shell behavior:
  - avoid relying on `&&`, `;`, inline env assignment, `ulimit`, or other shell-specific syntax in shared scripts unless the workflow step is explicitly OS-scoped
  - prefer Node/TypeScript orchestration over shell glue when the same logic must run on all runners
- For files generated in tests or CI:
  - account for CRLF vs LF when parsing multiline output
  - avoid depending on executable bit semantics or POSIX-only permissions
  - ensure temp-file cleanup and lockfile handling do not assume Unix deletion semantics
- Required diagnosis sequence for cross-platform CI failures:
  1. compare the failing OS against one passing OS in the same workflow and find the earliest divergent step
  2. inspect the exact launcher layer first (`workflow -> package.json script -> Node wrapper -> child process`)
  3. reduce the issue to the smallest platform-sensitive primitive before changing business logic
  4. add a focused regression test that locks the platform assumption when practical
- Preferred verification for platform-sensitive fixes:
  - run the narrowest local unit/integration test that covers the platform branch
  - if the fix touches downstream CLI/runtime artifacts, rebuild the touched package before validation
  - when the original failure came from GitHub Actions, rerun the smallest affected workflow or job after the fix instead of waiting for unrelated matrix jobs
- Required assistant note in analysis when diagnosing an OS-only failure:
  - `cross-platform suspect: checking command launch, path normalization, line endings, and filesystem assumptions before product logic`

## 3. Coding Rules

- TypeScript + ESM + 2-space indentation.
- 所有场景都不要使用 Prettier 做格式化；代码与文档格式修正统一走 ESLint（包含 `eslint --fix` 与仓库现有 lint-staged / husky 流程）。
- Package names: kebab-case.
- Variables/files: camelCase.
- Classes/types: PascalCase.
- Prefer named exports unless a file intentionally owns a single default export.
- 跨包共享、会进入最终运行时代码、或需要在多个包/测试之间保持稳定值的 runtime marker / key / helper-name 常量，优先收敛到 `@weapp-core/constants`；不要把这类常量继续散落在 `packages/weapp-vite` 的单文件内部。
- Prefer root-cause fixes over symptom patches. If a regression is caused by ownership confusion between watcher layers, invalidation paths, or build stages, restore a single clear source of truth instead of stacking another fallback on top.
- Take a long-term engineering approach: avoid “just make this case pass” changes that increase duplicate triggers, hidden coupling, or architectural debt. Prefer solutions that simplify the steady-state model and reduce future debugging cost.
- Final build outputs under `dist`, mini-program output directories, and plugin output directories must come from Vite/Rolldown native emit/write; do not generate them by directly calling `writeFile` for dev/HMR fallback, sync, patch-up, or cleanup.
- If an approach only works by manually writing bundle files back to disk, treat it as an architectural violation; prefer fixing entry invalidation, watchers, plugin emit behavior, or bundler write-stage integration so the bundler still owns persistence.
- Keep eslint/stylelint clean and avoid introducing TypeScript errors.
- Always fix stylelint issues in standalone style files and in `<style>` blocks inside `.vue` files (including generated style outputs).
- JSDoc comments must be in Chinese.
- If a source file exceeds 300 lines, evaluate splitting and document the decision in PR notes.
- When splitting, prefer directory layout:
  - `foo/index.ts`
  - `foo/style.ts`
  - `foo/helpers.ts`
  - avoid `foo.style.ts` / `foo.helpers.ts`.

## 4. Test and E2E Requirements

- Co-locate tests with source and use `*.test.ts` or `*.spec.ts`.
- Update snapshots/assertions together with behavior changes.
- Global E2E serialization is mandatory:
  - Treat every repository-level E2E entry command as mutually exclusive, including `pnpm e2e:ci`, `pnpm e2e`, `pnpm e2e:ide`, `pnpm e2e:ide:full`, other `pnpm e2e:*` variants, and direct `vitest` invocations that target `e2e/**`.
  - Never run more than one of the above commands at the same time in the same workspace or on the same machine/user session.
  - `pnpm e2e:ci` must not overlap with any `pnpm e2e:ide*`, `pnpm e2e`, other `pnpm e2e:*`, or other long-lived E2E/dev-watch commands.
  - `pnpm e2e:ide` / `pnpm e2e:ide:full` must not overlap with `pnpm e2e:ci`, other DevTools E2E commands, or any other command that may start DevTools, automator bridges, dev servers, file watchers, or local verification servers for E2E.
  - Before starting any E2E command, first check for active residual E2E/dev-watch processes and stop them; if an E2E command is already running, wait for it to finish or terminate it intentionally before launching another one.
  - When diagnosing flaky HMR, dev-watch, DevTools, or automator failures, treat concurrent or residual E2E processes as the first suspect and eliminate concurrency before changing product code or test assertions.
- For package-level TypeScript work (`packages/*`, `packages-runtime/*`, `mpcore/packages/*`), verify the owning package first with the smallest package-scoped command:
  - `pnpm --filter <package> typecheck`
  - if the package ships public types or reusable type helpers, also run `pnpm --filter <package> test:types` when available
- When a TypeScript regression is fixed in public exports, reusable helpers, config builders, runtime contracts, or other consumer-visible types, add or update `tsd` coverage in that package during the same change. Do not rely on source-only fixes without a type-contract regression test.
- When reading JSON in tests or scripts under strict TS settings, treat `fs.readJSON()` and similar helpers as `unknown` by default. Narrow with a local typed helper or explicit cast at the boundary before property access; do not spread unchecked `unknown` through the test body.
- When a broad root-level typecheck reports many errors, separate library/package failures from app/template/generated-output noise before editing. Prefer package-scoped diagnosis and verification over trying to make every auxiliary tsconfig participate in one giant build.
- When fixing tests, do not hardcode repository-bound or machine-bound values into source files, fixtures, or assertions.
- Forbidden examples include:
  - absolute filesystem paths
  - project-root-specific directories or local temp/report output directories
  - usernames, home-directory paths, local workspace names, PID values, machine-specific ports, or one-off debug artifact paths
  - CI/local generated report paths such as `docs/reports/**` unless the feature is explicitly about those outputs
- Prefer repo-relative paths, temporary directories created inside the test at runtime, stable helper abstractions, and assertions that do not depend on local machine layout.
- 对构建产物、bundle、shared chunk、runtime wrapper 的字符串断言，不要依赖打包器生成的局部 helper 名、临时变量名、chunk 内部导入别名或其 hash 后缀。
- 禁止示例包括：`require_store_fwgCLl_K`、`require_src__P44BAOw`、`createContext-BDSht839`、`_sfc_main$1`、`n`、`e` 这类可能因编译、压缩、拆包顺序变化而漂移的名字。
- 这类断言应优先改为稳定语义校验：
  - 匹配公开导出名、稳定 marker、相对路径、字面量值、对象结构、调用语义
  - 需要正则时，匹配结构和相邻语义，不要把“随机 helper 名本身”作为通过条件
- 如果必须覆盖一段编译产物结构，先证明该名字是显式稳定契约；否则默认视为不稳定实现细节。
- Scope clarification:
  - This restriction primarily targets production/source code, shared fixtures, snapshots, and general-purpose assertions introduced while fixing tests.
  - Ordinary test-only temporary paths created at runtime in `*.test.ts` / `*.spec.ts` are allowed when they are isolated, machine-agnostic, and not asserted as machine-specific values.
  - E2E reporting/diagnostic infrastructure under `e2e/**` may reference stable repo-owned report directories such as `docs/reports/**` when that path is part of the feature being implemented or validated.
  - Platform-behavior fixtures in tests may use representative absolute paths when the test is explicitly verifying path normalization, symlink resolution, temp-directory behavior, or cross-platform filesystem semantics.
- For `mpcore/packages/simulator` specifically:
  - Treat test coverage as three layers that must stay in sync for behavior changes:
    - unit/integration tests in `mpcore/packages/simulator/test/**`
    - browser e2e tests in `mpcore/packages/simulator/e2e/**`
    - type contract tests in `mpcore/packages/simulator/test-d/**`
  - When changing exported types, public APIs, browser runtime behavior, testing bridge behavior, or simulator-observable runtime state, add or update all relevant layers instead of only one layer.
  - Prefer adding the narrowest realistic browser e2e that exercises the public demo/debug bridge instead of duplicating low-level unit assertions.
  - Keep browser e2e assertions stable: prefer scenario ids, route values, bridge-returned snapshots, and explicit scope ids over brittle visual selectors.
  - Keep `mpcore/packages/simulator/package.json` scripts working together:
    - `pnpm test`
    - `pnpm test:e2e`
    - `pnpm test:types`
    - `pnpm test:all`
- For WeChat DevTools runtime e2e environment selection:
  - Treat `pnpm e2e:ide*`, `pnpm vitest run -c e2e/vitest.e2e.devtools.config.ts ...`, and any validation that depends on WeChat DevTools, automator bridge, or local port listeners as sandbox-sensitive by default.
  - Prefer running these validations outside the sandbox first when possible.
  - If sandbox execution fails with signals such as `listen EPERM`, `operation not permitted`, local HTTP server bind failures on `127.0.0.1`, or DevTools bridge connection failures, classify that as an environment limitation first rather than a product regression first.
- For WeChat DevTools runtime e2e in `e2e/ide/**`:
  - For the same `e2e-app`, launch automator only once per test suite (`describe`) and reuse that session.
  - Validate multiple cases by `miniProgram.reLaunch(...)` across different pages/routes instead of re-launching DevTools for each case.
  - If a case must use an isolated launch, document the reason in test comments.
  - When a real-runtime suite proves that:
    - the local verification server starts successfully
    - native `fetch` cases pass
    - but third-party request clients such as `axios` or `graphql-request` fail with the same `URL is not a constructor` or similar `URL` / `URLSearchParams` constructor error
      then treat it as a WeChat DevTools runtime compatibility defect first, not an app/business regression first.
  - For the above platform defect pattern:
    - minimize the reproduction first
    - record the limitation in a GitHub issue
    - explicitly `skip` the affected DevTools runtime cases
    - keep unaffected native-request coverage such as `fetch` enabled so IDE e2e still provides meaningful regression signal
    - do not block the whole IDE suite on that known DevTools runtime defect
  - After running DevTools e2e, inspect the worktree for generated noise before commit:
    - pure newline-only rewrites in `project.config.json`
    - generated `docs/reports/**`
    - other DevTools-touched files unrelated to the task
      Clean these before staging so the commit contains only intentional source/test changes.
- For GitHub issue fixes (especially cases mapped to `e2e-apps/github-issues`), follow this order strictly:
  - Before starting the fix, create a local `git worktree` from the mainline branch and do the issue work inside that isolated worktree.
  - Create the worktree inside this repository's writable area (for example `.codex-tmp/<issue>`); do not place issue worktrees in directories outside the repository root, because external directories may not be writable in the agent environment.
  - Reproduce the issue first in `e2e-apps/github-issues` with a minimal, reviewable case.
  - Analyze and identify root cause before editing source.
  - Fix the relevant source package(s) only after reproduction is stable.
  - Add or update unit tests to lock the root-cause behavior.
  - Add or update e2e tests (including the `e2e-apps/github-issues` case when applicable) to verify end-to-end regression coverage.
  - Run targeted unit + e2e verification and confirm the bug is fixed before opening review.
  - Open a PR back to the mainline branch after local verification is complete.
- PR title, PR body, and follow-up review comments for this repository should default to Chinese unless the user explicitly requests another language.
- PR title, PR body, and follow-up review comments must not contain local absolute filesystem paths, usernames, home-directory paths, machine-specific environment variable values, tokens, email addresses, or any other personal/privacy-sensitive information. When referencing commands or files in PR text, rewrite them as repo-relative paths or generic commands that are reproducible in CI.
- When an assistant posts or edits any GitHub-facing text for this repository, treat privacy-safe wording as mandatory:
  - never paste local absolute paths such as `/Users/...`, `/home/...`, `C:\\Users\\...`
  - never include local usernames, workspace directory names, or machine-specific temp/cache paths
  - when showing verification commands, rewrite them with repo-relative paths or generic commands that another maintainer can run in CI/local without depending on your machine layout
- Ensure the PR CI/CD checks are all passing before considering the fix ready to merge.
- After the PR is merged, delete the temporary local worktree used for that issue.
- All `e2e-apps/*/project.config.json` must use a real AppID (no `touristappid`).
- When adding pages in any `e2e-apps/*`, also update `project.private.config.json` under `condition.miniprogram.list`.

## 5. Commit and Changeset Rules

- Use Conventional Commits, e.g.:
  - `feat(weapp-vite): add css preprocess support`
- Before every commit, run the smallest lint checks that match the staged changes, not just build/test checks.
- Never use Prettier in this repository, including ad-hoc formatting, editor save hooks, scripts, or pre-commit steps; use the smallest applicable ESLint-based fix command instead.
- `lint-staged` and `.husky/pre-commit` are mandatory enforcement layers, not optional convenience tooling; when adjusting lint scope, keep both aligned so staged files fail locally before CI, including in `git worktree` directories.
- Run needed local checks before review (`build`, `test`, `lint` scope depends on touched area).
- Before pushing or opening a PR, run the smallest package- or path-scoped `lint` / `test` / `build` checks that cover the changed area; do not rely on `pre-commit` as a substitute for review-time verification.
- Add a changeset only for user-visible or behavior-impacting changes, such as `feat`, functional `fix`, or other changes that alter runtime/build behavior, public APIs, generated outputs, or template/app observable results.
- Do not add a changeset for changes that are purely tests, docs, comments, refactors, internal tooling, or other non-user-visible maintenance work, unless they also include a user-visible or behavior-impacting change.
- For source code bug fixes that change real behavior (including GitHub issue fixes with unit/e2e updates), adding a changeset is mandatory; do not skip it.
- If release includes `weapp-vite`, `wevu`, or anything under `templates/`, also include a `create-weapp-vite` bump changeset.
- `.changeset/*.md` summary paragraph must be in Chinese.
- Default delivery action is commit-only: after checks pass, commit the changes directly, and do not push unless the user explicitly requests push.
- Exception for GitHub bug-fix workflow: when the task is a GitHub issue fix, complete the work through a PR to the mainline branch and treat post-merge worktree cleanup as part of the task.

## 6. Security and Environment

- Node.js 20+ with compatible pnpm.
- For `weapp-ide-cli` operations (`open`, `preview`, `upload`), ensure WeChat DevTools service port is enabled.
- Never commit secrets; use `.env.local` or environment variables.
- 对小程序运行时代码、会进入小程序产物的兼容层代码、以及依赖微信/支付宝/抖音等宿主执行的 bundle 代码，一律不要依赖 `eval`、`new Function`、`Function("return this")()`、字符串定时代码，或任何需要动态求值的能力。
- 处理小程序运行时全局对象兼容时，优先使用静态宿主解析、显式别名同步、编译期注入和可测试的直接引用；不要把“动态执行可用”当作默认前提。

### 6.1 VS Code Workspace Hygiene

- 根目录 `.vscode/settings.json` 是本仓库的 IDE 性能基线之一；不要随意删除或放宽 `files.exclude`、`files.watcherExclude`、`search.exclude`、`tailwindCSS.files.exclude`、`i18n-ally.usage.scanningIgnore` 中针对大体积生成物和缓存目录的排除规则。
- 当前需要保持排除一致的高噪音目录至少包括：
  - `.cache`
  - `.codex-tmp`
  - `.minidev`
  - `.playwright`
  - `.playwright-cli`
  - `.pnpm-store`
  - `.tmp`
  - `.turbo`
  - `.weapp-vite`
  - `.wevu-config`
  - `dist`
  - `coverage`
  - `docs/reports`
  - `node_modules`（至少对 watcher/search 保持排除）
- 当仓库新增新的缓存目录、临时目录、生成目录或报告目录时，同步更新上述 VS Code 排除项，避免 IDE/扩展通过 `rg --files`、隐藏文件扫描或跟随符号链接把整个仓库打满 CPU。
- `search.followSymlinks` 默认保持为 `false`；除非任务明确需要跨符号链接搜索，否则不要改回跟随模式。
- 如果出现 VS Code 或系统整体卡顿，先检查工作区排除规则是否漂移，再怀疑语言服务、扩展或业务代码本身。

## 7. Project Skills (Codex + Claude Code)

- This repo ships user-facing skills under `skills/*`:
  - `weapp-vite-best-practices`
  - `docs-and-website-sync`
  - `release-and-changeset-best-practices`
  - `weapp-devtools-e2e-best-practices`
  - `weapp-vite-vue-sfc-best-practices`
  - `wevu-best-practices`
  - `native-to-weapp-vite-wevu-migration`
- Recommended remote install source for all public skills is `sonofmagic/skills`:
  - `npx skills add sonofmagic/skills`
- This repo may also include project-specific Claude skills under `.claude/skills/*` (for example `playwright-cli`).
- `pnpm skills:link` will sync both `skills/*` and `.claude/skills/*` into local Codex/Claude skill directories.
- Internal maintainer skills are under `maintainers/skills/*`; do not expose them in user guidance.
- For local development and direct use of this repository's latest skills in both Codex and Claude Code, run:
  - `pnpm skills:link`
- If you only need to preview linking behavior without changing local env, run:
  - `pnpm skills:link:dry`
