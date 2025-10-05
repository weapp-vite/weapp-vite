# Repository Guidelines

## Project Structure & Module Organization
This Turbo + pnpm monorepo keeps core packages in `packages/` (e.g. `weapp-vite`, `weapp-ide-cli`, `plugin-vue`, scoped `@weapp-core/*`). Example apps live in `apps/`, shared docs in `website/`, end-to-end harnesses in `e2e/`, and automation utilities under `scripts/`. Add new code beside related modules, include feature assets locally, and place unit specs next to their sources using `*.test.ts` or `*.spec.ts`.

## Build, Test, and Development Commands
- `pnpm install` – prepare workspace with hoisted dependencies.
- `pnpm dev` – launch package watchers for fast iteration during local development.
- `pnpm build` – run the full build; narrow scope with `pnpm build:pkgs`, `pnpm build:apps`, or `pnpm build:docs`.
- `pnpm test` – execute the Vitest suite; add `--coverage` to align with CI thresholds.
- `pnpm e2e` – drive the E2E harness against example applications.
- `pnpm lint` – apply eslint, stylelint, and Prettier checks; use `--fix` for safe formatting updates.

## Coding Style & Naming Conventions
Use TypeScript with ESM syntax and 2-space indenting. Keep package names kebab-case, files and variables camelCase, and classes PascalCase. Prefer named exports unless the file owns a single responsibility. Formatting and static analysis run through `@icebreakers/eslint-config`, Prettier, lint-staged, and husky; run `pnpm lint --fix` before committing to avoid CI noise.

## Testing Guidelines
Vitest with `@vitest/coverage-v8` powers unit coverage. Co-locate tests with source, and protect behavioural shifts with snapshots when appropriate. Use `pnpm test --coverage` for CI parity. Place E2E specs inside `e2e/` and run them via `pnpm e2e` after relevant feature work.

## Commit & Pull Request Guidelines
Follow Conventional Commits (e.g. `feat(weapp-vite): add css preprocess support`) and bundle related work per commit. Ensure `pnpm build`, `pnpm test`, and `pnpm lint` pass locally. Pull requests should outline scope, affected packages, linked issues, and include before/after proof for IDE or UI tweaks plus manual validation notes.

## Security & Configuration Tips
Target Node.js 20+ with a compatible pnpm release. When using `weapp-ide-cli`, enable the WeChat Developer Tools “服务端口” before running `weapp open`, `preview`, or `upload`. Store AppIDs, tokens, and secrets in `.env.local` or environment variables—never commit them.
