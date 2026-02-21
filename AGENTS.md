# AGENTS Guidelines (Global Baseline)

This file defines repository-wide defaults for AI agents.
If a deeper directory contains its own `AGENTS.md`, apply that local file first, then fall back to this one.

## 1. Monorepo Routing

- Core bundler/compiler/runtime work:
  - `packages/weapp-vite`
  - `packages/wevu`
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

## 3. Coding Rules

- TypeScript + ESM + 2-space indentation.
- Package names: kebab-case.
- Variables/files: camelCase.
- Classes/types: PascalCase.
- Prefer named exports unless a file intentionally owns a single default export.
- Keep eslint/stylelint clean and avoid introducing TypeScript errors.
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
- All `e2e-apps/*/project.config.json` must use a real AppID (no `touristappid`).
- When adding pages in any `e2e-apps/*`, also update `project.private.config.json` under `condition.miniprogram.list`.

## 5. Commit and Changeset Rules

- Use Conventional Commits, e.g.:
  - `feat(weapp-vite): add css preprocess support`
- Run needed local checks before review (`build`, `test`, `lint` scope depends on touched area).
- Add a changeset for user-visible or behavior-impacting changes.
- If release includes `weapp-vite`, `wevu`, or anything under `templates/`, also include a `create-weapp-vite` bump changeset.
- `.changeset/*.md` summary paragraph must be in Chinese.

## 6. Security and Environment

- Node.js 20+ with compatible pnpm.
- For `weapp-ide-cli` operations (`open`, `preview`, `upload`), ensure WeChat DevTools service port is enabled.
- Never commit secrets; use `.env.local` or environment variables.

## 7. Project Skills (Codex + Claude Code)

- This repo ships user-facing skills under `skills/*`:
  - `weapp-vite-best-practices`
  - `weapp-vite-vue-sfc-best-practices`
  - `wevu-best-practices`
- This repo may also include project-specific Claude skills under `.claude/skills/*` (for example `playwright-cli`).
- `pnpm skills:link` will sync both `skills/*` and `.claude/skills/*` into local Codex/Claude skill directories.
- Internal maintainer skills are under `maintainers/skills/*`; do not expose them in user guidance.
- For local direct use in both Codex and Claude Code, run:
  - `pnpm skills:link`
- If you only need to preview linking behavior without changing local env, run:
  - `pnpm skills:link:dry`
