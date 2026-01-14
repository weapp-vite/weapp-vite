# Transform Script Macros Split Design

## Goal

Split `transformScript/macros.ts` into focused modules while keeping behavior and exports stable.

## Architecture

- Replace `packages/weapp-vite/src/plugins/vue/transform/transformScript/macros.ts` with a folder entry and modules.
- Entry: `packages/weapp-vite/src/plugins/vue/transform/transformScript/macros/index.ts` keeps the `createMacroVisitors` export/signature.
- Modules:
  - `optional.ts`: optional flag stripping and optional pattern traversal helpers.
  - `setupExpose.ts`: Vue `setup` param rewrite to align `__expose` with `expose`.
  - `stripTypes.ts`: TS node removals and type/optional flag cleanup visitors.

## Data Flow

1. `createMacroVisitors` composes the visitor fragments from each module.
2. `setupExpose` handles `setup(__props, { expose: __expose })` renames and shorthand normalization.
3. `stripTypes` removes TS-only syntax, drops type annotations, and clears optional flags on supported nodes.
4. `optional` helpers are used by `stripTypes` to traverse function parameters and nested patterns.

## Error Handling

- No new error paths; transformation flags and behavior remain identical.

## Testing

- No new tests; rely on existing transformScript coverage.
