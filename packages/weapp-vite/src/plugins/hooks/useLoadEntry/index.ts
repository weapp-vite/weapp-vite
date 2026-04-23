import type { PluginContext, ResolvedId } from 'rolldown'
import type { BuildTarget, CompilerContext } from '../../../context'
import type { Entry } from '../../../types'
import { createDebugger } from '../../../debugger'
import { createAutoImportAugmenter } from './autoImport'
import { createChunkEmitter } from './chunkEmitter'
import { createExtendedLibManager } from './extendedLib'
import { createJsonEmitManager } from './jsonEmit'
import { createEntryLoader } from './loadEntry'
import { createEntryNormalizer } from './normalizer'
import { createTemplateScanner } from './template'

export { type JsonEmitFileEntry } from './jsonEmit'

type HmrSharedChunksMode = 'full' | 'auto' | 'off'
type DirtyEntryReason = 'direct' | 'dependency'

interface HmrOptions {
  sharedChunks?: HmrSharedChunksMode
  sharedChunkImporters?: Map<string, Set<string>>
  sharedChunksByEntry?: Map<string, Set<string>>
  setDidEmitAllEntries?: (value: boolean) => void
  setLastEmittedEntries?: (entryIds: Set<string>) => void
}

interface PendingEntryResolution {
  pending: Set<string>
  sharedChunkResolveMs?: number
  pendingReasonSummary?: string[]
}

function resolveUpstreamPendingReasonSummary(dirtyReasonSummary?: string[]) {
  if (!dirtyReasonSummary?.length) {
    return []
  }

  const pendingReasonSummary: string[] = []
  const hasLayoutFallback = dirtyReasonSummary.some(item => item.startsWith('layout-fallback-full:'))
  const hasLayoutPropagation = dirtyReasonSummary.some(item => item.startsWith('layout-self:') || item.startsWith('layout-dependent:'))
  const hasAutoRoutesTopology = dirtyReasonSummary.some(item => item.startsWith('auto-routes-topology:'))

  if (hasLayoutFallback) {
    pendingReasonSummary.push('layout-fallback-full')
  }
  else if (hasLayoutPropagation) {
    pendingReasonSummary.push('layout-propagation')
  }

  if (hasAutoRoutesTopology) {
    pendingReasonSummary.push('auto-routes-topology')
  }

  return pendingReasonSummary
}

