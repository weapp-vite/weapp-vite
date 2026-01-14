# Auto Routes Split Design

## Goal

Split `runtime/autoRoutesPlugin/routes.ts` into focused modules while keeping exports and behavior stable.

## Architecture

- Replace `packages/weapp-vite/src/runtime/autoRoutesPlugin/routes.ts` with a folder entry and modules.
- Entry: `packages/weapp-vite/src/runtime/autoRoutesPlugin/routes/index.ts` keeps current exports.
- Modules:
  - `resolve.ts`: route resolution helpers (`resolveRoute`, `resolvePagesDirectory`).
  - `format.ts`: typed definition formatting helpers.
  - `scan.ts`: route scanning and snapshot generation.
  - `state.ts`: route cloning and reference updates.

## Data Flow

1. `index.ts` re-exports the public API.
2. `scan.ts` orchestrates scanning, normalization, and output assembly.
3. `resolve.ts` handles route/path derivation for pages and subpackages.
4. `format.ts` builds typed definitions for routes.
5. `state.ts` updates existing route references without changing identity.

## Error Handling

- No new error paths; existing checks and behavior remain unchanged.

## Testing

- No new tests; rely on existing coverage.
