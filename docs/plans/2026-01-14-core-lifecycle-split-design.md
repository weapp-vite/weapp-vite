# Core Lifecycle Split Design

## Goal

Split `core/lifecycle.ts` into hook-focused modules while keeping behavior and exports stable.

## Architecture

- Replace `packages/weapp-vite/src/plugins/core/lifecycle.ts` with a folder entry and modules.
- Entry: `packages/weapp-vite/src/plugins/core/lifecycle/index.ts` keeps the `createCoreLifecyclePlugin` export/signature.
- Modules:
  - `watch.ts`: `buildStart` and `watchChange` hooks with watcher/dirty-entry handling.
  - `load.ts`: `options` and `load` hooks for scanning and script/css entry loading.
  - `emit.ts`: `renderStart` and `generateBundle` hooks, including shared chunk strategy logic.
  - `end.ts`: `buildEnd` hook with debug logging.

## Data Flow

1. `index.ts` composes hook functions from the modules into the plugin object.
2. `watch.ts` manages sidecar watching, cache invalidation, and entry dirty tracking.
3. `load.ts` prepares build inputs and resolves component/app entries.
4. `emit.ts` emits JSON/WXML assets, applies shared chunk strategies, and refreshes module graphs.
5. `end.ts` logs module counts per build target.

## Error Handling

- No new error paths; logging and guard behavior remain unchanged.

## Testing

- No new tests; rely on existing core plugin coverage.
