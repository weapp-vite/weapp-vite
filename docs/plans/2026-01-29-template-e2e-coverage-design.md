# Template E2E Coverage Design (2026-01-29)

## Goal

Provide 100% page coverage e2e tests for every template in `templates/`, where coverage is defined as: every page declared in `app.json` (or `defineAppJson` in `app.vue`) must be built, launched, and snapshotted. Each template must have a standalone e2e test file so it can be run independently.

## Scope

- Templates in `templates/*`.
- Pages list sourced from `app.json` or `defineAppJson` in `app.vue`.
- Subpackages from `subPackages`/`subpackages` are included.
- Uses existing `miniprogram-automator` + WeChat DevTools for runtime verification.

## Approach (Option B)

- One test file per template under `e2e/`.
- A shared helper module handles:
  - Loading app config (JSON or Vue macro extraction).
  - Normalizing page paths from main package + subpackages.
  - Building via `weapp-vite` CLI.
  - Launching DevTools automator and snapshotting WXML for each page.

## Test Flow

1. Resolve template root (e.g. `templates/weapp-vite-template`).
2. Load config from `src/app.json`, or fallback to `src/app.vue` via `extractConfigFromVue`.
3. Build full page list:
   - `pages` from main package.
   - `subPackages`/`subpackages` roots + pages.
4. `weapp-vite build <root> --platform weapp --skipNpm`.
5. Launch automator with `projectPath` set to the template root.
6. For each page:
   - `reLaunch('/' + pagePath)`.
   - Query `page` element, capture WXML, normalize, format, snapshot.

## Error Handling

- Throw if no config is found or `pages` is empty.
- Throw if `reLaunch` or `page.$('page')` fails.
- Normalize WXML to reduce snapshot noise (strip automator overlay and tap bindings).

## Run Individually

- Each template test can be run directly, e.g.:
  - `pnpm vitest -c e2e/vitest.e2e.config.ts e2e/template-weapp-vite-template.test.ts`

## Notes

- No changes to templates themselves; no changeset required.
