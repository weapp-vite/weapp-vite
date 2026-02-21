---
name: weapp-vite-best-practices
description: Apply production-ready best practices for weapp-vite projects. Use when creating or refactoring mini-program projects with weapp-vite, designing directory/config conventions, choosing subpackage and chunk strategy, enabling auto routes/components, setting CI/devtool workflows, or debugging build/output issues in `vite.config.ts` and `app.json`.
---

# weapp-vite-best-practices

## Overview

Build and maintain weapp-vite projects with stable conventions first, then tune performance and build behavior. Prefer minimal config that matches project structure.

## Workflow

1. Confirm baseline

- Use Node `^20.19.0 || >=22.12.0` and consistent pnpm.
- Ensure WeChat DevTools service port is enabled before using `--open` workflows.
- Verify `weapp.srcRoot` matches real source root (`src` or `miniprogram`).

2. Define project structure

- Keep pages under `src/pages/**` and subpackages under `src/packages/**`.
- Keep reusable components in `src/components/**` and shared logic in `src/shared/**` or `src/utils/**`.
- Prefer explicit config layering: Vite in `vite.config.ts`, mini-program specifics in `weapp` field.

3. Apply high-value defaults

- Enable `weapp.autoRoutes` when using convention-based pages.
- Keep auto component import on by default; only add custom `globs/resolvers` when needed.
- Use Script Setup JSON macros or `<json>` blocks for page/component config instead of scattered manual JSON edits.

4. Choose subpackage strategy intentionally

- Use normal subpackages for shared build context.
- Use independent subpackages only when strict isolation is needed.
- Choose `weapp.chunks.sharedStrategy` by goal:
  - `duplicate`: better subpackage first-open experience.
  - `hoist`: better total package deduplication/control.

5. Keep build and CI deterministic

- Use stable scripts (`dev`, `build`, `open`, optional `analyze`).
- In CI, separate compile and IDE/preview/upload steps.
- For CLI automation, prefer `weapp-ide-cli` and non-interactive mode.

6. Debug with framework hooks

- Use `weapp.debug.watchFiles/resolveId/load` for missing output and resolution issues.
- Use `inspect` (plugin hook timings) for slow build diagnosis.
- Validate route/component generation artifacts (`typed-router.d.ts`, auto import outputs).

## Guardrails

- Avoid customizing config before confirming `srcRoot` and output roots are correct.
- Avoid mixing many advanced chunk overrides early; start from default strategy and add targeted rules.
- Avoid treating mini-program config as web-only conventions; keep `usingComponents`, subpackage roots, and JSON semantics explicit.

## Completion Checklist

- `vite.config.ts` has clear `weapp` section with minimal required options.
- `pages/subPackages` source-of-truth strategy is clear (manual or auto routes).
- Component registration strategy is consistent (auto import + resolver policy documented).
- Subpackage/chunk strategy is chosen and justified.
- Dev/CI workflow is repeatable and does not depend on manual IDE steps.

## References

- `references/config-playbook.md`
- `references/debug-playbook.md`
