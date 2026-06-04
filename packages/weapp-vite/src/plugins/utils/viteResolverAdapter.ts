import type { NormalizeFsResolvedIdOptions } from '../../utils/resolvedId'
import fs from 'node:fs'
import path from 'pathe'
import { isSkippableResolvedId, normalizeFsResolvedId } from '../../utils/resolvedId'

export interface ViteResolveLike {
  resolve: (source: string, importer?: string) => Promise<{ id?: string } | null>
}

export interface FileReaderLike {
  readFile: (id: string, options?: { checkMtime?: boolean }) => Promise<string>
}

const WINDOWS_ABSOLUTE_PATH_RE = /^[A-Z]:[\\/]/i

function isExplicitFileRequest(id: string) {
  return id.startsWith('.') || id.startsWith('/') || WINDOWS_ABSOLUTE_PATH_RE.test(id)
}

function isFilePathLike(id: string) {
  return Boolean(path.extname(id))
}

function resolveLocalFile(source: string, importer?: string, normalizeOptions?: NormalizeFsResolvedIdOptions) {
  const cleanSource = normalizeFsResolvedId(source, normalizeOptions)
  if (!isExplicitFileRequest(cleanSource) || !isFilePathLike(cleanSource)) {
    return undefined
  }

  const candidate = path.isAbsolute(cleanSource) || WINDOWS_ABSOLUTE_PATH_RE.test(cleanSource)
    ? cleanSource
    : importer
      ? path.resolve(path.dirname(normalizeFsResolvedId(importer, normalizeOptions)), cleanSource)
      : undefined
  if (!candidate) {
    return undefined
  }

  try {
    return fs.statSync(candidate).isFile() ? candidate : undefined
  }
  catch {
    return undefined
  }
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
      const localFile = resolveLocalFile(source, importer, normalizeOptions)
      if (localFile) {
        return localFile
      }

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
