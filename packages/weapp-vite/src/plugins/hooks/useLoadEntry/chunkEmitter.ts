import type { PluginContext, ResolvedId } from 'rolldown'
import type { CompilerContext } from '../../../context'
import { performance } from 'node:perf_hooks'
import { normalizeFsResolvedId } from '../../../utils/resolvedId'
import { resolveRelativeOutputFileNameWithExtension } from '../../utils/outputFileName'

export interface ChunkEmitStats {
  chunkEmitCount: number
  loadCount: number
  loadMs: number
  emitFileMs: number
  skippedLoadedCount: number
}

export type ChunkEmitTask = Promise<ChunkEmitStats>

export function createChunkEmitter(
  configService: CompilerContext['configService'],
  loadedEntrySet: Set<string>,
  debug?: (...args: any[]) => void,
  trackEmittedEntryId?: (entryId: string) => void,
  trackEmittedChunkId?: (entryId: string) => void,
  shouldEmitEntryChunk?: (entryId: string, resolvedId: ResolvedId) => boolean,
  preloadAssetOnlyEntry?: (this: PluginContext, resolvedId: ResolvedId, entryId: string) => Promise<void>,
  trackEmittedChunkFileName?: (fileName: string) => void,
  trackChunkEmitStats?: (stats: ChunkEmitStats) => void,
  resolveEntryChunkId: (entryId: string, resolvedId: ResolvedId) => string = (_entryId, resolvedId) => resolvedId.id,
) {
  return function emitEntriesChunks(this: PluginContext, resolvedIds: (ResolvedId | null)[]) {
    return resolvedIds.map(async (resolvedId): ChunkEmitTask => {
      const stats: ChunkEmitStats = {
        chunkEmitCount: 0,
        emitFileMs: 0,
        loadCount: 0,
        loadMs: 0,
        skippedLoadedCount: 0,
      }
      if (!resolvedId) {
        return stats
      }

      const normalizedId = normalizeFsResolvedId(resolvedId.id)
      const entryChunkId = resolveEntryChunkId(normalizedId, resolvedId)
      const shouldPreload = !loadedEntrySet.has(normalizedId)
      if (!shouldPreload) {
        stats.skippedLoadedCount += 1
      }
      loadedEntrySet.add(normalizedId)

      const start = shouldPreload ? performance.now() : 0
      const shouldEmitChunk = shouldEmitEntryChunk?.(normalizedId, resolvedId) ?? true
      if (shouldPreload) {
        const loadStartedAt = performance.now()
        if (!shouldEmitChunk && preloadAssetOnlyEntry) {
          await preloadAssetOnlyEntry.call(this, resolvedId, normalizedId)
        }
        else {
          await this.load({ id: entryChunkId })
        }
        stats.loadCount += 1
        stats.loadMs += performance.now() - loadStartedAt
      }

      const fileName = resolveRelativeOutputFileNameWithExtension(configService, resolvedId.id, '.js')

      if (shouldEmitChunk) {
        const emitFileStartedAt = performance.now()
        this.emitFile({
          type: 'chunk',
          id: resolvedId.id,
          fileName,
          // @ts-ignore
          preserveSignature: 'exports-only',
        })
        trackEmittedChunkId?.(normalizedId)
        trackEmittedChunkFileName?.(fileName)
        stats.chunkEmitCount += 1
        stats.emitFileMs += performance.now() - emitFileStartedAt
      }
      trackEmittedEntryId?.(normalizedId)

      if (shouldPreload) {
        debug?.(`load ${fileName} 耗时 ${(performance.now() - start).toFixed(2)}ms`)
      }
      trackChunkEmitStats?.(stats)
      return stats
    })
  }
}
