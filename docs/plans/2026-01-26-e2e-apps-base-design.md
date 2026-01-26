# E2E baseline app and test rewrite design

## Goal

Create a single, minimal baseline app for all e2e tests and rewrite existing e2e tests to use it exclusively.

## Scope

- Add a new top-level directory `e2e-apps/` with a minimal app at `e2e-apps/base/`.
- Add `e2e-apps/*` to `pnpm-workspace.yaml` so the app is a workspace member.
- Replace all existing e2e tests to target only `e2e-apps/base`.
- Preserve both runtime WXML snapshot testing and platform build output verification.

## Non-goals

- Keep using `e2e/fixtures` or `templates` for e2e tests.
- Expand the baseline app beyond the minimal artifacts required by current tests.

## Baseline app structure

- `e2e-apps/base/package.json` minimal metadata, `private: true`.
- `e2e-apps/base/project.config.json` uses `appid` from `apps/vite-native/project.config.json` (`wxb3d842a4a7e3440d`).
- `e2e-apps/base/src/app.json` includes a single page: `pages/index/index`.
- `e2e-apps/base/src/app.ts` minimal `App({})`.
- `e2e-apps/base/src/pages/index/index.wxml` includes:
  - `<import src="./card.wxml" />`
  - `<wxs src="./utils.wxs" module="util" />`
  - a `@tap` handler to validate platform attribute conversion.
- `e2e-apps/base/src/pages/index/card.wxml` and `utils.wxs` for template and module output checks.
- `e2e-apps/base/src/pages/index/index.ts` minimal `Page({})`.

## Test changes

- Replace the templates-based e2e test with a single runtime snapshot test that launches the baseline app via `miniprogram-automator`, opens `/pages/index/index`, and snapshots the formatted WXML.
- Update platform build tests to build only `e2e-apps/base` for each platform and assert:
  - expected template/script file extensions in `dist/`.
  - correct import and event attribute conversions.
  - `wxs` vs `sjs` conversions depending on platform.
- Clean `dist/` before each build to avoid stale artifacts.
- Keep sequential test execution for deterministic runs.

## Risks and mitigations

- Risk: the minimal app is too small to cover future e2e needs.
  - Mitigation: keep the app minimal but add new small fixtures in-place when tests require them.

## Acceptance criteria

- `pnpm test` (e2e config) uses `e2e-apps/base` as the only app input.
- No e2e test references `e2e/fixtures` or `templates`.
- Runtime WXML snapshot and platform build output checks both pass using the new baseline app.
