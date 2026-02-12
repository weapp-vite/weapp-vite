# Repository Guidelines

## Project Structure & Module Organization
This Turbo-powered pnpm monorepo keeps core packages in `packages/` (e.g. `weapp-vite`, `plugin-vue`, scoped `@weapp-core/*`). Example apps sit in `apps/`, docs in `website/`, automation in `scripts/`, and E2E harnesses under `e2e/`. Place new features beside related modules, co-locate unit specs as `*.test.ts` or `*.spec.ts`, and store feature assets next to their owners to keep package boundaries obvious.

## Build, Test, and Development Commands
Run `pnpm install` once per clone to hoist dependencies. Use `pnpm dev` for watcher-driven development across active packages. Execute `pnpm build` for a full build or narrow scope with `pnpm build:pkgs`, `pnpm build:apps`, and `pnpm build:docs`. Validate behaviour with `pnpm test` or `pnpm test --coverage`, and lint everything via `pnpm lint --fix` before pushing.

## Coding Style & Naming Conventions
Author code in TypeScript with ESM modules and 2-space indentation. Keep packages kebab-case, files and variables camelCase, and classes PascalCase. Prefer named exports unless a file owns a single default. Formatting and static analysis rely on `@icebreakers/eslint-config`, Prettier, stylelint, and lint-staged hooks; stay aligned by running `pnpm lint --fix`.
JSDoc comments should be written in Chinese.

## Testing Guidelines
Vitest with `@vitest/coverage-v8` enforces unit coverage thresholds. Co-locate tests with sources, mirroring filenames and suffixing `*.test.ts` or `*.spec.ts`. When behaviour shifts, augment snapshots or targeted coverage. Run `pnpm test --coverage` for CI parity and `pnpm e2e` to exercise example integrations.
All E2E app projects under `e2e-apps/` must use a real AppID in `project.config.json` (do not use `touristappid`).
When adding pages to any `e2e-apps/` project, also add matching entries to `project.private.config.json` under `condition.miniprogram.list`.

## Commit & Pull Request Guidelines
Follow Conventional Commits such as `feat(weapp-vite): add css preprocess support`. Each PR should group related work, link issues, and include before/after evidence for IDE or UI changes. Confirm `pnpm build`, `pnpm test`, and `pnpm lint --fix` succeed locally before requesting review, and document manual verification in the PR template.
When shipping changes, if the release includes `weapp-vite` or `wevu`, or any files under `templates/` change, add a changeset that bumps `create-weapp-vite` so `pnpm create weapp-vite` stays in sync with the latest dependencies and templates.
All `.changeset/*.md` description text (the summary paragraph under frontmatter) must be written in Chinese.

## Security & Configuration Tips
Target Node.js 20+ and a compatible pnpm release. When using `weapp-ide-cli`, enable the WeChat Developer Tools “服务端口” ahead of `weapp open`, `preview`, or `upload`. Keep AppIDs, tokens, and secrets in `.env.local` or environment variables—never commit them to the repository.
