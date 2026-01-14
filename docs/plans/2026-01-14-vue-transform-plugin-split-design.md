# Vue Transform Plugin Split Design

## Context

`packages/weapp-vite/src/plugins/vue/transform/plugin.ts` mixes Vite hook orchestration, scoped slot handling, style request parsing, class/style WXS resolution, compile options assembly, and bundle emission in a single module. This makes it difficult to navigate and safely extend. We want to split it into focused modules while preserving current behavior.

## Goals

- Split plugin logic into responsibility-focused modules.
- Keep the public entry path stable via a folder `index.ts`.
- Preserve hook ordering, caching behavior, and logging semantics.

## Non-goals

- No behavior changes to Vue compilation or asset emission.
- No changes to output ordering or runtime side effects.
- No new tests or snapshot updates.

## Proposed Structure

Create a new folder `packages/weapp-vite/src/plugins/vue/transform/plugin/`:

- `index.ts`: plugin entry; owns hook wiring and shared caches.
- `styleRequest.ts`: style request parsing and builder utilities.
- `scopedSlot.ts`: scoped slot virtual IDs, module generation, and asset/chunk emission.
- `classStyle.ts`: class/style WXS path resolution utilities.
- `compileOptions.ts`: compile options builder for `compileVueFile`.
- `bundle.ts`: generateBundle asset emission flow, including fallback entries.

The original `plugin.ts` will be replaced by `plugin/index.ts` to keep the public entry path stable.

## Data Flow

`index.ts` initializes caches and delegates to modules. Style request parsing and scoped slot virtual modules are handled by `styleRequest.ts` and `scopedSlot.ts`. Compilation options are built in `compileOptions.ts`, and class/style WXS location logic resides in `classStyle.ts`. Asset emission in `generateBundle` is centralized in `bundle.ts`, which processes cached compilations and fallback entries using the existing logic.

## Error Handling

No changes. Existing try/catch logging and fallback behavior remain unchanged, just relocated to the appropriate module.

## Testing

No new tests. Existing tests should continue to pass without updates.
