import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../context'
import { normalizeWatchPath } from '../../../../utils/path'
import { emitNativeLayoutScriptChunkIfNeeded } from '../bundle'
import { collectNativeLayoutAssets, resolvePageLayoutPlan } from '../pageLayout'

const APP_ENTRY_RE = /[\\/]app\.(?:vue|jsx|tsx)$/

export { registerVueTemplateToken } from '../shared'

export function resolveScriptlessVueEntryStub(isPage: boolean) {
  return isPage ? 'Page({})' : 'Component({})'
}

export function isAppEntry(filename: string) {
  return APP_ENTRY_RE.test(filename)
}

export function isVueLikeId(id: string) {
  return id.endsWith('.vue') || id.endsWith('.jsx') || id.endsWith('.tsx')
}

export async function resolveSfcSrc(pluginCtx: any, source: string, importer?: string) {
  if (typeof pluginCtx.resolve !== 'function') {
    return undefined
  }
  const resolved = await pluginCtx.resolve(source, importer)
  return resolved?.id
}

export function invalidatePageLayoutCaches(
  configService: NonNullable<CompilerContext['configService']> | undefined,
  compilationCache: Map<string, { result: VueTransformResult, source?: string, isPage: boolean }>,
  styleBlocksCache: Map<string, SFCStyleBlock[]>,
) {
  if (!configService) {
    return
  }

  for (const [cachedId, cached] of compilationCache.entries()) {
    if (cached.isPage) {
      cached.source = undefined
    }
    styleBlocksCache.delete(cachedId)
  }
}

export function invalidateVueFileCaches(
  file: string,
  compilationCache: Map<string, { result: VueTransformResult, source?: string, isPage: boolean }>,
  styleBlocksCache: Map<string, SFCStyleBlock[]>,
  options: {
    existsSync: (filePath: string) => boolean
  },
) {
  if (!options.existsSync(file)) {
    compilationCache.delete(file)
  }
  else {
    const cached = compilationCache.get(file)
    if (cached) {
      cached.source = undefined
    }
  }
  styleBlocksCache.delete(file)
}

export async function registerNativeLayoutChunksForEntry(
  pluginCtx: any,
  ctx: CompilerContext,
  filename: string,
  source: string,
) {
  const configService = ctx.configService
  if (!configService) {
    return
  }

  const resolvedLayoutPlan = await resolvePageLayoutPlan(source, filename, configService)
  if (!resolvedLayoutPlan) {
    return
  }

  if (typeof pluginCtx.addWatchFile === 'function') {
    for (const layout of resolvedLayoutPlan.layouts) {
      pluginCtx.addWatchFile(normalizeWatchPath(layout.file))
      if (layout.kind === 'native') {
        const nativeAssets = await collectNativeLayoutAssets(layout.file)
        for (const asset of Object.values(nativeAssets)) {
          if (asset) {
            pluginCtx.addWatchFile(normalizeWatchPath(asset))
          }
        }
      }
    }
  }

  for (const layout of resolvedLayoutPlan.layouts) {
    if (layout.kind !== 'native') {
      continue
    }
    await emitNativeLayoutScriptChunkIfNeeded({
      pluginCtx,
      layoutBasePath: layout.file,
      configService,
      outputExtensions: configService.outputExtensions,
    })
  }
}
