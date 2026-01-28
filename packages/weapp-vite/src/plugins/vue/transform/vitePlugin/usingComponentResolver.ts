import type { AutoUsingComponentsOptions } from 'wevu/compiler'
import type { CompilerContext } from '../../../../context'
import fs from 'fs-extra'
import { getPathExistsTtlMs, getReadFileCheckMtime } from '../../../../utils/cachePolicy'
import { resolveEntryPath } from '../../../../utils/entryResolve'
import { resolveReExportedName } from '../../../../utils/reExport'
import { isSkippableResolvedId, normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { usingComponentFromResolvedFile } from '../../../../utils/usingComponentFrom'
import { pathExists as pathExistsCached, readFile as readFileCached } from '../../../utils/cache'

export interface ViteResolverLike {
  resolve: (source: string, importer?: string) => Promise<{ id?: string } | null>
}

async function resolveUsingComponentPath(
  ctx: ViteResolverLike,
  configService: CompilerContext['configService'],
  reExportResolutionCache: Map<string, Map<string, string | undefined>>,
  importSource: string,
  importerFilename: string,
  info: Parameters<NonNullable<AutoUsingComponentsOptions['resolveUsingComponentPath']>>[2],
) {
  const resolved = await ctx.resolve(importSource, importerFilename)
  if (!resolved?.id) {
    return undefined
  }
  let clean = normalizeFsResolvedId(resolved.id)
  if (isSkippableResolvedId(clean)) {
    return undefined
  }

  const resolvedEntry = await resolveEntryPath(clean, {
    kind: info?.kind ?? 'default',
    stat: (p: string) => fs.stat(p) as any,
    exists: (p: string) => pathExistsCached(p, { ttlMs: getPathExistsTtlMs(configService) }),
  })
  if (resolvedEntry) {
    clean = resolvedEntry
  }

  if (info?.kind === 'named' && info.importedName && /\.(?:[cm]?ts|[cm]?js)$/.test(clean)) {
    const exportName = info.importedName
    const mapped = await resolveReExportedName(clean, exportName, {
      cache: reExportResolutionCache,
      maxDepth: 4,
      readFile: file => readFileCached(file, { checkMtime: getReadFileCheckMtime(configService) }),
      resolveId: async (source, importer) => {
        const hop = await ctx.resolve(source, importer)
        const hopId = hop?.id ? normalizeFsResolvedId(hop.id) : undefined
        if (isSkippableResolvedId(hopId)) {
          return undefined
        }
        return hopId
      },
    })
    if (mapped) {
      clean = mapped
    }
  }

  return usingComponentFromResolvedFile(clean, configService)
}

export function createUsingComponentPathResolver(
  ctx: ViteResolverLike,
  configService: CompilerContext['configService'],
  reExportResolutionCache: Map<string, Map<string, string | undefined>>,
): NonNullable<AutoUsingComponentsOptions['resolveUsingComponentPath']> {
  return async (importSource, importerFilename, info) => {
    return resolveUsingComponentPath(ctx, configService, reExportResolutionCache, importSource, importerFilename, info)
  }
}
