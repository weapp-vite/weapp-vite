# JSON Macros Split Design

## Goal

Split `jsonMacros.ts` into phase-focused modules without changing public API or runtime behavior.

## Architecture

- Replace `packages/weapp-vite/src/plugins/vue/transform/jsonMacros.ts` with a folder entry.
- New entry: `packages/weapp-vite/src/plugins/vue/transform/jsonMacros/index.ts` exports the same public functions.
- Phase modules:
  - `parse.ts`: AST parsing helpers and macro collection/validation.
  - `analyze.ts`: top-level dependency collection, referenced name resolution, and statement selection.
  - `execute.ts`: temp file generation, import rewrite, bundle execution, and merge evaluation.
  - `rewrite.ts`: macro call removal from source for both script-setup and compiled output.

## Data Flow

1. `parse.ts` parses source and identifies valid macro statements.
2. `analyze.ts` computes the minimal set of top-level statements needed to evaluate macros.
3. `execute.ts` rewrites relative imports, emits a temporary entry, executes with `bundleRequire`, and merges macro results.
4. `rewrite.ts` removes macro calls from source for the stripped output.

## Error Handling

- Parse failures throw with existing messages.
- Macros must remain top-level and mutually exclusive; error messages remain unchanged.
- Macro evaluation still validates resolved values as objects and strips `$schema`.

## Testing

- No new tests. Existing json macro and compile script tests should stay green.
