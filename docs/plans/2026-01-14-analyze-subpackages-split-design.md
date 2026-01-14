# Analyze Subpackages Split Design

## Context

`packages/weapp-vite/src/analyze/subpackages.ts` contains type definitions, package classification, output processing, summarization, and the main `analyzeSubpackages` flow in one file. The size makes it difficult to navigate.

## Goals

- Split subpackage analysis into focused modules.
- Keep the public entry path stable via a folder `index.ts`.
- Preserve current behavior and exports.

## Non-goals

- No changes to analysis logic or output shape.
- No new tests.

## Proposed Structure

Create a new folder `packages/weapp-vite/src/analyze/subpackages/`:

- `index.ts`: `analyzeSubpackages` entry and public exports.
- `types.ts`: shared type definitions.
- `registry.ts`: package/module accumulator helpers.
- `classifier.ts`: package classification and module/asset source resolution.
- `output.ts`: output processing for chunks and assets.
- `summary.ts`: summarization and virtual placement helpers.

The original `subpackages.ts` will be replaced by `subpackages/index.ts` to keep imports stable.

## Data Flow

`index.ts` orchestrates the build and delegates to classifier, output processing, and summary helpers. Type definitions remain centralized in `types.ts`.

## Error Handling

Unchanged. The same errors are thrown from `analyzeSubpackages` when required services are missing.

## Testing

No new tests. Existing tests should continue to pass.
