# Load Entry Split Design

## Context

`packages/weapp-vite/src/plugins/hooks/useLoadEntry/loadEntry.ts` mixes entry loading, template parsing, script setup import discovery, file watching utilities, and side-file handling. The file is large and hard to scan for specific behaviors.

## Goals

- Split `loadEntry` into focused helper modules.
- Keep the public entry path stable via a folder `index.ts`.
- Preserve current behavior, caching, and logging.

## Non-goals

- No changes to entry resolution logic.
- No changes to auto-import behavior.
- No new tests.

## Proposed Structure

Create a new folder `packages/weapp-vite/src/plugins/hooks/useLoadEntry/loadEntry/`:

- `index.ts`: main `createEntryLoader` implementation and shared state.
- `template.ts`: template tag collection and `<script setup>` import analysis helpers.
- `watch.ts`: file watcher helpers, style import discovery, and side-file handling.

The original `loadEntry.ts` will be replaced by `loadEntry/index.ts` to keep imports stable.

## Data Flow

`index.ts` orchestrates entry loading and delegates template parsing to `template.ts` and file watching/side-file logic to `watch.ts`. Shared caches and timing utilities stay in `index.ts`.

## Error Handling

Unchanged. Warnings and fallback behavior remain intact, only relocated.

## Testing

No new tests. Existing tests should continue to pass.
