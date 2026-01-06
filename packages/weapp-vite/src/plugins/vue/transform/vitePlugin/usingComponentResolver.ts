import type { CompilerContext } from '../../../../context'
import type { AutoUsingComponentsOptions } from '../compileVueFile'
import { removeExtensionDeep } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'
import { resolveReExportedName } from '../../../../utils/reExport'
import { normalizeViteId } from '../../../../utils/viteId'
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
  let clean = normalizeViteId(resolved.id, { stripVueVirtualPrefix: true })
  if (!clean || clean.startsWith('\0') || clean.startsWith('node:')) {
    return undefined
  }

  try {
    const stat = await fs.stat(clean)
    if (stat.isDirectory()) {
      for (const ext of ['ts', 'js', 'mjs', 'cjs']) {
        const indexPath = path.join(clean, `index.${ext}`)
        if (await pathExistsCached(indexPath, { ttlMs: configService.isDev ? 250 : 60_000 })) {
          clean = indexPath
          break
        }
      }
    }
  }
  catch {
    // ignore stat/exists failures
  }

  if (info?.kind === 'named' && info.importedName && /\.(?:[cm]?ts|[cm]?js)$/.test(clean)) {
    const exportName = info.importedName
    const mapped = await resolveReExportedName(clean, exportName, {
      cache: reExportResolutionCache,
      maxDepth: 4,
      readFile: file => readFileCached(file, { checkMtime: configService.isDev }),
      resolveId: async (source, importer) => {
        const hop = await ctx.resolve(source, importer)
        const hopId = hop?.id ? normalizeViteId(hop.id, { stripVueVirtualPrefix: true }) : undefined
        if (!hopId || hopId.startsWith('\0') || hopId.startsWith('node:')) {
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
