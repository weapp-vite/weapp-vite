import type { PluginContext, ResolvedId } from 'rolldown'
import type { CompilerContext } from '../../../context'
import { performance } from 'node:perf_hooks'
import { changeFileExtension } from '../../../utils'

export function createChunkEmitter(
  configService: CompilerContext['configService'],
  loadedEntrySet: Set<string>,
  debug?: (...args: any[]) => void,
) {
  return function emitEntriesChunks(this: PluginContext, resolvedIds: (ResolvedId | null)[]) {
    return resolvedIds.map(async (resolvedId) => {
      if (!resolvedId) {
        return
      }

      const shouldPreload = !loadedEntrySet.has(resolvedId.id)
      loadedEntrySet.add(resolvedId.id)

      const start = shouldPreload ? performance.now() : 0
      if (shouldPreload) {
        await this.load(resolvedId)
      }

      const fileName = configService.relativeOutputPath(
        changeFileExtension(resolvedId.id, '.js'),
      )

      this.emitFile({
        type: 'chunk',
        id: resolvedId.id,
        fileName,
        // @ts-ignore
        preserveSignature: 'exports-only',
      })

      if (shouldPreload) {
        debug?.(`load ${fileName} 耗时 ${(performance.now() - start).toFixed(2)}ms`)
      }
    })
  }
}
