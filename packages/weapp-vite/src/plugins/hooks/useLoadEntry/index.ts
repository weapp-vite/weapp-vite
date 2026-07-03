import type { PluginContext, ResolvedId } from 'rolldown'
import type { BuildTarget, CompilerContext } from '../../../context'
import type { Entry } from '../../../types'
import { removeExtensionDeep } from '@weapp-core/shared'
import { supportedCssLangs, vueExtensions } from '../../../constants'
import { createDebugger } from '../../../debugger'
import { changeFileExtension } from '../../../utils'
import { recordHmrProfileDuration } from '../../../utils/hmrProfile'
import { normalizeFsResolvedId } from '../../../utils/resolvedId'
import { createAutoImportAugmenter } from './autoImport'
import { createChunkEmitter } from './chunkEmitter'
import { createExtendedLibManager } from './extendedLib'
import { createJsonEmitManager } from './jsonEmit'
import { createEntryLoader } from './loadEntry'
import { createEntryNormalizer } from './normalizer'
import { createTemplateScanner } from './template'

export { type JsonEmitFileEntry } from './jsonEmit'

type HmrSharedChunksMode = 'full' | 'auto' | 'off'
type DirtyEntryReason = 'direct' | 'dependency' | 'metadata'
interface HmrOptions {
  sharedChunks?: HmrSharedChunksMode
  sharedChunkImporters?: Map<string, Set<string>>
  sharedChunksByEntry?: Map<string, Set<string>>
  sourceSharedChunks?: Set<string>
  entryLayoutDependencies?: Map<string, Set<string>>
  setDidEmitAllEntries?: (value: boolean) => void
  setLastEmittedEntries?: (entryIds: Set<string>) => void
  setLastHmrEntries?: (entryIds: Set<string>) => void
  setSkipSharedChunkRefresh?: (value: boolean) => void
  rootInputIds?: Set<string>
}

interface PendingEntryResolution {
  pending: Set<string>
  hmrEntries?: Set<string>
  sharedChunkResolveMs?: number
  pendingReasonSummary?: string[]
  shouldEmitAllEntries?: boolean
  forceFullSharedChunkRefresh?: boolean
}

interface ChunkEmitStatsSummary {
  chunkEmitCount: number
  emitFileMs: number
  loadCount: number
  loadMs: number
  skippedLoadedCount: number
}

function shouldExpandStableSharedChunk(chunkId: string, importers?: Set<string>) {
  if ((importers?.size ?? 0) <= 1) {
    return false
  }

  return chunkId.startsWith('weapp-vendors/')
    || (!chunkId.includes('/') && chunkId !== 'app.js')
}

