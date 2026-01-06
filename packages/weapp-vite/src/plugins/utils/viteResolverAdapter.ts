import type { NormalizeFsResolvedIdOptions } from '../../utils/resolvedId'
import { isSkippableResolvedId, normalizeFsResolvedId } from '../../utils/resolvedId'

export interface ViteResolveLike {
  resolve: (source: string, importer?: string) => Promise<{ id?: string } | null>
}

export interface FileReaderLike {
  readFile: (id: string, options?: { checkMtime?: boolean }) => Promise<string>
}

export function createViteResolverAdapter(
  resolver: ViteResolveLike,
  reader: FileReaderLike,
  options?: { checkMtime?: boolean, normalize?: NormalizeFsResolvedIdOptions },
) {
  const checkMtime = options?.checkMtime
  const normalizeOptions = options?.normalize

  return {
    resolveId: async (source: string, importer?: string) => {
      const resolved = await resolver.resolve(source, importer)
      return resolved ? resolved.id : undefined
    },
    loadCode: async (resolvedId: string) => {
      const clean = normalizeFsResolvedId(resolvedId, normalizeOptions)
      if (isSkippableResolvedId(clean)) {
        return undefined
      }
      try {
        return await reader.readFile(clean, { checkMtime })
      }
      catch {
        return undefined
      }
    },
  }
}
