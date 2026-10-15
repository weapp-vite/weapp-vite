import type { AutoUsingComponentsOptions } from 'wevu/compiler'
import type { CompilerContext } from '../../../context'
import type { ReExportResolutionCache } from '../../../utils/reExport'
import path from 'pathe'
import { resolveAstEngine } from '../../../ast'
import { getReadFileCheckMtime } from '../../../utils/cachePolicy'
import { createCachedEntryResolveOptions, resolveEntryExtensions, resolveEntryPath } from '../../../utils/entryResolve'
import { resolveReExportedName } from '../../../utils/reExport'
import { isSkippableResolvedId, normalizeFsResolvedId } from '../../../utils/resolvedId'
import { usingComponentFromResolvedFile } from '../../../utils/usingComponentFrom'
import { readFile as readFileCached } from '../../utils/cache'
import { compilerSnapshotSourceId, compilerSourceResolutionKey, getCompilerSourceResolutions, getCompilerSourceSnapshot, readCompilerInput } from '../../utils/sourceSnapshot'

const JS_LIKE_FILE_RE = /\.(?:[cm]?ts|[cm]?js)$/

export interface ViteResolverLike {
  resolve: (source: string, importer?: string) => Promise<{ id?: string } | null>
}

export async function resolveUsingComponentReference(
  ctx: ViteResolverLike,
  configService: CompilerContext['configService'],
  reExportResolutionCache: ReExportResolutionCache,
  importSource: string,
  importerFilename: string,
  info: Parameters<NonNullable<AutoUsingComponentsOptions['resolveUsingComponentPath']>>[2] & {
    fallbackRelativeImporterDir?: boolean
    onDependency?: (id: string) => void
  },
) {
  const resolveId = async (source: string, importer: string) => {
    const resolutions = getCompilerSourceResolutions(configService)
    const key = compilerSourceResolutionKey(source, compilerSnapshotSourceId(getCompilerSourceSnapshot(configService), importer))
    const resolved = resolutions?.has(key)
      ? resolutions.get(key)
      : (await ctx.resolve(source, importer))?.id
    const id = resolved ? normalizeFsResolvedId(resolved) : undefined
    if (id && !isSkippableResolvedId(id)) {
      info?.onDependency?.(id)
      return id
    }
    if (source.startsWith('.') || path.isAbsolute(source)) {
      const candidate = normalizeFsResolvedId(path.resolve(path.dirname(importer), source))
      info?.onDependency?.(candidate)
      if (!path.extname(candidate)) {
        for (const extension of resolveEntryExtensions(info?.kind ?? 'default', false)) {
          info?.onDependency?.(`${candidate}.${extension}`)
          info?.onDependency?.(path.join(candidate, `index.${extension}`))
        }
      }
    }
    return undefined
  }
  let clean = await resolveId(importSource, importerFilename)

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
      readFile: (file) => {
        info?.onDependency?.(normalizeFsResolvedId(file))
        return readCompilerInput(configService, file, id => readFileCached(id, { checkMtime: getReadFileCheckMtime(configService) }))
      },
      resolveId,
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
  reExportResolutionCache: ReExportResolutionCache,
  importSource: string,
  importerFilename: string,
  info: Parameters<NonNullable<AutoUsingComponentsOptions['resolveUsingComponentPath']>>[2],
  onDependency?: (id: string) => void,
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
    { ...info, onDependency },
  )
  const sourceType: 'wevu-sfc' | 'native' = resolved.resolvedId?.endsWith('.vue') ? 'wevu-sfc' : 'native'
  return {
    from: resolved.from,
    resolvedId: resolved.resolvedId,
    sourceType,
  }
}

export function createUsingComponentPathResolver(
  ctx: ViteResolverLike,
  configService: CompilerContext['configService'],
  reExportResolutionCache: ReExportResolutionCache,
  onDependency?: (id: string) => void,
): NonNullable<AutoUsingComponentsOptions['resolveUsingComponentPath']> {
  return async (importSource, importerFilename, info) => {
    return resolveUsingComponentPath(ctx, configService, reExportResolutionCache, importSource, importerFilename, info, onDependency)
  }
}
