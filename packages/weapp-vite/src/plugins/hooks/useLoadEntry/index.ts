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
  setDidEmitAllEntries?: (value: boolean) => void
  setLastEmittedEntries?: (entryIds: Set<string>) => void
}

function resolvePendingEntryIds(options: {
  isDev: boolean
  mode: HmrSharedChunksMode
  resolvedEntryMap: Map<string, ResolvedId>
  dirtyEntrySet: Set<string>
  dirtyEntryReasons: Map<string, DirtyEntryReason>
  sharedChunkImporters?: Map<string, Set<string>>
  subPackageRoots?: Set<string>
  relativeAbsoluteSrcRoot?: (id: string) => string
}) {
  const pending = new Set(options.dirtyEntrySet)

  if (options.mode === 'full') {
    return new Set(options.resolvedEntryMap.keys())
  }

  if (!options.isDev || options.mode === 'off') {
    return pending
  }

  if (!options.sharedChunkImporters?.size) {
    return pending
  }

  for (const importers of options.sharedChunkImporters.values()) {
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
    for (const importer of importers) {
      pending.add(importer)
    }
  }

  return pending
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

  const entriesMap = new Map<string, Entry | undefined>()
  const loadedEntrySet = new Set<string>()
  const dirtyEntrySet = new Set<string>()
  const dirtyEntryReasons = new Map<string, DirtyEntryReason>()
  const resolvedEntryMap = new Map<string, ResolvedId>()
  const layoutEntryDependents = new Map<string, Set<string>>()
  const entryLayoutDependencies = new Map<string, Set<string>>()
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

      const dirtyCount = dirtyEntrySet.size
      const pendingEntryIds = resolvePendingEntryIds({
        isDev: Boolean(ctx.configService?.isDev),
        mode: hmrSharedChunksMode,
        resolvedEntryMap,
        dirtyEntrySet,
        dirtyEntryReasons,
        sharedChunkImporters: hmrSharedChunkImporters,
        subPackageRoots: new Set(ctx.scanService?.subPackageMap?.keys?.() ?? []),
        relativeAbsoluteSrcRoot: ctx.configService.relativeAbsoluteSrcRoot.bind(ctx.configService),
      })
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

      if (debug) {
        debug(`hmr emit dirty=${dirtyCount} resolved=${resolvedEntryMap.size} emitAll=${shouldEmitAllEntries} pending=${pending.length}`)
      }
    },
  }
}
