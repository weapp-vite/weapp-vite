import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../context'
import { addResolvedPageLayoutWatchFiles } from '../../../utils/pageLayout'
import { emitNativeLayoutScriptChunkIfNeeded } from '../bundle'
import { resolvePageLayoutPlan } from '../pageLayout'
import { isVueLikeFile } from '../shared'

const APP_ENTRY_RE = /[\\/]app\.(?:vue|jsx|tsx)$/

export { registerVueTemplateToken, resolveVueOutputBase } from '../shared'

export function resolveScriptlessVueEntryStub(isPage: boolean) {
  return isPage ? 'Page({})' : 'Component({})'
}

export function isAppEntry(filename: string) {
  return APP_ENTRY_RE.test(filename)
}

export function isVueLikeId(id: string) {
  return isVueLikeFile(id)
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

export async function ensureSfcStyleBlocks(
  filename: string,
  styleBlocksCache: Map<string, SFCStyleBlock[]>,
  options: {
    load: (filename: string) => Promise<SFCStyleBlock[]>
  },
) {
  const cached = styleBlocksCache.get(filename)
  if (cached) {
    return cached
  }

  const styles = await options.load(filename)
  styleBlocksCache.set(filename, styles)
  return styles
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

  await addResolvedPageLayoutWatchFiles(pluginCtx, resolvedLayoutPlan.layouts)

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
