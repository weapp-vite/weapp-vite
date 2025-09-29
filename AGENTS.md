# Repository Guidelines

## Project Structure & Module Organization
Monorepo managed by pnpm/turbo. Core packages live under `packages/` (`weapp-vite`, `weapp-ide-cli`, `plugin-vue`, `rolldown-require`, `vite-plugin-performance`, `@weapp-core/*`). Example apps reside in `apps/`, documentation in `website/`, e2e tests and Vitest config in `e2e/`, and maintenance scripts in `scripts/`. Keep new source near existing modules and colocate unit tests with the code when practical.

## Build, Test, and Development Commands
Run `pnpm dev` to launch package dev tasks in watch mode. Use `pnpm build` for a full package build, or scope with `pnpm build:pkgs`, `pnpm build:apps`, and `pnpm build:docs`. Execute `pnpm test` for Vitest unit tests with coverage, and `pnpm e2e` for the end-to-end suite. `pnpm lint` runs repository-wide lint checks before committing.

## Coding Style & Naming Conventions
Write TypeScript using ESM modules and 2-space indentation. Packages use kebab-case names, functions and variables use camelCase, and classes use PascalCase. Rely on `eslint` (`@icebreakers/eslint-config`), `stylelint`, `prettier`, `lint-staged`, and `husky` to enforce formatting. Keep comments focused on clarifying non-obvious logic.

## Testing Guidelines
Use Vitest with `@vitest/coverage-v8`. Name unit tests `*.test.ts` or `*.spec.ts`, colocated with source or placed in `tests/`. E2E specs belong in `e2e/` and run via `pnpm e2e`. Aim to maintain green coverage in CI and update snapshots when behavior changes intentionally.

## Commit & Pull Request Guidelines
Follow Conventional Commits, e.g. `feat(weapp-vite): add css preprocess support` or `fix(weapp-ide-cli): handle preview path on Windows`. PRs should explain purpose, affected packages, linked issues, and include before/after context or screenshots for IDE or UI updates. Ensure `pnpm build`, `pnpm test`, and `pnpm lint` pass before requesting review.

## Security & Configuration Tips
When using `weapp-ide-cli`, enable the "服务端口" setting in the WeChat Developer Tools before running `weapp open/preview/upload`. Never commit AppIDs or secrets; prefer environment variables ignored by VCS. Verify Node ≥ 20 and pnpm installed to match the enforced toolchain.
