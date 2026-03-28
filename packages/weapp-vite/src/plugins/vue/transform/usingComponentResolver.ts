import type { AutoUsingComponentsOptions } from 'wevu/compiler'
import type { CompilerContext } from '../../../context'
// eslint-disable-next-line e18e/ban-dependencies -- 当前 usingComponents 解析仍统一复用 fs-extra 的 stat 能力
import fs from 'fs-extra'
import path from 'pathe'
import { resolveAstEngine } from '../../../ast'
import { getPathExistsTtlMs, getReadFileCheckMtime } from '../../../utils/cachePolicy'
import { resolveEntryPath } from '../../../utils/entryResolve'
import { resolveReExportedName } from '../../../utils/reExport'
import { isSkippableResolvedId, normalizeFsResolvedId } from '../../../utils/resolvedId'
import { usingComponentFromResolvedFile } from '../../../utils/usingComponentFrom'
import { pathExists as pathExistsCached, readFile as readFileCached } from '../../utils/cache'

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
    const resolvedEntry = await resolveEntryPath(clean, {
      kind: info?.kind ?? 'default',
      stat: (p: string) => fs.stat(p) as any,
      exists: (p: string) => pathExistsCached(p, { ttlMs: getPathExistsTtlMs(configService) }),
    })
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
