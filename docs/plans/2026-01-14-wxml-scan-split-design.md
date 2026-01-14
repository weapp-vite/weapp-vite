# WXML Scan Split Design

## Goal

Split `wxml/scan.ts` into focused modules while keeping exports and behavior stable.

## Architecture

- Replace `packages/weapp-vite/src/wxml/scan.ts` with a folder entry and modules.
- Entry: `packages/weapp-vite/src/wxml/scan/index.ts` keeps `scanWxml` and exports types.
- Modules:
  - `cache.ts`: LRU cache, hash, and cache key helpers.
  - `events.ts`: event directive resolution and default exclude component helper.
  - `parser.ts`: parser callbacks and token construction.
  - `types.ts`: token and range interfaces.

## Data Flow

1. `index.ts` applies options, cache lookup, invokes parser, and returns token.
2. `cache.ts` hashes sources and stores/retrieves cached tokens.
3. `events.ts` normalizes event directives and default component exclusion.
4. `parser.ts` handles the HTML parser flow and emits tokens.
5. `types.ts` defines shared token structures.

## Error Handling

- No new error paths; existing behavior remains unchanged.

## Testing

- No new tests; rely on existing coverage.