function resolveUpstreamPendingReasonSummary(dirtyReasonSummary?: string[]) {
  if (!dirtyReasonSummary?.length) {
    return []
  }

  const pendingReasonSummary: string[] = []
  const hasLayoutFallback = dirtyReasonSummary.some(item => item.startsWith('layout-fallback-full:'))
  const hasLayoutPropagation = dirtyReasonSummary.some(item => item.startsWith('layout-self:') || item.startsWith('layout-dependent:'))
  const hasAutoRoutesTopology = dirtyReasonSummary.some(item => item.startsWith('auto-routes-topology:'))
  const hasConfigRestart = dirtyReasonSummary.some(item => item.startsWith('config-restart:'))

  if (hasConfigRestart) {
    pendingReasonSummary.push('config-restart')
  }

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

function isEntryAutoRoutesRefresh(dirtyReasonSummary?: string[]) {
  return dirtyReasonSummary?.some(item => item.startsWith('entry-auto-routes:')) === true
}

function isSharedChunkSourceRepresentativeRefresh(dirtyReasonSummary?: string[]) {
  return Boolean(
    dirtyReasonSummary?.length
    && dirtyReasonSummary.some(item => item.startsWith('shared-chunk-source:'))
    && dirtyReasonSummary.every(item =>
      item.startsWith('shared-chunk-source:')
      || item.startsWith('tailwind-content:'),
    ),
  )
}

function isCssImporterOnlyRefresh(dirtyReasonSummary?: string[]) {
  return Boolean(
    dirtyReasonSummary?.length
    && dirtyReasonSummary.every(item =>
      item.startsWith('css-importer:')
      || item.startsWith('css-importer-fallback:'),
    ),
  )
}

function isWxmlImportOnlyRefresh(dirtyReasonSummary?: string[]) {
  return Boolean(
    dirtyReasonSummary?.length
    && dirtyReasonSummary.every(item => item.startsWith('wxml-importer-import:')),
  )
}

function isVueEntryId(entryId: string) {
  return vueExtensions.some(ext => entryId.endsWith(`.${ext}`))
}

function resolveCssImporterRepresentative(
  pending: Set<string>,
  resolvedEntryMap: Map<string, ResolvedId>,
  rootInputIds?: Set<string>,
) {
  let fallback: string | undefined
  let nonRootFallback: string | undefined
  for (const entryId of pending) {
    if (!resolvedEntryMap.has(entryId)) {
      continue
    }
    const isRootInput = rootInputIds?.has(entryId) === true
    if (!fallback) {
      fallback = entryId
    }
    if (!isRootInput && !nonRootFallback) {
      nonRootFallback = entryId
    }
    if (!isRootInput && !isVueEntryId(entryId)) {
      return entryId
    }
  }
  return nonRootFallback ?? fallback
}

function resolveSharedChunkRepresentative(
  importers: Set<string>,
  pending: Set<string>,
  resolvedEntryMap: Map<string, ResolvedId>,
) {
  let resolvedRepresentative: string | undefined
  for (const entryId of importers) {
    if (pending.has(entryId)) {
      return entryId
    }
    if (!resolvedRepresentative && resolvedEntryMap.has(entryId)) {
      resolvedRepresentative = entryId
    }
  }
  return resolvedRepresentative
}

function previewChunkIds(chunkIds: Set<string>) {
  const preview: string[] = []
  for (const chunkId of chunkIds) {
    if (preview.length >= 2) {
      break
    }
    const segments = chunkId.split('/')
    preview.push(segments[segments.length - 1]!)
  }
  return {
    label: preview.join(','),
    overflow: chunkIds.size > 2 ? '+' : '',
  }
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
  sourceSharedChunks?: Set<string>
  rootInputIds?: Set<string>
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

  const isRepresentativeOnlyRefresh = isCssImporterOnlyRefresh(options.dirtyReasonSummary)
    || isWxmlImportOnlyRefresh(options.dirtyReasonSummary)
  if (isRepresentativeOnlyRefresh && pending.size > 1) {
    const representative = resolveCssImporterRepresentative(pending, options.resolvedEntryMap, options.rootInputIds)
    if (representative) {
      const reason = isWxmlImportOnlyRefresh(options.dirtyReasonSummary)
        ? 'wxml-importer-import-representative'
        : 'css-importer-representative'
      pendingReasonSummary.push(`${reason}:1/${pending.size}`)
      return {
        pending: new Set([representative]),
        hmrEntries: pending,
        pendingReasonSummary,
      }
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
  const shouldExpandLayoutSharedChunks = pendingReasonSummary.includes('layout-propagation')
    || pendingReasonSummary.includes('layout-fallback-full')

  if (shouldExpandLayoutSharedChunks) {
    for (const chunkId of options.sharedChunkImporters.keys()) {
      relatedChunkIds.add(chunkId)
    }
  }

  for (const entryId of options.dirtyEntrySet) {
    const dirtyReason = options.dirtyEntryReasons.get(entryId)
    if (dirtyReason !== 'dependency' && dirtyReason !== 'direct' && dirtyReason !== 'metadata') {
      continue
    }
    const chunkIds = options.sharedChunksByEntry.get(entryId)
    if (!chunkIds?.size) {
      continue
    }
    for (const chunkId of chunkIds) {
      const isSourceSharedChunk = options.sourceSharedChunks?.has(chunkId) === true
      const isStableSharedChunk = shouldExpandStableSharedChunk(chunkId, options.sharedChunkImporters?.get(chunkId))
      if (dirtyReason === 'metadata') {
        continue
      }
      if (
        dirtyReason === 'dependency'
        || (!isSourceSharedChunk && !isStableSharedChunk)
      ) {
        relatedChunkIds.add(chunkId)
      }
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
  let hasStableSharedChunkExpansion = false
  const representativeImporters = new Set<string>()
  for (const chunkId of relatedChunkIds) {
    const importers = options.sharedChunkImporters.get(chunkId)
    if (!importers) {
      continue
    }
    if (importers.size <= 1 && !shouldExpandLayoutSharedChunks) {
      continue
    }
    let hasDependencyDrivenImporter = false
    let hasDirectDirtyImporter = false
    for (const importer of importers) {
      if (options.dirtyEntrySet.has(importer) && options.dirtyEntryReasons.get(importer) === 'dependency') {
        hasDependencyDrivenImporter = true
        continue
      }
      if (options.dirtyEntrySet.has(importer) && options.dirtyEntryReasons.get(importer) === 'direct') {
        hasDirectDirtyImporter = true
      }
    }
    if (!hasDependencyDrivenImporter && !hasDirectDirtyImporter && !shouldExpandLayoutSharedChunks) {
      continue
    }
    if (shouldExpandStableSharedChunk(chunkId, importers)) {
      hasStableSharedChunkExpansion = true
    }
    if (isSharedChunkSourceRepresentativeRefresh(options.dirtyReasonSummary)) {
      const representative = resolveSharedChunkRepresentative(importers, pending, options.resolvedEntryMap)
      if (representative) {
        representativeImporters.add(representative)
      }
    }
    if (shouldExpandLayoutSharedChunks && !hasDependencyDrivenImporter && !hasDirectDirtyImporter) {
      expansionMode = expansionMode && expansionMode !== 'dependency' ? 'mixed' : 'dependency'
    }
    else if (
      [hasDependencyDrivenImporter, hasDirectDirtyImporter]
        .filter(Boolean)
        .length > 1
    ) {
      expansionMode = 'mixed'
    }
    else if (hasDirectDirtyImporter) {
      expansionMode = expansionMode && expansionMode !== 'direct' ? 'mixed' : 'direct'
    }
    else {
      expansionMode = expansionMode && expansionMode !== 'dependency' ? 'mixed' : 'dependency'
    }
    for (const importer of importers) {
      if (!pending.has(importer)) {
        expandedImporters.add(importer)
      }
      pending.add(importer)
    }
  }

  if (expandedImporters.size > 0) {
    const { label: chunkPreview, overflow } = previewChunkIds(relatedChunkIds)
    const mode = expansionMode ? `:${expansionMode}` : ''
    pendingReasonSummary.push(`shared-chunk(${chunkPreview}${overflow})+${expandedImporters.size}${mode}`)
  }

  if (representativeImporters.size && representativeImporters.size < pending.size) {
    const hmrEntries = new Set(pending)
    const representativePending = new Set<string>()
    for (const entryId of representativeImporters) {
      if (pending.has(entryId)) {
        representativePending.add(entryId)
      }
    }
    if (representativePending.size) {
      pendingReasonSummary.push(`shared-chunk-representative:${representativePending.size}/${hmrEntries.size}`)
      return {
        pending: representativePending,
        hmrEntries,
        sharedChunkResolveMs: performance.now() - startedAt,
        pendingReasonSummary,
      }
    }
  }

  return {
    pending,
    sharedChunkResolveMs: performance.now() - startedAt,
    pendingReasonSummary,
    shouldEmitAllEntries: hasStableSharedChunkExpansion && pending.size === options.resolvedEntryMap.size,
    forceFullSharedChunkRefresh: hasStableSharedChunkExpansion && pending.size === options.resolvedEntryMap.size,
  }
}

function shouldPreloadEntryAssetOnly(dirtyReasonSummary?: string[]) {
  return dirtyReasonSummary?.some(item =>
    item.startsWith('json-sidecar:')
    || item.startsWith('style-sidecar:')
    || item.startsWith('entry-style-only:')
    || item.startsWith('entry-local-asset:')
    || item.startsWith('wxml-importer-import:'),
  ) === true
}

function resolveCurrentStyleOutputFileName(ctx: CompilerContext) {
  const currentFile = ctx.runtimeState.build.hmr.profile.file
  if (typeof currentFile !== 'string') {
    return undefined
  }
  const normalizedFile = normalizeFsResolvedId(currentFile)
  if (!supportedCssLangs.some(ext => normalizedFile.endsWith(`.${ext}`))) {
    return undefined
  }
  return ctx.configService.relativeOutputPath(
    changeFileExtension(normalizedFile, ctx.configService.outputExtensions.wxss),
  )
}

function createChunkEmitStatsSummary(): ChunkEmitStatsSummary {
  return {
    chunkEmitCount: 0,
    emitFileMs: 0,
    loadCount: 0,
    loadMs: 0,
    skippedLoadedCount: 0,
  }
}

function addChunkEmitStatsSummary(
  target: ChunkEmitStatsSummary,
  source: ChunkEmitStatsSummary,
) {
  target.chunkEmitCount += source.chunkEmitCount
  target.emitFileMs += source.emitFileMs
  target.loadCount += source.loadCount
  target.loadMs += source.loadMs
  target.skippedLoadedCount += source.skippedLoadedCount
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
  const dirtyEntryEventIds = new Map<string, string | undefined>()
  const resolvedEntryMap = ctx.runtimeState.build.hmr.resolvedEntryMap as Map<string, ResolvedId>
  const layoutEntryDependents = ctx.runtimeState.build.hmr.layoutEntryDependents
  const entryLayoutDependencies = ctx.runtimeState.build.hmr.entryLayoutDependencies
  const lastActualEmittedEntryIds = new Set<string>()
  const lastChunkEmittedEntryIds = new Set<string>()
  const lastEmittedChunkFileNames = ctx.runtimeState.build.hmr.lastEmittedChunkFileNames ??= new Set<string>()
  const metadataEntryIds = new Set<string>()
  const rootInputIds = options?.hmr?.rootInputIds
  const chunkEmitStats = createChunkEmitStatsSummary()
  const addLastEmittedChunkFileName = (entryId: string) => {
    lastEmittedChunkFileNames.add(changeFileExtension(ctx.configService.relativeOutputPath(entryId), '.js'))
    if (rootInputIds?.has(entryId)) {
      lastEmittedChunkFileNames.add(changeFileExtension(ctx.configService.relativeAbsoluteSrcRoot(entryId), '.js'))
    }
  }

  const jsonEmitManager = createJsonEmitManager(ctx.configService)
  const registerJsonAsset = jsonEmitManager.register.bind(jsonEmitManager)

  const normalizeEntry = createEntryNormalizer(ctx.configService)
  const scanTemplateEntry = createTemplateScanner(ctx.wxmlService, debug)
  let loadEntry: ReturnType<typeof createEntryLoader>
  const emitEntriesChunks = createChunkEmitter(
    ctx.configService,
    loadedEntrySet,
    debug,
    (entryId) => {
      if (rootInputIds?.has(entryId)) {
        addLastEmittedChunkFileName(entryId)
        if (!metadataEntryIds.has(entryId)) {
          lastChunkEmittedEntryIds.add(entryId)
        }
      }
      lastActualEmittedEntryIds.add(entryId)
    },
    (entryId) => {
      lastChunkEmittedEntryIds.add(entryId)
    },
    entryId => !rootInputIds?.has(entryId)
      && !metadataEntryIds.has(entryId)
      && !lastChunkEmittedEntryIds.has(entryId),
    async function preloadAssetOnlyEntry(resolvedId, entryId) {
      if (rootInputIds?.has(entryId)) {
        await loadEntry.call(this, resolvedId.id, 'app')
        await this.load(resolvedId)
        return
      }
      if (!shouldPreloadEntryAssetOnly(ctx.runtimeState.build.hmr.profile.dirtyReasonSummary)) {
        await this.load(resolvedId)
        return
      }
      const entryType = entriesMap.get(entryId)?.type === 'page' ? 'page' : 'component'
      await loadEntry.call(this, resolvedId.id, entryType)
    },
    (fileName) => {
      lastEmittedChunkFileNames.add(fileName)
    },
    stats => addChunkEmitStatsSummary(chunkEmitStats, stats),
  )
  const applyAutoImports = createAutoImportAugmenter(
    ctx.autoImportService,
    ctx.wxmlService,
    ctx.runtimeState.build.hmr.externalComponentEntryMap,
  )
  const extendedLibManager = createExtendedLibManager()

  loadEntry = createEntryLoader({
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
  const clearDirtyEntry = (entryId: string) => {
    dirtyEntrySet.delete(entryId)
    dirtyEntryReasons.delete(entryId)
    dirtyEntryEventIds.delete(entryId)
  }

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
      dirtyEntryEventIds.set(entryId, ctx.runtimeState.build.hmr.profile.eventId)
      const previous = dirtyEntryReasons.get(entryId)
      const nextReason = previous === 'dependency' || reason === 'dependency'
        ? 'dependency'
        : previous === 'direct' || reason === 'direct'
          ? 'direct'
          : reason
      dirtyEntryReasons.set(entryId, nextReason)
      loadedEntrySet.delete(entryId)
    },
    async emitDirtyEntries(this: PluginContext) {
      if (!dirtyEntrySet.size) {
        options?.hmr?.setDidEmitAllEntries?.(false)
        options?.hmr?.setLastEmittedEntries?.(new Set())
        options?.hmr?.setLastHmrEntries?.(new Set())
        options?.hmr?.setSkipSharedChunkRefresh?.(true)
        return
      }

      const emitStartedAt = performance.now()
      const currentEventId = ctx.runtimeState.build.hmr.profile.eventId
      const activeDirtyEntrySet = currentEventId
        ? new Set([...dirtyEntrySet].filter((entryId) => {
            const eventId = dirtyEntryEventIds.get(entryId)
            return eventId === undefined || eventId === currentEventId
          }))
        : dirtyEntrySet
      if (!activeDirtyEntrySet.size) {
        options?.hmr?.setDidEmitAllEntries?.(false)
        options?.hmr?.setLastEmittedEntries?.(new Set())
        options?.hmr?.setLastHmrEntries?.(new Set())
        options?.hmr?.setSkipSharedChunkRefresh?.(true)
        return
      }
      const dirtyCount = activeDirtyEntrySet.size
      const pendingResolution = resolvePendingEntryIds({
        isDev: Boolean(ctx.configService?.isDev),
        mode: hmrSharedChunksMode,
        resolvedEntryMap,
        dirtyEntrySet: activeDirtyEntrySet,
        dirtyEntryReasons,
        dirtyReasonSummary: ctx.runtimeState.build.hmr.profile.dirtyReasonSummary,
        sharedChunkImporters: hmrSharedChunkImporters,
        sharedChunksByEntry: hmrSharedChunksByEntry,
        sourceSharedChunks: options?.hmr?.sourceSharedChunks,
        rootInputIds,
      })
      const pendingEntryIds = pendingResolution.pending
      const pending: ResolvedId[] = []
      chunkEmitStats.chunkEmitCount = 0
      chunkEmitStats.emitFileMs = 0
      chunkEmitStats.loadCount = 0
      chunkEmitStats.loadMs = 0
      chunkEmitStats.skippedLoadedCount = 0
      lastActualEmittedEntryIds.clear()
      lastChunkEmittedEntryIds.clear()
      lastEmittedChunkFileNames.clear()
      metadataEntryIds.clear()
      const pendingMetadataEntryIds = new Set<string>()
      const deferredDirtyEntryIds = new Set<string>()

      for (const entryId of pendingEntryIds) {
        const reason = dirtyEntryReasons.get(entryId)
        if (reason === 'metadata') {
          metadataEntryIds.add(entryId)
          pendingMetadataEntryIds.add(entryId)
        }
        if (rootInputIds?.has(entryId)) {
          deferredDirtyEntryIds.add(entryId)
        }
        else {
          clearDirtyEntry(entryId)
        }
        const resolvedId = resolvedEntryMap.get(entryId)
        if (!resolvedId) {
          continue
        }
        pending.push(resolvedId)
      }

      for (const resolvedId of pending) {
        const baseName = removeExtensionDeep(resolvedId.id)
        if (!ctx.runtimeState.autoImport?.pendingEntriesByImporter.has(baseName)) {
          continue
        }
        const entryType = entriesMap.get(ctx.configService.relativeAbsoluteSrcRoot(baseName))?.type === 'component'
          ? 'component'
          : 'page'
        await loadEntry.call(this, resolvedId.id, entryType)
      }

      if (pending.length) {
        const entryChunkEmitStartedAt = performance.now()
        try {
          await Promise.all(emitEntriesChunks.call(this, pending))
        }
        finally {
          recordHmrProfileDuration(
            ctx.runtimeState?.build?.hmr?.profile,
            'entryChunkEmitMs',
            performance.now() - entryChunkEmitStartedAt,
          )
        }
      }
      for (const entryId of deferredDirtyEntryIds) {
        clearDirtyEntry(entryId)
      }
      for (const entryId of activeDirtyEntrySet) {
        clearDirtyEntry(entryId)
      }

      const actualEmittedEntryIds = new Set(lastActualEmittedEntryIds)
      const actualChunkEmittedEntryIds = new Set(lastChunkEmittedEntryIds)
      for (const entryId of actualEmittedEntryIds) {
        if (!rootInputIds?.has(entryId)) {
          continue
        }
        addLastEmittedChunkFileName(entryId)
      }
      if (isEntryAutoRoutesRefresh(ctx.runtimeState.build.hmr.profile.dirtyReasonSummary)) {
        for (const entryId of actualChunkEmittedEntryIds) {
          addLastEmittedChunkFileName(entryId)
        }
      }
      let hmrEntryIds = new Set(actualEmittedEntryIds)
      if (pendingResolution.hmrEntries) {
        hmrEntryIds = pendingResolution.hmrEntries
      }
      if (shouldPreloadEntryAssetOnly(ctx.runtimeState.build.hmr.profile.dirtyReasonSummary)) {
        if (!isWxmlImportOnlyRefresh(ctx.runtimeState.build.hmr.profile.dirtyReasonSummary) || !pendingResolution.hmrEntries) {
          hmrEntryIds = new Set(pendingMetadataEntryIds)
          for (const entryId of actualChunkEmittedEntryIds) {
            if (pendingEntryIds.has(entryId) && !metadataEntryIds.has(entryId)) {
              hmrEntryIds.add(entryId)
            }
          }
        }
        const currentStyleOutputFileName = resolveCurrentStyleOutputFileName(ctx)
        if (currentStyleOutputFileName) {
          lastEmittedChunkFileNames.add(currentStyleOutputFileName)
        }
      }
      const skipSharedChunkRefresh = actualChunkEmittedEntryIds.size === 0
      const shouldEmitAllEntries = actualChunkEmittedEntryIds.size > 0 && (
        actualEmittedEntryIds.size === resolvedEntryMap.size
        || pendingResolution.shouldEmitAllEntries === true
      )
      options?.hmr?.setDidEmitAllEntries?.(shouldEmitAllEntries)
      options?.hmr?.setLastEmittedEntries?.(
        pendingResolution.forceFullSharedChunkRefresh === true
          ? new Set(resolvedEntryMap.keys())
          : actualChunkEmittedEntryIds,
      )
      options?.hmr?.setLastHmrEntries?.(hmrEntryIds)
      options?.hmr?.setSkipSharedChunkRefresh?.(skipSharedChunkRefresh)
      ctx.runtimeState.build.hmr.profile = {
        ...ctx.runtimeState.build.hmr.profile,
        emitMs: performance.now() - emitStartedAt,
        sharedChunkResolveMs: pendingResolution.sharedChunkResolveMs,
        entryChunkLoadMs: chunkEmitStats.loadMs,
        entryChunkEmitFileMs: chunkEmitStats.emitFileMs,
        chunkEmitCount: chunkEmitStats.chunkEmitCount,
        loadCount: chunkEmitStats.loadCount,
        skippedLoadedCount: chunkEmitStats.skippedLoadedCount,
        dirtyCount,
        pendingCount: pending.length,
        emittedCount: hmrEntryIds.size,
        pendingReasonSummary: pendingResolution.pendingReasonSummary,
      }

      if (debug) {
        debug(`hmr emit dirty=${dirtyCount} resolved=${resolvedEntryMap.size} emitAll=${shouldEmitAllEntries} pending=${pending.length}`)
      }
    },
  }
}
