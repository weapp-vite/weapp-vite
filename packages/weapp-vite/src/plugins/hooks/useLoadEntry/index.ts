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

export function useLoadEntry(ctx: CompilerContext, options?: { buildTarget?: BuildTarget }) {
  const debug = createDebugger('weapp-vite:load-entry')
  const buildTarget = options?.buildTarget ?? 'app'

  const entriesMap = new Map<string, Entry | undefined>()
  const loadedEntrySet = new Set<string>()
  const dirtyEntrySet = new Set<string>()

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
    normalizeEntry,
    registerJsonAsset,
    scanTemplateEntry,
    emitEntriesChunks,
    applyAutoImports,
    extendedLibManager,
    buildTarget,
    debug,
  })

  return {
    loadEntry,
    entriesMap,
    loadedEntrySet,
    dirtyEntrySet,
    jsonEmitFilesMap: jsonEmitManager.map,
    normalizeEntry,
    markEntryDirty(entryId: string) {
      dirtyEntrySet.add(entryId)
    },
  }
}
