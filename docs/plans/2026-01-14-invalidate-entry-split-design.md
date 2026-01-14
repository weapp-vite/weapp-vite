# Invalidate Entry Split Design

## Context

`packages/weapp-vite/src/plugins/utils/invalidateEntry.ts` currently mixes CSS import graph tracking, sidecar invalidation logic, watcher wiring, and ignore matching into a single module. The file is large and spans multiple responsibilities.

## Goals

- Split sidecar invalidation into focused helper modules.
- Keep the public entry path stable via a folder `index.ts`.
- Preserve current behavior and logging.

## Non-goals

- No changes to watcher semantics.
- No changes to CSS import resolution.
- No new tests.

## Proposed Structure

Create a new folder `packages/weapp-vite/src/plugins/utils/invalidateEntry/`:

- `index.ts`: public exports.
- `shared.ts`: shared constants and small helpers.
- `cssGraph.ts`: CSS import graph tracking and dependency resolution helpers.
- `sidecar.ts`: `invalidateEntryForSidecar` logic.
- `watcher.ts`: `ensureSidecarWatcher` and ignore matcher.

The original `invalidateEntry.ts` will be replaced by `invalidateEntry/index.ts` to keep imports stable.

## Data Flow

`watcher.ts` listens for sidecar file changes and delegates to `cssGraph.ts` for dependency tracking and to `sidecar.ts` for entry invalidation. `shared.ts` centralizes shared sets and helpers used across modules.

## Error Handling

Unchanged. Existing logging and error handling remain intact.

## Testing

No new tests. Existing tests should continue to pass.
