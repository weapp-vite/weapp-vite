# Template Elements Split Design

## Context

`packages/weapp-vite/src/plugins/vue/compiler/template/elements.ts` contains element transform dispatch, slot handling, attribute rendering, structural directive handling, and shared helpers in a single file. The size makes the logic harder to navigate and reuse.

## Goals

- Split element transform logic by responsibility (tags/attrs/helpers).
- Keep the public entry path stable via a folder `index.ts`.
- Preserve current output and behavior.

## Non-goals

- No changes to WXML output format.
- No changes to error handling or warnings.
- No new tests.

## Proposed Structure

Create a new folder `packages/weapp-vite/src/plugins/vue/compiler/template/elements/`:

- `index.ts`: `transformElement` entry and routing logic.
- `helpers.ts`: scope stacks, string helpers, and shared utilities.
- `attrs.ts`: attribute collection and rendering helpers.
- `tag-normal.ts`: normal element rendering.
- `tag-component.ts`: component rendering and slot orchestration.
- `tag-slot.ts`: slot parsing, scoped slot components, and fallback rendering.
- `tag-builtin.ts`: built-in tags (`transition`, `keep-alive`, `template`).
- `tag-structural.ts`: `v-if` and `v-for` structural directives.

The original `elements.ts` will be replaced by `elements/index.ts` to keep imports stable.

## Data Flow

`index.ts` dispatches based on structural directives and element type. Tag modules render their specific output, delegating attribute rendering to `attrs.ts` and shared utilities to `helpers.ts`. Scoped slot handling stays isolated in `tag-slot.ts`, with component rendering only orchestrating slot usage.

## Error Handling

Unchanged. All existing try/catch logic and warnings remain as-is, only relocated.

## Testing

No new tests. Existing tests should continue to pass.
