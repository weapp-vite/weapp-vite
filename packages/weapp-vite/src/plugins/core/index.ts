import type { OutputBundle } from 'rolldown'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import type { SubPackageMetaValue } from '../../types'
import type { CorePluginState, RemoveImplicitPagePreloadOptions } from './helpers'
import { useLoadEntry } from '../hooks/useLoadEntry'
import { removeImplicitPagePreloads } from './helpers'
import { createCoreLifecyclePlugin } from './lifecycle'
import { createRequireAnalysisPlugin } from './requireAnalysis'
import { createWxssResolverPlugin } from './wxss'

export function weappVite(ctx: CompilerContext, subPackageMeta?: SubPackageMetaValue): Plugin[] {
  const buildTarget = ctx.currentBuildTarget ?? 'app'
  const hmrSharedChunksMode = ctx.configService?.weappViteConfig?.hmr?.sharedChunks ?? 'full'
  const hmrSharedChunkImporters = new Map<string, Set<string>>()
  const hmrState = { didEmitAllEntries: false, hasBuiltOnce: false }
  const {
    loadEntry,
    loadedEntrySet,
    jsonEmitFilesMap,
    entriesMap,
    resolvedEntryMap,
    markEntryDirty,
    emitDirtyEntries,
  } = useLoadEntry(ctx, {
    buildTarget,
    hmr: {
      sharedChunks: hmrSharedChunksMode,
      sharedChunkImporters: hmrSharedChunkImporters,
      setDidEmitAllEntries: (value) => {
        hmrState.didEmitAllEntries = value
      },
    },
  })
  const state: CorePluginState = {
    ctx,
    subPackageMeta,
    loadEntry,
    loadedEntrySet,
    markEntryDirty,
    emitDirtyEntries,
    entriesMap,
    jsonEmitFilesMap,
    resolvedEntryMap,
    requireAsyncEmittedChunks: new Set<string>(),
    pendingIndependentBuilds: [],
    watchFilesSnapshot: [],
    buildTarget,
    moduleImporters: new Map<string, Set<string>>(),
    entryModuleIds: new Set<string>(),
    hmrState,
    hmrSharedChunksMode,
    hmrSharedChunkImporters,
  }

  return [
    createWxssResolverPlugin(state),
    createCoreLifecyclePlugin(state),
    createRequireAnalysisPlugin(state),
  ]
}

export function __removeImplicitPagePreloadsForTest(
  bundle: OutputBundle,
  options: RemoveImplicitPagePreloadOptions,
) {
  removeImplicitPagePreloads(bundle, options)
}
