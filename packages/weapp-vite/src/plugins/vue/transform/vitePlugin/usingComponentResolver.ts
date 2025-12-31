import type { File as BabelFile } from '@babel/types'
import type { CompilerContext } from '../../../../context'
import type { AutoUsingComponentsOptions } from '../compileVueFile'
import { fileURLToPath } from 'node:url'
import { parse as babelParse } from '@babel/parser'
import * as t from '@babel/types'
import { removeExtensionDeep } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'
import { BABEL_TS_MODULE_PARSER_OPTIONS } from '../../../../utils/babel'
import { pathExists as pathExistsCached, readFile as readFileCached } from '../../../utils/cache'
import { getSourceFromVirtualId } from '../../resolver'

export interface ViteResolverLike {
  resolve: (source: string, importer?: string) => Promise<{ id?: string } | null>
}

function normalizeResolvedFilePath(id: string) {
  const clean = getSourceFromVirtualId(id).split('?', 1)[0]
  if (clean.startsWith('file://')) {
    try {
      return fileURLToPath(clean)
    }
    catch {
      return clean
    }
  }
  if (clean.startsWith('/@fs/')) {
    return clean.slice('/@fs'.length)
  }
  return clean
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
  let clean = normalizeResolvedFilePath(resolved.id)
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
    const cacheKey = clean
    const exportName = info.importedName
    let entry = reExportResolutionCache.get(cacheKey)
    if (!entry) {
      entry = new Map()
      reExportResolutionCache.set(cacheKey, entry)
    }

    if (!entry.has(exportName)) {
      const visited = new Set<string>()
      const resolveExported = async (exporterFile: string, depth: number): Promise<string | undefined> => {
        if (depth <= 0) {
          return undefined
        }
        if (visited.has(exporterFile)) {
          return undefined
        }
        visited.add(exporterFile)
        let code: string
        try {
          code = await readFileCached(exporterFile, { checkMtime: configService.isDev })
        }
        catch {
          return undefined
        }

        let ast: BabelFile
        try {
          ast = babelParse(code, BABEL_TS_MODULE_PARSER_OPTIONS)
        }
        catch {
          return undefined
        }

        const exportAllSources: string[] = []
        for (const node of ast.program.body) {
          if (t.isExportNamedDeclaration(node) && node.source && t.isStringLiteral(node.source)) {
            for (const spec of node.specifiers) {
              if (!t.isExportSpecifier(spec)) {
                continue
              }
              const exportedName = t.isIdentifier(spec.exported)
                ? spec.exported.name
                : t.isStringLiteral(spec.exported)
                  ? spec.exported.value
                  : undefined
              if (exportedName !== exportName) {
                continue
              }
              const hop = await ctx.resolve(node.source.value, exporterFile)
              if (!hop?.id) {
                return undefined
              }
              return normalizeResolvedFilePath(hop.id)
            }
          }
          if (t.isExportAllDeclaration(node) && node.source && t.isStringLiteral(node.source)) {
            exportAllSources.push(node.source.value)
          }
        }

        for (const source of exportAllSources) {
          const hop = await ctx.resolve(source, exporterFile)
          if (!hop?.id) {
            continue
          }
          const hopPath = normalizeResolvedFilePath(hop.id)
          if (!hopPath || hopPath.startsWith('\0') || hopPath.startsWith('node:')) {
            continue
          }
          const nested = await resolveExported(hopPath, depth - 1)
          if (nested) {
            return nested
          }
        }

        return undefined
      }

      entry.set(exportName, await resolveExported(clean, 4))
    }

    const mapped = entry.get(exportName)
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
