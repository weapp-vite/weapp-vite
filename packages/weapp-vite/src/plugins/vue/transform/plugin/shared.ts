import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../context'
import { resolveAstEngine } from '../../../../ast'
import logger from '../../../../logger'
import { collectOnPageScrollPerformanceWarnings } from '../../../performance/onPageScrollDiagnostics'
import { addResolvedPageLayoutWatchFiles } from '../../../utils/pageLayout'
import { emitNativeLayoutScriptChunkIfNeeded } from '../bundle'
import { injectWevuPageFeaturesInJsWithViteResolver } from '../injectPageFeatures'
import { collectSetDataPickKeysFromTemplate, injectSetDataPickInJs, isAutoSetDataPickEnabled } from '../injectSetDataPick'
import { applyPageLayoutPlan, resolvePageLayoutPlan } from '../pageLayout'
import { isVueLikeFile } from '../shared'
import { buildWeappVueStyleRequest } from '../styleRequest'

const APP_ENTRY_RE = /[\\/]app\.(?:vue|jsx|tsx)$/
const AUTO_ROUTES_DEFAULT_IMPORT_RE = /import\s+([A-Za-z_$][\w$]*)\s+from\s+['"](?:weapp-vite\/auto-routes|virtual:weapp-vite-auto-routes)['"];?/g
const AUTO_ROUTES_DYNAMIC_IMPORT_RE = /import\(\s*['"](?:weapp-vite\/auto-routes|virtual:weapp-vite-auto-routes)['"]\s*\)/g
const TEMPLATE_DYNAMIC_HINT_RE = /\{\{|wx:|bind[A-Za-z:_-]+=|catch[A-Za-z:_-]+=/
const PAGE_FEATURE_HOOK_HINTS = [
  'onPageScroll',
  'onPullDownRefresh',
  'onReachBottom',
  'onRouteDone',
  'onTabItemTap',
  'onResize',
  'onShareAppMessage',
  'onShareTimeline',
  'onAddToFavorites',
  'onSaveExitState',
]
const PAGE_SCROLL_HOOK_HINT = 'onPageScroll'

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

export function mayNeedTransformSetDataPick(template: string) {
  return TEMPLATE_DYNAMIC_HINT_RE.test(template)
}

export function mayNeedTransformPageFeatureInjection(script: string) {
  return PAGE_FEATURE_HOOK_HINTS.some(hint => script.includes(hint))
}

export function mayNeedTransformPageScrollDiagnostics(script: string) {
  return script.includes(PAGE_SCROLL_HOOK_HINT)
}

export function mayNeedInlineAutoRoutes(source: string) {
  return AUTO_ROUTES_DEFAULT_IMPORT_RE.test(source) || AUTO_ROUTES_DYNAMIC_IMPORT_RE.test(source)
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

export async function handleTransformEntryPageLayoutFlow(options: {
  pluginCtx: any
  ctx: CompilerContext
  filename: string
  source: string
  result?: VueTransformResult
}) {
  const configService = options.ctx.configService
  if (!configService) {
    return undefined
  }

  const resolvedLayoutPlan = await resolvePageLayoutPlan(options.source, options.filename, configService)
  if (!resolvedLayoutPlan) {
    return undefined
  }

  if (options.result) {
    applyPageLayoutPlan(options.result, options.filename, resolvedLayoutPlan)
  }

  await addResolvedPageLayoutWatchFiles(options.pluginCtx, resolvedLayoutPlan.layouts)

  for (const layout of resolvedLayoutPlan.layouts) {
    if (layout.kind !== 'native') {
      continue
    }
    await emitNativeLayoutScriptChunkIfNeeded({
      pluginCtx: options.pluginCtx,
      layoutBasePath: layout.file,
      configService,
      outputExtensions: configService.outputExtensions,
    })
  }

  return resolvedLayoutPlan
}

export async function finalizeTransformEntryScript(options: {
  result: VueTransformResult
  filename: string
  pluginCtx: any
  configService: NonNullable<CompilerContext['configService']>
  isPage: boolean
  isApp: boolean
}) {
  const { result, filename, pluginCtx, configService, isPage, isApp } = options

  if (isPage && result.script) {
    if (mayNeedTransformPageScrollDiagnostics(result.script)) {
      for (const warning of collectOnPageScrollPerformanceWarnings(result.script, filename, {
        engine: resolveAstEngine(configService.weappViteConfig),
      })) {
        logger.warn(warning)
      }
    }

    if (mayNeedTransformPageFeatureInjection(result.script)) {
      const injected = await injectWevuPageFeaturesInJsWithViteResolver(pluginCtx, result.script, filename, {
        checkMtime: configService.isDev,
      })
      if (injected.transformed) {
        result.script = injected.code
      }
    }
  }

  if (
    !isApp
    && result.script
    && result.template
    && isAutoSetDataPickEnabled(configService.weappViteConfig)
    && mayNeedTransformSetDataPick(result.template)
  ) {
    const keys = collectSetDataPickKeysFromTemplate(result.template, {
      astEngine: resolveAstEngine(configService.weappViteConfig),
    })
    const injectedPick = injectSetDataPickInJs(result.script, keys)
    if (injectedPick.transformed) {
      result.script = injectedPick.code
    }
  }

  return result
}

export function finalizeTransformEntryCode(options: {
  result: VueTransformResult
  filename: string
  styleBlocks?: SFCStyleBlock[]
  isPage: boolean
  isApp: boolean
  isDev: boolean
}) {
  const { result, filename, styleBlocks, isPage, isApp, isDev } = options
  let returnedCode = result.script ?? ''

  if (styleBlocks?.length) {
    const styleImports = styleBlocks
      .map((styleBlock, index) => {
        const request = buildWeappVueStyleRequest(filename, styleBlock, index)
        return `import ${JSON.stringify(request)};\n`
      })
      .join('')
    returnedCode = styleImports + returnedCode
  }

  if (!isApp && !result.script?.trim()) {
    returnedCode += resolveScriptlessVueEntryStub(isPage)
  }

  const macroHash = result.meta?.jsonMacroHash
  if (macroHash && isDev) {
    returnedCode += `\n;Object.defineProperty({}, '__weappViteJsonMacroHash', { value: ${JSON.stringify(macroHash)} })\n`
  }

  const defineOptionsHash = result.meta?.defineOptionsHash
  if (defineOptionsHash && isDev) {
    returnedCode += `\n;Object.defineProperty({}, '__weappViteDefineOptionsHash', { value: ${JSON.stringify(defineOptionsHash)} })\n`
  }

  return returnedCode
}

export async function inlineTransformAutoRoutes(options: {
  source: string
  autoRoutesService?: {
    ensureFresh?: () => Promise<void>
    getReference?: () => {
      pages?: unknown[]
      entries?: unknown[]
      subPackages?: unknown[]
    } | undefined
  }
}) {
  const { source, autoRoutesService } = options
  if (!mayNeedInlineAutoRoutes(source)) {
    return source
  }

  AUTO_ROUTES_DEFAULT_IMPORT_RE.lastIndex = 0
  AUTO_ROUTES_DYNAMIC_IMPORT_RE.lastIndex = 0

  await autoRoutesService?.ensureFresh?.()

  const routesRef = autoRoutesService?.getReference?.()
  const inlineRoutes = {
    pages: routesRef?.pages ?? [],
    entries: routesRef?.entries ?? [],
    subPackages: routesRef?.subPackages ?? [],
  }

  return source
    .replace(AUTO_ROUTES_DEFAULT_IMPORT_RE, (_, localName: string) => `const ${localName} = ${JSON.stringify(inlineRoutes)};`)
    .replace(AUTO_ROUTES_DYNAMIC_IMPORT_RE, `Promise.resolve(${JSON.stringify(inlineRoutes)})`)
}

export async function registerNativeLayoutChunksForEntry(
  pluginCtx: any,
  ctx: CompilerContext,
  filename: string,
  source: string,
) {
  await handleTransformEntryPageLayoutFlow({
    pluginCtx,
    ctx,
    filename,
    source,
  })
}
