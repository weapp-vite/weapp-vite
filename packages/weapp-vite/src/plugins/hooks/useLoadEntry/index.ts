import type { CompilerContext } from '../../../context'
import type { Entry } from '../../../types'
import { createDebugger } from '../../../debugger'
import { createAutoImportAugmenter } from './autoImport'
import { createChunkEmitter } from './chunkEmitter'
import { createJsonEmitManager } from './jsonEmit'
import { createEntryLoader } from './loadEntry'
import { createEntryNormalizer } from './normalizer'
import { createTemplateScanner } from './template'

export { type JsonEmitFileEntry } from './jsonEmit'

export function useLoadEntry(ctx: CompilerContext) {
  const debug = createDebugger('weapp-vite:load-entry')

  const entriesMap = new Map<string, Entry | undefined>()
  const loadedEntrySet = new Set<string>()

  const jsonEmitManager = createJsonEmitManager(ctx.configService)
  const registerJsonAsset = jsonEmitManager.register.bind(jsonEmitManager)

  const normalizeEntry = createEntryNormalizer(ctx.configService)
  const scanTemplateEntry = createTemplateScanner(ctx.wxmlService, debug)
  const emitEntriesChunks = createChunkEmitter(ctx.configService, loadedEntrySet, debug)
  const applyAutoImports = createAutoImportAugmenter(ctx.autoImportService, ctx.wxmlService)

  const loadEntry = createEntryLoader({
    ctx,
    entriesMap,
    loadedEntrySet,
    normalizeEntry,
    registerJsonAsset,
    scanTemplateEntry,
    emitEntriesChunks,
    applyAutoImports,
    debug,
  })

  return {
    loadEntry,
    entriesMap,
    loadedEntrySet,
    jsonEmitFilesMap: jsonEmitManager.map,
    normalizeEntry,
  }
}
