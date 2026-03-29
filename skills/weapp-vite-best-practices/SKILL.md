---
name: weapp-vite-best-practices
description: 面向采用 weapp-vite 项目布局仓库或已安装 `weapp-vite` 依赖项目的工程化实践手册，覆盖 `vite.config.ts` 的 `weapp` 配置、`app.json` routes/subPackages、`routeRules/layout`、自动路由、自动导入组件、托管 TypeScript 支持文件、`prepare`、`wv`/`weapp-vite` CLI 用法、`dist/docs` 随包文档、脚手架生成项目里的 `AGENTS.md`、MCP、Web runtime、lib mode 以及 CI/DevTools 自动化。适用于创建或重构 weapp-vite 项目、配置 `autoRoutes/autoImportComponents/routeRules`、拆分分包、优化 chunk 输出，或排查构建与输出问题（如“配置 weapp-vite”“分包策略”“构建输出异常”“typed-router.d.ts 生成问题”“layout 不生效”“`.weapp-vite` 文件怎么接入”“其他仓库里的 AI 怎么正确使用 weapp-vite”）。
---

# weapp-vite-best-practices

## 目的

Build or refactor weapp-vite projects with stable defaults first, then optimize packaging and performance. Prioritize predictable output and reproducible CI.

## 触发信号

- User asks about `vite.config.ts` + `weapp` config design.
- User asks how to organize pages/components/subpackages in weapp-vite.
- User reports build output problems: missing pages/components, wrong output root, route generation mismatch, chunk duplication.
- User asks about CI automation with WeChat DevTools or `weapp-ide-cli`.
- User asks how `weapp-vite` CLI and `weapp-ide-cli` should split command ownership / passthrough.
- User asks when to use `autoRoutes`, auto-imported components, or chunk shared strategy.

## 适用边界

Use this skill when the core issue is project-level architecture or build orchestration.

Do not use this as the primary skill when:

- The issue is mainly Vue SFC template/macro syntax. Use `weapp-vite-vue-sfc-best-practices`.
- The issue is mainly runtime lifecycle/state/store patterns. Use `wevu-best-practices`.
- The task is native mini-program to weapp-vite migration planning. Use `native-to-weapp-vite-wevu-migration`.

## 快速开始

1. Confirm baseline runtime and source roots.
2. Classify goal: new setup, refactor, debug, or performance optimization.
3. Read local package docs first when available: `node_modules/weapp-vite/dist/docs/index.md`.
4. Apply minimum viable config changes in `vite.config.ts` and app/page JSON sources.
5. Verify with targeted build/type checks before suggesting broader cleanup.
6. If validation touches apps/templates/e2e after editing `packages/*/src/**`, rebuild the touched package first to avoid stale `dist`.

## 执行流程

1. Gather context first

- Inspect `vite.config.ts`, `app.json` source strategy, pages/subpackages layout, and scripts.
- If the project installs `weapp-vite`, prefer local package docs under `node_modules/weapp-vite/dist/docs/` before relying on stale web examples.
- Confirm `weapp.srcRoot` and expected output root.
- Ask for missing constraints only when blocked (target platform, package limits, CI environment).

2. Build a minimal strategy

- Keep config layering explicit: generic Vite config vs mini-program-specific `weapp` section.
- Prefer convention-first setup (`autoRoutes`, auto components) and add overrides only when required.
- Choose subpackage mode intentionally:
  - `normal subpackage` for shared context.
  - `independent subpackage` only when strict isolation is necessary.
- Choose `weapp.chunks.sharedStrategy` by explicit goal:
  - `duplicate` for better subpackage first-open performance.
  - `hoist` for stronger deduplication and package-size control.
- When handling CLI orchestration between `weapp-vite` and `weapp-ide-cli`, keep a single source-of-truth command catalog:
  - Define and export full top-level command names in `weapp-ide-cli`.
  - Let `weapp-vite` consume that export for passthrough decision.
  - Resolve commands in this order: `weapp-vite` native commands first, then `weapp-ide-cli` passthrough only if command is cataloged.
- Treat `wv` as an alias of `weapp-vite` in all command guidance.
- When the project comes from `create-weapp-vite`, treat root `AGENTS.md` as a project-level workflow contract, not disposable boilerplate.

3. Diagnose by symptom category

- Output missing/wrong path: verify `srcRoot`, route generation source, and glob coverage.
- Slow build: inspect plugin timing and high-cost transforms.
- Route/component generation mismatch: verify generated artifacts and resolver behavior.
- If downstream app/template/e2e behavior does not match recent source edits, suspect stale `dist` first and rebuild the touched package before deeper diagnosis.
- If an AI workflow involves screenshot acceptance or DevTools log collection, prefer `weapp-vite screenshot` / `wv screenshot` and `weapp-vite ide logs --open` / `wv ide logs --open`.

4. Propose actionable edits

- Give concrete file-level changes with rationale and expected impact.
- Avoid broad config rewrites when a local fix can solve the issue.

5. Verify narrowly

- When edits touch `packages/*/src/**` and validation goes through `apps/*`, `templates/*`, or `e2e-apps/*`, rebuild the touched package first.
- For `weapp-vite` CLI-linked validation, use this order:
  1. `pnpm --filter weapp-vite build`
  2. downstream app/template/e2e command
  3. targeted assertion command
- Before step 2, state: `dist sync: rebuilt weapp-vite before downstream validation`
- Prefer targeted checks, for example:

```bash
pnpm build:pkgs
pnpm vitest run <related-test-file>
```

- Only suggest full regression when change scope requires it.

## 约束

- Do not optimize chunk strategy before `srcRoot` and route generation are confirmed.
- Do not combine many advanced overrides in the first iteration.
- Do not assume web-only conventions; keep mini-program JSON semantics explicit.
- Do not mix architecture refactor with unrelated business logic changes.
- Do not trust downstream app/template/e2e validation against stale package `dist`.
- Do not implement IDE command passthrough with hardcoded duplicate lists in multiple packages.
- Do not passthrough unknown commands blindly; require catalog hit before delegation.
- Do not ignore packaged docs and generated `AGENTS.md` when they exist; they are part of the current product contract.

## 输出要求

When applying this skill, return:

- A short diagnosis summary.
- A minimal change list with concrete file targets.
- Suggested verification commands (narrow first, then broad if needed).
- Tradeoff notes for subpackage/chunk choices.

## 完成检查

- `vite.config.ts` has a clear and minimal `weapp` section.
- `pages/subPackages` source-of-truth is explicit (manual or auto routes).
- Component registration strategy is deterministic (auto import + resolver policy).
- Subpackage/chunk strategy is selected with stated reason.
- Dev/CI workflow is reproducible and not dependent on manual IDE clicks.
- Downstream validation is performed against rebuilt package output, not stale `dist`.
- CLI dispatch ownership is deterministic: native-first, catalog-based passthrough second.
- Command catalog changes are made in `weapp-ide-cli` and consumed by `weapp-vite`, not duplicated.
- AI-facing entry points (`dist/docs`, root `AGENTS.md`, screenshot/logs commands) stay aligned with current CLI behavior.

## 参考资料

- `references/config-playbook.md`
- `references/debug-playbook.md`
- `references/cli-dispatch-playbook.md`
