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

interface HmrOptions {
  sharedChunks?: HmrSharedChunksMode
  sharedChunkImporters?: Map<string, Set<string>>
  setDidEmitAllEntries?: (value: boolean) => void
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
  const resolvedEntryMap = new Map<string, ResolvedId>()

  const jsonEmitManager = createJsonEmitManager(ctx.configService)
  const registerJsonAsset = jsonEmitManager.register.bind(jsonEmitManager)

  const normalizeEntry = createEntryNormalizer(ctx.configService)
  const scanTemplateEntry = createTemplateScanner(ctx.wxmlService, debug)
  const emitEntriesChunks = createChunkEmitter(ctx.configService, loadedEntrySet, debug)
  const applyAutoImports = createAutoImportAugmenter(ctx.autoImportService, ctx.wxmlService)
  const extendedLibManager = createExtendedLibManager()

  const loadEntry = createEntryLoader({
    ctx,
    entriesMap,
    loadedEntrySet,
    dirtyEntrySet,
    resolvedEntryMap,
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
    jsonEmitFilesMap: jsonEmitManager.map,
    normalizeEntry,
    markEntryDirty(entryId: string) {
      dirtyEntrySet.add(entryId)
      loadedEntrySet.delete(entryId)
    },
    async emitDirtyEntries(this: PluginContext) {
      if (!dirtyEntrySet.size) {
        options?.hmr?.setDidEmitAllEntries?.(false)
        return
      }

      const dirtyCount = dirtyEntrySet.size
      const pending: ResolvedId[] = []
      const shouldEmitAllEntries = resolveShouldEmitAllEntries({
        isDev: Boolean(ctx.configService?.isDev),
        mode: hmrSharedChunksMode,
        dirtyEntrySet,
        resolvedEntryMap,
        sharedChunkImporters: hmrSharedChunkImporters,
      })
      options?.hmr?.setDidEmitAllEntries?.(shouldEmitAllEntries)

      if (shouldEmitAllEntries) {
        const seen = new Set<string>()
        for (const resolvedId of resolvedEntryMap.values()) {
          if (!resolvedId) {
            continue
          }
          const key = resolvedId.id
          if (seen.has(key)) {
            continue
          }
          seen.add(key)
          pending.push(resolvedId)
        }
        dirtyEntrySet.clear()
      }
      else {
        for (const entryId of Array.from(dirtyEntrySet)) {
          const resolvedId = resolvedEntryMap.get(entryId)
          if (!resolvedId) {
            continue
          }
          pending.push(resolvedId)
          dirtyEntrySet.delete(entryId)
        }
      }

      if (debug) {
        debug(`hmr emit dirty=${dirtyCount} resolved=${resolvedEntryMap.size} emitAll=${shouldEmitAllEntries} pending=${pending.length}`)
      }

      if (pending.length) {
        await Promise.all(emitEntriesChunks.call(this, pending))
      }
    },
  }
}

function resolveShouldEmitAllEntries(options: {
  isDev: boolean
  mode: HmrSharedChunksMode
  dirtyEntrySet: Set<string>
  resolvedEntryMap: Map<string, ResolvedId>
  sharedChunkImporters?: Map<string, Set<string>>
}) {
  if (!options.isDev || options.resolvedEntryMap.size === 0) {
    return false
  }

  if (options.mode === 'full') {
    return true
  }

  if (options.mode === 'off') {
    return false
  }

  if (!options.sharedChunkImporters) {
    return true
  }

  if (options.sharedChunkImporters.size === 0) {
    return false
  }

  for (const importers of options.sharedChunkImporters.values()) {
    if (importers.size <= 1) {
      continue
    }
    let dirtyCount = 0
    for (const importer of importers) {
      if (options.dirtyEntrySet.has(importer)) {
        dirtyCount += 1
      }
    }
    if (dirtyCount > 0 && dirtyCount < importers.size) {
      return true
    }
  }

  return false
}
