# Core Helpers Split Design

## Goal

Split `core/helpers.ts` into focused modules while keeping exports and behavior stable.

## Architecture

- Replace `packages/weapp-vite/src/plugins/core/helpers.ts` with a folder entry and modules.
- Entry: `packages/weapp-vite/src/plugins/core/helpers/index.ts` keeps the public exports.
- Modules:
  - `types.ts`: core plugin state/types (`CorePluginState`, `IndependentBuildResult`, `RemoveImplicitPagePreloadOptions`).
  - `graph.ts`: module graph utilities (`collectAffectedEntries`, `refreshModuleGraph`, `refreshSharedChunkImporters`).
  - `bundle.ts`: bundle filtering/emission helpers (`filterPluginBundleOutputs`, `emitJsonAssets`, `removeImplicitPagePreloads` and its local helpers).
  - `bytes.ts`: `formatBytes`.
  - `independent.ts`: `flushIndependentBuilds`.

## Data Flow

1. `index.ts` re-exports all types and helpers to preserve import paths.
2. `types.ts` supplies shared types for other helper modules.
3. `graph.ts` manages module/importer tracking for HMR/shared chunks.
4. `bundle.ts` handles plugin bundle filtering, JSON emission, and implicit preload removal.
5. `independent.ts` flushes pending independent build outputs into the main bundle.

## Error Handling

- No new error paths; existing guards and logging remain unchanged.

## Testing

- No new tests; rely on existing coverage.
