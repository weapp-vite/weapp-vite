# Template Expression Split Design

## Context

`packages/weapp-vite/src/plugins/vue/compiler/template/expression.ts` contains Babel parsing, LRU caching, expression normalization, scoped slot rewriting, and binding normalization in one module. The file is large and mixes responsibilities.

## Goals

- Split expression logic by responsibility (parse/bindings/wxml/scoped slot/js).
- Keep the public entry path stable via a folder `index.ts`.
- Preserve behavior and warnings.

## Non-goals

- No changes to expression semantics.
- No new warnings or error text.
- No new tests.

## Proposed Structure

Create a new folder `packages/weapp-vite/src/plugins/vue/compiler/template/expression/`:

- `index.ts`: public exports preserving current API.
- `parse.ts`: Babel parse/generate helpers and LRU caches.
- `bindings.ts`: class/style binding normalization.
- `wxml.ts`: WXML expression normalization (`??`, template literals, fallback logic).
- `scopedSlot.ts`: scoped slot rewrite helpers and globals.
- `js.ts`: `normalizeJsExpressionWithContext` using scoped slot data.

The original `expression.ts` will be replaced by `expression/index.ts` to keep imports stable.

## Data Flow

`parse.ts` is the base layer. `wxml.ts` normalizes raw expressions. `scopedSlot.ts` rewrites expressions when scoped slot rewriting is enabled. `bindings.ts` and `js.ts` use these helpers to produce normalized output, preserving warnings and fallbacks. `index.ts` re-exports the same functions as before.

## Error Handling

Unchanged. Existing try/catch logic and fallback behaviors remain intact, only relocated.

## Testing

No new tests. Existing tests should continue to pass.
