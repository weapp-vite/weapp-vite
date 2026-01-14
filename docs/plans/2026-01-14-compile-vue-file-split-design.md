# Compile Vue File Split Design

## Goal

Split `compileVueFile.ts` into small, phase-focused modules without changing public APIs or runtime behavior.

## Architecture

- Replace `packages/weapp-vite/src/plugins/vue/transform/compileVueFile.ts` with a folder entry and phase modules.
- New entry: `packages/weapp-vite/src/plugins/vue/transform/compileVueFile/index.ts` exports `compileVueFile` with the same signature and return type.
- Phase modules:
  - `parse.ts`: SFC parsing, `descriptorForCompile` creation, `<script setup>` macro extraction, `defineOptions` hash.
  - `template.ts`: template compilation and template-related result fields.
  - `script.ts`: script compilation, macro stripping, component registration fallback, `transformScript` call.
  - `style.ts`: style compilation, scoped id, CSS Modules aggregation and script injection.
  - `config.ts`: `<json>` blocks, auto usingComponents / auto import tags, defaults and macro merges.
  - `finalize.ts`: last-pass script fallback, meta hashes, return result.

## Data Flow

1. `parse.ts` returns parse artifacts and metadata.
2. `template.ts` writes template output and template metadata into the result.
3. `script.ts` generates and transforms script code using parse outputs and template metadata.
4. `style.ts` adds wxss output and optional CSS Modules injection.
5. `config.ts` builds the final config JSON, merging defaults, macro config, and auto usingComponents.
6. `finalize.ts` ensures a minimal runtime script and fills meta hashes before returning.

## Error Handling

- Parse errors still throw with the same message.
- Auto usingComponents analysis still warns on failures with the same message format.
- Auto import tag resolver failures are still swallowed.
- JSON parse failures still fall back to an empty object.

## Testing

- No new tests. Existing compile/transform tests should remain green.
- Optional: run targeted tests for Vue transform if needed.
