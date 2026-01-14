# Chunk Strategy Split Design

## Context

`packages/weapp-vite/src/runtime/chunkStrategy.ts` is ~1000 lines and mixes state caches, naming rules, prefix collection, bundle rewrites, and sourcemap handling. This makes it hard to reason about the chunking flow and to update any one stage without touching unrelated logic.

## Goals

- Reduce file size by splitting into stage-focused modules.
- Keep the public exports and runtime behavior identical.
- Preserve diagnostics, caching, and error semantics.

## Non-goals

- No algorithm changes or new features.
- No changes to external API signatures or options.

## Proposed Module Split (by stage)

- `chunkStrategyState.ts`
  - Shared caches and diagnostics (`takeImportersMap`, `forceDuplicateSharedChunks`, `sharedChunkDiagnostics`).
  - Accessors and mutators (`getTakeImporters`, `markForceDuplicateSharedChunk`, `isForceDuplicateSharedChunk`, `consumeSharedChunkDiagnostics`).
- `chunkStrategyCollector.ts`
  - Prefix collection and module scope validation (`summarizeImportPrefixes`, `collectEffectivePrefixes`, `resolveSubPackagePrefix`, `assertModuleScopedToRoot`).
- `chunkStrategyNaming.ts`
  - Shared-name resolution (`resolveSharedChunkName`, `resolveTakeSharedChunkName`, `createSharedChunkNameFromKeys`).
- `chunkStrategyApply.ts`
  - Apply duplicate/hoist strategy (`applySharedChunkStrategy`).
- `chunkStrategyBundle.ts`
  - Bundle updates and importer rewrites (`findChunkImporters`, `updateImporters`, `replaceInArray`, `updateViteMetadata`, `ensureUniqueFileName`).
- `chunkStrategySourceMap.ts`
  - Sourcemap handling (`collectSourceMapKeys`, `findSourceMapAsset`, `resolveSourceMapSource`, `emitSourceMapAsset`, `cloneSourceLike`).
- `chunkStrategyUtils.ts`
  - Pure helpers (`replaceAll`, `containsImportSpecifier`, `hasInCollection`, `createRelativeImport`).
- `chunkStrategy.ts`
  - Re-exports public API and composes helpers.

## Data Flow

`chunkStrategy.ts` remains the public module that re-exports existing functions and constants. Helper modules depend on the state module to access shared caches and diagnostics. Naming and collector stages are pure aside from state updates. Apply/bundle/source map stages manage I/O and bundle mutation only.

## Error Handling

All existing error messages and thrown errors remain unchanged. Diagnostics recording and consumption behavior stays intact.

## Testing

No new tests required. Existing chunk strategy tests should continue to pass.
