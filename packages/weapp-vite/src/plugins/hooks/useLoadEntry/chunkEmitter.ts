import type { PluginContext, ResolvedId } from 'rolldown'
import type { CompilerContext } from '../../../context'
import { performance } from 'node:perf_hooks'
import { normalizeFsResolvedId } from '../../../utils/resolvedId'
import { resolveRelativeOutputFileNameWithExtension } from '../../utils/outputFileName'

export function createChunkEmitter(
  configService: CompilerContext['configService'],
  loadedEntrySet: Set<string>,
  debug?: (...args: any[]) => void,
  trackEmittedEntryId?: (entryId: string) => void,
) {
  return function emitEntriesChunks(this: PluginContext, resolvedIds: (ResolvedId | null)[]) {
    return resolvedIds.map(async (resolvedId) => {
      if (!resolvedId) {
        return
      }

      const normalizedId = normalizeFsResolvedId(resolvedId.id)
      const shouldPreload = !loadedEntrySet.has(normalizedId)
      loadedEntrySet.add(normalizedId)

      const start = shouldPreload ? performance.now() : 0
      if (shouldPreload) {
        await this.load(resolvedId)
      }

      const fileName = resolveRelativeOutputFileNameWithExtension(configService, resolvedId.id, '.js')

      this.emitFile({
        type: 'chunk',
        id: resolvedId.id,
        fileName,
        // @ts-ignore
        preserveSignature: 'exports-only',
      })
      trackEmittedEntryId?.(normalizedId)

      if (shouldPreload) {
        debug?.(`load ${fileName} 耗时 ${(performance.now() - start).toFixed(2)}ms`)
      }
    })
  }
}
