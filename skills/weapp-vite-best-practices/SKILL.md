---
name: weapp-vite-best-practices
description: Production playbook for weapp-vite project architecture, `vite.config.ts` weapp options, `app.json` routes/subPackages, chunk strategy, and CI/DevTools automation. Use when users ask to create/refactor weapp-vite projects, configure auto routes/components, split subpackages, optimize chunk output, or debug build/output issues (e.g. "配置 weapp-vite", "分包策略", "构建输出异常", "typed-router.d.ts 生成问题").
---

# weapp-vite-best-practices

## Purpose

Build or refactor weapp-vite projects with stable defaults first, then optimize packaging and performance. Prioritize predictable output and reproducible CI.

## Trigger Signals

- User asks about `vite.config.ts` + `weapp` config design.
- User asks how to organize pages/components/subpackages in weapp-vite.
- User reports build output problems: missing pages/components, wrong output root, route generation mismatch, chunk duplication.
- User asks about CI automation with WeChat DevTools or `weapp-ide-cli`.
- User asks when to use `autoRoutes`, auto-imported components, or chunk shared strategy.

## Scope Boundary

Use this skill when the core issue is project-level architecture or build orchestration.

Do not use this as the primary skill when:

- The issue is mainly Vue SFC template/macro syntax. Use `weapp-vite-vue-sfc-best-practices`.
- The issue is mainly runtime lifecycle/state/store patterns. Use `wevu-best-practices`.
- The task is native mini-program to weapp-vite migration planning. Use `native-to-weapp-vite-wevu-migration`.

## Quick Start

1. Confirm baseline runtime and source roots.
2. Classify goal: new setup, refactor, debug, or performance optimization.
3. Apply minimum viable config changes in `vite.config.ts` and app/page JSON sources.
4. Verify with targeted build/type checks before suggesting broader cleanup.

## Execution Protocol

1. Gather context first

- Inspect `vite.config.ts`, `app.json` source strategy, pages/subpackages layout, and scripts.
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

3. Diagnose by symptom category

- Output missing/wrong path: verify `srcRoot`, route generation source, and glob coverage.
- Slow build: inspect plugin timing and high-cost transforms.
- Route/component generation mismatch: verify generated artifacts and resolver behavior.

4. Propose actionable edits

- Give concrete file-level changes with rationale and expected impact.
- Avoid broad config rewrites when a local fix can solve the issue.

5. Verify narrowly

- Prefer targeted checks, for example:

```bash
pnpm build:pkgs
pnpm vitest run <related-test-file>
```

- Only suggest full regression when change scope requires it.

## Guardrails

- Do not optimize chunk strategy before `srcRoot` and route generation are confirmed.
- Do not combine many advanced overrides in the first iteration.
- Do not assume web-only conventions; keep mini-program JSON semantics explicit.
- Do not mix architecture refactor with unrelated business logic changes.

## Output Contract

When applying this skill, return:

- A short diagnosis summary.
- A minimal change list with concrete file targets.
- Suggested verification commands (narrow first, then broad if needed).
- Tradeoff notes for subpackage/chunk choices.

## Completion Checklist

- `vite.config.ts` has a clear and minimal `weapp` section.
- `pages/subPackages` source-of-truth is explicit (manual or auto routes).
- Component registration strategy is deterministic (auto import + resolver policy).
- Subpackage/chunk strategy is selected with stated reason.
- Dev/CI workflow is reproducible and not dependent on manual IDE clicks.

## References

- `references/config-playbook.md`
- `references/debug-playbook.md`
