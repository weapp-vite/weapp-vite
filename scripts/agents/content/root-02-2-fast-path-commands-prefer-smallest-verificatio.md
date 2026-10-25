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

### 2.4 任务续行与验证效率

- 长任务在本任务的 `.tmp/current-run/<task>/` 保存简短状态索引：目标与范围、用户授权及适用对象、base/head、工作树、验证命令与退出结果、证据位置和待办。续行先读索引，再回读远端身份；不要把历史快照当成当前状态。
- 用户的新消息通常是在补充当前任务；保留尚未完成的目标及已接受的范围调整，只有用户明确取消或替换时才停止原任务。已有授权在原对象和范围内继续有效，不因上下文压缩重复请求。
- 先选择能覆盖变更的最小验证。源码、相关输入或环境改变、出现新失败证据或发现漏跑既定门禁时再补跑；已经通过且未受影响的检查复用原证据。用户要求的完整验收及既定 CI 门禁仍须完成。
- 并行任务先划分文件、验证资源和证据目录；独立搜索与读取批量执行，依赖操作和共享资源变更串行。委派只读日志分析或独立审计时，明确禁止重复启动已有测试、发布或清理资源。
- 同一 CI 或发布运行只指定一个监控者，完整分页读取 jobs/checks 并共享状态索引；其他代理使用共享快照。普通轮询至少间隔 60 秒，状态不变时适当降低频率；新失败立即分析，避免多个代理同时轮询或重跑。
- 进度说明聚焦阶段变化、新证据、失败及下一项完成条件。长阶段未变化时简短说明仍在执行的阶段，不重复播报旧比例，也不把运行时长本身当成卡死或成功的证据；必要时对照同类历史运行耗时。