function resolvePendingEntryIds(options: {
  isDev: boolean
  mode: HmrSharedChunksMode
  resolvedEntryMap: Map<string, ResolvedId>
  dirtyEntrySet: Set<string>
  dirtyEntryReasons: Map<string, DirtyEntryReason>
  dirtyReasonSummary?: string[]
  sharedChunkImporters?: Map<string, Set<string>>
  sharedChunksByEntry?: Map<string, Set<string>>
  subPackageRoots?: Set<string>
  relativeAbsoluteSrcRoot?: (id: string) => string
}): PendingEntryResolution {
  const pending = new Set(options.dirtyEntrySet)
  const pendingReasonSummary = resolveUpstreamPendingReasonSummary(options.dirtyReasonSummary)

  if (options.mode === 'full') {
    return {
      pending: new Set(options.resolvedEntryMap.keys()),
      pendingReasonSummary: ['full-rebuild', ...pendingReasonSummary],
    }
  }

  if (!options.isDev || options.mode === 'off') {
    return {
      pending,
      pendingReasonSummary,
    }
  }

  if (!options.sharedChunkImporters?.size || !options.sharedChunksByEntry?.size) {
    return {
      pending,
      pendingReasonSummary,
    }
  }

  const startedAt = performance.now()
  const relatedChunkIds = new Set<string>()
  for (const entryId of options.dirtyEntrySet) {
    const chunkIds = options.sharedChunksByEntry.get(entryId)
    if (!chunkIds?.size) {
      continue
    }
    for (const chunkId of chunkIds) {
      relatedChunkIds.add(chunkId)
    }
  }

  if (!relatedChunkIds.size) {
    return {
      pending,
      sharedChunkResolveMs: performance.now() - startedAt,
      pendingReasonSummary,
    }
  }

  const expandedImporters = new Set<string>()
  let expansionMode: DirtyEntryReason | 'mixed' | null = null
  for (const chunkId of relatedChunkIds) {
    const importers = options.sharedChunkImporters.get(chunkId)
    if (!importers) {
      continue
    }
    if (importers.size <= 1) {
      continue
    }
    let hasDependencyDrivenImporter = false
    let hasDirectDirtyImporter = false
    for (const importer of importers) {
      if (options.dirtyEntrySet.has(importer) && options.dirtyEntryReasons.get(importer) === 'dependency') {
        hasDependencyDrivenImporter = true
        break
      }
      if (options.dirtyEntrySet.has(importer) && options.dirtyEntryReasons.get(importer) === 'direct') {
        hasDirectDirtyImporter = true
      }
    }
    if (!hasDependencyDrivenImporter && !hasDirectDirtyImporter) {
      continue
    }
    if (hasDependencyDrivenImporter && hasDirectDirtyImporter) {
      expansionMode = 'mixed'
    }
    else if (hasDependencyDrivenImporter) {
      expansionMode = expansionMode && expansionMode !== 'dependency' ? 'mixed' : 'dependency'
    }
    else if (hasDirectDirtyImporter) {
      expansionMode = expansionMode && expansionMode !== 'direct' ? 'mixed' : 'direct'
    }
    for (const importer of importers) {
      if (!pending.has(importer)) {
        expandedImporters.add(importer)
      }
      pending.add(importer)
    }
  }

  if (expandedImporters.size > 0) {
    const chunkPreview = [...relatedChunkIds].slice(0, 2).map(chunkId => chunkId.split('/').at(-1)).join(',')
    const overflow = relatedChunkIds.size > 2 ? '+' : ''
    const mode = expansionMode ? `:${expansionMode}` : ''
    pendingReasonSummary.push(`shared-chunk(${chunkPreview}${overflow})+${expandedImporters.size}${mode}`)
  }

  return {
    pending,
    sharedChunkResolveMs: performance.now() - startedAt,
    pendingReasonSummary,
  }
}

