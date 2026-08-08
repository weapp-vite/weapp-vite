import type { RolldownOutput } from 'rolldown'
import type { ResolvedConfig } from 'vite'
import type { BuildTarget, CompilerContext } from '../../../context'
import type { Entry, SubPackageMetaValue } from '../../../types'

type LoadEntryApi = ReturnType<typeof import('../../hooks/useLoadEntry').useLoadEntry>

export interface IndependentBuildResult {
  meta: SubPackageMetaValue
  rollup: RolldownOutput
}

export interface CorePluginState {
  ctx: CompilerContext
  subPackageMeta?: SubPackageMetaValue
  loadEntry: LoadEntryApi['loadEntry']
  loadedEntrySet: LoadEntryApi['loadedEntrySet']
  markEntryDirty: LoadEntryApi['markEntryDirty']
  emitDirtyEntries: LoadEntryApi['emitDirtyEntries']
  entriesMap: LoadEntryApi['entriesMap']
  jsonEmitFilesMap: LoadEntryApi['jsonEmitFilesMap']
  resolvedEntryMap: LoadEntryApi['resolvedEntryMap']
  requireAsyncEmittedChunks: Set<string>
  pendingIndependentBuilds: Promise<IndependentBuildResult>[]
  watchFilesSnapshot: string[]
  buildTarget: BuildTarget
  resolvedConfig?: ResolvedConfig
  hmrState: {
    didEmitAllEntries: boolean
    hasBuiltOnce: boolean
    affectedSharedChunkIds?: Set<string>
    lastHmrEntryIds?: Set<string>
    lastEmittedEntryIds?: Set<string>
    skipSharedChunkRefresh?: boolean
  }
  hmrSharedChunksMode: 'full' | 'auto' | 'off'
  hmrSharedChunkImporters: Map<string, Set<string>>
  hmrSharedChunksByEntry: Map<string, Set<string>>
  hmrSharedChunkDependencies: Map<string, Set<string>>
  outputChunksByModule: Map<string, Set<string>>
  hmrSourceSharedChunks: Set<string>
  hmrRootInputIds: Set<string>
}

export interface RemoveImplicitPagePreloadOptions {
  configService: CompilerContext['configService']
  entriesMap: Map<string, Entry | undefined>
}
