# Load Entry Split Design

## Goal

Split `loadEntry/index.ts` into focused modules while keeping exports and behavior stable.

## Architecture

- Keep the public entry path via `packages/weapp-vite/src/plugins/hooks/useLoadEntry/loadEntry/index.ts`.
- Modules:
  - `resolve.ts`: cached entry resolution helpers and path normalization.
  - `app.ts`: app/plugin JSON handling and entry expansion.
  - `template.ts`: template scanning and `<script setup>` usingComponents inference.
  - `emit.ts`: entry emission, JSON asset registration, and style import injection.

## Data Flow

1. `index.ts` owns the shared caches, timing helpers, and the `createEntryLoader` closure.
2. `app.ts` handles app/plugin branch analysis, side-file collection, and plugin entry resolution.
3. `template.ts` scans templates and populates auto usingComponents for script setup.
4. `emit.ts` resolves entries, emits chunks, registers JSON assets, and injects style imports.
5. `resolve.ts` provides cached entry resolution utilities for other modules.

## Error Handling

- No new error paths; warnings and fallbacks remain unchanged.

## Testing

- No new tests; rely on existing coverage.