export function useLoadEntry(
  ctx: CompilerContext,
  options?: {
    buildTarget?: BuildTarget
    hmr?: HmrOptions
  },
) {
  const debug = createDebugger('weapp-vite:load-entry')
  const buildTarget = options?.buildTarget ?? 'app'

  const entriesMap = ctx.runtimeState.build.hmr.entriesMap as Map<string, Entry | undefined>
  const loadedEntrySet = ctx.runtimeState.build.hmr.loadedEntrySet
  const dirtyEntrySet = ctx.runtimeState.build.hmr.dirtyEntrySet
  const dirtyEntryReasons = ctx.runtimeState.build.hmr.dirtyEntryReasons as Map<string, DirtyEntryReason>
  const resolvedEntryMap = ctx.runtimeState.build.hmr.resolvedEntryMap as Map<string, ResolvedId>
  const layoutEntryDependents = ctx.runtimeState.build.hmr.layoutEntryDependents
  const entryLayoutDependencies = ctx.runtimeState.build.hmr.entryLayoutDependencies
  const lastActualEmittedEntryIds = new Set<string>()

  const jsonEmitManager = createJsonEmitManager(ctx.configService)
  const registerJsonAsset = jsonEmitManager.register.bind(jsonEmitManager)

  const normalizeEntry = createEntryNormalizer(ctx.configService)
  const scanTemplateEntry = createTemplateScanner(ctx.wxmlService, debug)
  const emitEntriesChunks = createChunkEmitter(
    ctx.configService,
    loadedEntrySet,
    debug,
    (entryId) => {
      lastActualEmittedEntryIds.add(entryId)
    },
  )
  const applyAutoImports = createAutoImportAugmenter(ctx.autoImportService, ctx.wxmlService)
  const extendedLibManager = createExtendedLibManager()

  const loadEntry = createEntryLoader({
    ctx,
    entriesMap,
    loadedEntrySet,
    dirtyEntrySet,
    resolvedEntryMap,
    replaceLayoutDependencies(entryId: string, dependencies: Iterable<string>) {
      const previousDependencies = entryLayoutDependencies.get(entryId)
      if (previousDependencies) {
        for (const dependency of previousDependencies) {
          const dependents = layoutEntryDependents.get(dependency)
          if (!dependents) {
            continue
          }
          dependents.delete(entryId)
          if (dependents.size === 0) {
            layoutEntryDependents.delete(dependency)
          }
        }
      }

      const normalizedDependencies = new Set(dependencies)
      if (normalizedDependencies.size === 0) {
        entryLayoutDependencies.delete(entryId)
        return
      }

      entryLayoutDependencies.set(entryId, normalizedDependencies)
      for (const dependency of normalizedDependencies) {
        let dependents = layoutEntryDependents.get(dependency)
        if (!dependents) {
          dependents = new Set<string>()
          layoutEntryDependents.set(dependency, dependents)
        }
        dependents.add(entryId)
      }
    },
    normalizeEntry,
    registerJsonAsset,
    scanTemplateEntry,
    emitEntriesChunks,
    applyAutoImports,
    extendedLibManager,
    buildTarget,
    debug,
  })

  const hmrSharedChunksMode = options?.hmr?.sharedChunks ?? 'auto'
  const hmrSharedChunkImporters = options?.hmr?.sharedChunkImporters
  const hmrSharedChunksByEntry = options?.hmr?.sharedChunksByEntry

  return {
    loadEntry,
    entriesMap,
    loadedEntrySet,
    dirtyEntrySet,
    resolvedEntryMap,
    layoutEntryDependents,
    jsonEmitFilesMap: jsonEmitManager.map,
    normalizeEntry,
    markEntryDirty(entryId: string, reason: DirtyEntryReason = 'direct') {
      dirtyEntrySet.add(entryId)
      dirtyEntryReasons.set(entryId, reason)
      loadedEntrySet.delete(entryId)
    },
    async emitDirtyEntries(this: PluginContext) {
      if (!dirtyEntrySet.size) {
        options?.hmr?.setDidEmitAllEntries?.(false)
        options?.hmr?.setLastEmittedEntries?.(new Set())
        return
      }

      const emitStartedAt = performance.now()
      const dirtyCount = dirtyEntrySet.size
      const pendingResolution = resolvePendingEntryIds({
        isDev: Boolean(ctx.configService?.isDev),
        mode: hmrSharedChunksMode,
        resolvedEntryMap,
        dirtyEntrySet,
        dirtyEntryReasons,
        dirtyReasonSummary: ctx.runtimeState.build.hmr.profile.dirtyReasonSummary,
        sharedChunkImporters: hmrSharedChunkImporters,
        sharedChunksByEntry: hmrSharedChunksByEntry,
        subPackageRoots: new Set(ctx.scanService?.subPackageMap?.keys?.() ?? []),
        relativeAbsoluteSrcRoot: ctx.configService.relativeAbsoluteSrcRoot.bind(ctx.configService),
      })
      const pendingEntryIds = pendingResolution.pending
      const pending: ResolvedId[] = []
      lastActualEmittedEntryIds.clear()

      for (const entryId of pendingEntryIds) {
        const resolvedId = resolvedEntryMap.get(entryId)
        if (!resolvedId) {
          continue
        }
        pending.push(resolvedId)
        dirtyEntrySet.delete(entryId)
        dirtyEntryReasons.delete(entryId)
      }

      if (pending.length) {
        await Promise.all(emitEntriesChunks.call(this, pending))
      }

      const actualEmittedEntryIds = new Set(lastActualEmittedEntryIds)
      const shouldEmitAllEntries = actualEmittedEntryIds.size > 0 && actualEmittedEntryIds.size === resolvedEntryMap.size
      options?.hmr?.setDidEmitAllEntries?.(shouldEmitAllEntries)
      options?.hmr?.setLastEmittedEntries?.(actualEmittedEntryIds)
      ctx.runtimeState.build.hmr.profile = {
        ...ctx.runtimeState.build.hmr.profile,
        emitMs: performance.now() - emitStartedAt,
        sharedChunkResolveMs: pendingResolution.sharedChunkResolveMs,
        dirtyCount,
        pendingCount: pending.length,
        emittedCount: actualEmittedEntryIds.size,
        pendingReasonSummary: pendingResolution.pendingReasonSummary,
      }

      if (debug) {
        debug(`hmr emit dirty=${dirtyCount} resolved=${resolvedEntryMap.size} emitAll=${shouldEmitAllEntries} pending=${pending.length}`)
      }
    },
  }
}
