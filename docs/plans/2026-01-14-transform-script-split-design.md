# Transform Script Split Design

## Context

`packages/weapp-vite/src/plugins/vue/transform/transformScript.ts` is a large module that combines AST utilities, import rewrites, macro cleanup, and component option injection. This makes it harder to navigate and evolve. We want to split the module into smaller files while keeping the API and behavior unchanged.

## Goals

- Split transform script logic into clear, responsibility-focused modules.
- Keep the public entry path stable via a folder `index.ts`.
- Preserve existing behavior, import ordering, and logging.

## Non-goals

- No functional changes to transform output.
- No changes to logging or error handling semantics.
- No new tests or snapshot updates.

## Proposed Structure

Create a new folder `packages/weapp-vite/src/plugins/vue/transform/transformScript/`:

- `index.ts`: public entry; owns AST parse/generate and coordinates the pipeline; exports `transformScript`, `TransformScriptOptions`, and `TransformResult`.
- `macros.ts`: TypeScript cleanup, optional-flag stripping, and AST normalization helpers.
- `imports.ts`: Vue runtime import rewriting, `defineComponent` alias collection, type-only import removal.
- `collect.ts`: collection of `defineComponent` declarations and default export path capture.
- `rewrite.ts`: component option injection and export rewriting (wevu defaults, page feature flags, class/style computed, createApp/createWevuComponent).
- `utils.ts`: shared AST utilities (plain object checks, property lookups, key creation, defaults merging).

The original `transformScript.ts` will be replaced by `transformScript/index.ts` to keep the public entry path stable.

## Data Flow

`index.ts` parses source into AST, runs the existing Vue SFC transform plugin, and performs a single traversal composed from the visitors in `macros.ts`, `imports.ts`, and `collect.ts`. After traversal, it uses `rewrite.ts` to inject template component meta and rewrite the default export. If no changes are made, it returns the original source, otherwise it generates new code with existing generator settings.

## Error Handling

No changes: serialization warnings, injection warnings, and other log messages remain identical and at the same decision points.

## Testing

No new tests. Existing test coverage for script transforms should continue to pass unchanged.
