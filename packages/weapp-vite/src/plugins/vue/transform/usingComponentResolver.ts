import type { AutoUsingComponentsOptions } from 'wevu/compiler'
import type { CompilerContext } from '../../../context'
import path from 'pathe'
import { resolveAstEngine } from '../../../ast'
import { getReadFileCheckMtime } from '../../../utils/cachePolicy'
import { createCachedEntryResolveOptions, resolveEntryPath } from '../../../utils/entryResolve'
import { resolveReExportedName } from '../../../utils/reExport'
import { isSkippableResolvedId, normalizeFsResolvedId } from '../../../utils/resolvedId'
import { usingComponentFromResolvedFile } from '../../../utils/usingComponentFrom'
import { readFile as readFileCached } from '../../utils/cache'

const JS_LIKE_FILE_RE = /\.(?:[cm]?ts|[cm]?js)$/

export interface ViteResolverLike {
  resolve: (source: string, importer?: string) => Promise<{ id?: string } | null>
}

export async function resolveUsingComponentReference(
  ctx: ViteResolverLike,
  configService: CompilerContext['configService'],
  reExportResolutionCache: Map<string, Map<string, string | undefined>>,
  importSource: string,
  importerFilename: string,
  info: Parameters<NonNullable<AutoUsingComponentsOptions['resolveUsingComponentPath']>>[2] & {
    fallbackRelativeImporterDir?: boolean
  },
) {
  const resolved = await ctx.resolve(importSource, importerFilename)
  let clean = resolved?.id ? normalizeFsResolvedId(resolved.id) : undefined

  if ((!clean || !path.isAbsolute(clean)) && info?.fallbackRelativeImporterDir && importSource.startsWith('.')) {
    clean = path.resolve(path.dirname(importerFilename), importSource)
  }

  if (!clean) {
    return {
      resolvedId: undefined,
      from: undefined,
    }
  }

  if (isSkippableResolvedId(clean)) {
    return {
      resolvedId: undefined,
      from: undefined,
    }
  }

  if (path.isAbsolute(clean)) {
    const resolvedEntry = await resolveEntryPath(clean, createCachedEntryResolveOptions(configService ?? {}, {
      kind: info?.kind ?? 'default',
    }))
    if (resolvedEntry) {
      clean = resolvedEntry
    }
  }

  if (info?.kind === 'named' && info.importedName && JS_LIKE_FILE_RE.test(clean)) {
    const exportName = info.importedName
    const mapped = await resolveReExportedName(clean, exportName, {
      astEngine: resolveAstEngine(configService.weappViteConfig),
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

  return {
    resolvedId: clean,
    from: usingComponentFromResolvedFile(clean, configService),
  }
}

async function resolveUsingComponentPath(
  ctx: ViteResolverLike,
  configService: CompilerContext['configService'],
  reExportResolutionCache: Map<string, Map<string, string | undefined>>,
  importSource: string,
  importerFilename: string,
  info: Parameters<NonNullable<AutoUsingComponentsOptions['resolveUsingComponentPath']>>[2],
) {
  if (!info) {
    return undefined
  }
  const resolved = await resolveUsingComponentReference(
    ctx,
    configService,
    reExportResolutionCache,
    importSource,
    importerFilename,
    info,
  )
  return resolved.from
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
