# Runtime Structure Reorg Design

## Context

We split `autoImport/service` and `chunkStrategy` into multiple helper files. Keeping those helper files at the same directory level makes the runtime folder noisy and harder to scan. A dedicated folder per feature improves discoverability and makes refactors easier to navigate.

## Goals

- Group split helper files under feature-specific folders.
- Use short, consistent filenames inside each folder.
- Keep existing public import paths working without code changes elsewhere.

## Non-goals

- No behavior changes or API changes.
- No renaming of exported symbols.

## Proposed Structure

### Auto Import Service

- New folder: `packages/weapp-vite/src/runtime/autoImport/service/`
- Files:
  - `index.ts` (public entry, re-exports API)
  - `resolver.ts`
  - `registry.ts`
  - `metadata.ts`
  - `outputs.ts`
- External imports keep using `./service`; internal imports are updated to the new relative paths.

### Chunk Strategy

- New folder: `packages/weapp-vite/src/runtime/chunkStrategy/`
- Files:
  - `index.ts` (public entry, re-exports API)
  - `constants.ts`
  - `state.ts`
  - `collector.ts`
  - `naming.ts`
  - `apply.ts`
  - `bundle.ts`
  - `sourcemap.ts`
  - `utils.ts`
- External imports keep using `./chunkStrategy`; internal imports are updated to the new relative paths.

## Data Flow

The index modules keep the same API surface, so call sites do not change. Internal modules are imported via short, local paths, and feature-local helpers stay within their own directories.

## Error Handling

No changes; all error behavior remains unchanged.

## Testing

No new tests. Existing tests should remain green.
