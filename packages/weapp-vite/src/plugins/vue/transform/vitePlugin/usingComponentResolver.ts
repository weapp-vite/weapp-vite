import type { CompilerContext } from '../../../../context'
import type { AutoUsingComponentsOptions } from '../compileVueFile'
import { removeExtensionDeep } from '@weapp-core/shared'
import fs from 'fs-extra'
import { resolveEntryPath } from '../../../../utils/entryResolve'
import { resolveReExportedName } from '../../../../utils/reExport'
import { isSkippableResolvedId, normalizeFsResolvedId } from '../../../../utils/resolvedId'
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
    exists: (p: string) => pathExistsCached(p, { ttlMs: configService.isDev ? 250 : 60_000 }),
  })
  if (resolvedEntry) {
    clean = resolvedEntry
  }

  if (info?.kind === 'named' && info.importedName && /\.(?:[cm]?ts|[cm]?js)$/.test(clean)) {
    const exportName = info.importedName
    const mapped = await resolveReExportedName(clean, exportName, {
      cache: reExportResolutionCache,
      maxDepth: 4,
      readFile: file => readFileCached(file, { checkMtime: configService.isDev }),
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

  const baseName = removeExtensionDeep(clean)
  const relativeBase = configService.relativeOutputPath(baseName)
  if (!relativeBase) {
    return undefined
  }
  return `/${relativeBase}`
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
