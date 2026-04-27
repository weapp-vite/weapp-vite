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
  const hmrSharedChunksMode = ctx.configService?.weappViteConfig?.hmr?.sharedChunks ?? 'auto'
  const hmrSharedChunkImporters = new Map<string, Set<string>>()
  const hmrSharedChunksByEntry = new Map<string, Set<string>>()
  const hmrSharedChunkDependencies = new Map<string, Set<string>>()
  const hmrState = {
    didEmitAllEntries: false,
    hasBuiltOnce: false,
    lastEmittedEntryIds: new Set<string>(),
  }
  const {
    loadEntry,
    loadedEntrySet,
    jsonEmitFilesMap,
    entriesMap,
    resolvedEntryMap,
    layoutEntryDependents,
    markEntryDirty,
    emitDirtyEntries,
  } = useLoadEntry(ctx, {
    buildTarget,
    hmr: {
      sharedChunks: hmrSharedChunksMode,
      sharedChunkImporters: hmrSharedChunkImporters,
      sharedChunksByEntry: hmrSharedChunksByEntry,
      setDidEmitAllEntries: (value) => {
        hmrState.didEmitAllEntries = value
        if (ctx.runtimeState?.build?.hmr) {
          ctx.runtimeState.build.hmr.didEmitAllEntries = value
        }
      },
      setLastEmittedEntries: (entryIds) => {
        hmrState.lastEmittedEntryIds = new Set(entryIds)
        if (ctx.runtimeState?.build?.hmr) {
          ctx.runtimeState.build.hmr.lastEmittedEntryIds = new Set(entryIds)
        }
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
    layoutEntryDependents,
    requireAsyncEmittedChunks: new Set<string>(),
    pendingIndependentBuilds: [],
    watchFilesSnapshot: [],
    buildTarget,
    moduleImporters: new Map<string, Set<string>>(),
    entryModuleIds: new Set<string>(),
    hmrState,
    hmrSharedChunksMode,
    hmrSharedChunkImporters,
    hmrSharedChunksByEntry,
    hmrSharedChunkDependencies,
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
