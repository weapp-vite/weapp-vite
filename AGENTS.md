# Repository Guidelines

## Project Structure & Module Organization
This monorepo is managed by pnpm and Turbo, with core packages in `packages/` such as `weapp-vite`, `weapp-ide-cli`, `plugin-vue`, `rolldown-require`, `vite-plugin-performance`, and scoped modules under `@weapp-core/*`. Example and integration apps live in `apps/`, shared docs in `website/`, E2E harnesses and Vitest config in `e2e/`, and maintenance utilities inside `scripts/`. Place new source beside related modules, keep feature-specific assets local, and colocate unit specs in the same directory when practical.

## Build, Test, and Development Commands
- `pnpm dev` – runs package development tasks in watch mode for rapid feedback.
- `pnpm build` – performs a full monorepo build; scope via `pnpm build:pkgs`, `pnpm build:apps`, or `pnpm build:docs` for targeted pipelines.
- `pnpm test` – executes Vitest suites with coverage reporting.
- `pnpm e2e` – runs end-to-end scenarios against the example apps.
- `pnpm lint` – applies eslint, stylelint, and prettier checks before commits.

## Coding Style & Naming Conventions
Write TypeScript using ESM syntax and 2-space indentation. Packages stay kebab-case, files and variables use camelCase, and classes follow PascalCase. Prefer concise default exports only when a module has a single responsibility. Formatting is enforced by `@icebreakers/eslint-config`, Prettier, lint-staged, and husky pre-commit hooks—run `pnpm lint --fix` to auto-resolve safe issues.

## Testing Guidelines
Vitest with `@vitest/coverage-v8` is the primary framework; name specs `*.test.ts` or `*.spec.ts` and keep them near the code. Guard behavioural changes with snapshots when appropriate and update them intentionally. Target green coverage in CI by running `pnpm test --coverage`. Place E2E specs in `e2e/` and drive them with `pnpm e2e`.

## Commit & Pull Request Guidelines
Follow Conventional Commits, e.g. `feat(weapp-vite): add css preprocess support`. Consolidate related changes per commit and ensure `pnpm build`, `pnpm test`, and `pnpm lint` succeed locally. PRs should describe scope, affected packages, linked issues, and include before/after visuals for IDE or UI updates. Mention validation steps and any manual testing.

## Security & Configuration Tips
Require Node.js 20+ and a compatible pnpm release for reproducible installs. When using `weapp-ide-cli`, enable the WeChat Developer Tools “服务端口” option before running `weapp open`, `preview`, or `upload`. Never commit AppIDs, secrets, or tokens—store them in `.env.local` or environment variables ignored by Git.
