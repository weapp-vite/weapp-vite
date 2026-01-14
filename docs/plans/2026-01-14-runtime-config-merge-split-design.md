# Runtime Config Merge Split Design

## Goal

Split `runtime/config/internal/merge.ts` into focused modules while keeping exports and behavior stable.

## Architecture

- Replace `packages/weapp-vite/src/runtime/config/internal/merge.ts` with a folder entry and modules.
- Entry: `packages/weapp-vite/src/runtime/config/internal/merge/index.ts` keeps `createMergeFactories`.
- Modules:
  - `plugins.ts`: plugin normalization and arrangement helpers.
  - `workers.ts`: `mergeWorkers` implementation.
  - `miniprogram.ts`: `merge` implementation for mini program builds.
  - `web.ts`: `mergeWeb` implementation.
  - `inline.ts`: `mergeInlineConfig` and shared config-service guards.

## Data Flow

1. `index.ts` wires shared options and composes merge functions.
2. `plugins.ts` filters/arranges plugins and ensures core plugin insertion.
3. `workers.ts` builds worker-specific inline config.
4. `miniprogram.ts` handles app/subpackage config merging and shared chunk options.
5. `web.ts` handles web build config merging and plugin injection.
6. `inline.ts` provides lightweight inline merging for runtime usage.

## Error Handling

- No new error paths; existing safeguards remain unchanged.

## Testing

- No new tests; rely on existing coverage.
