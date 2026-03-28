import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../context'
import { performance } from 'node:perf_hooks'
// eslint-disable-next-line e18e/ban-dependencies -- 当前 transform 阶段仍统一复用 fs-extra 读取源码
import fs from 'fs-extra'
import path from 'pathe'
import { compileJsxFile, compileVueFile } from 'wevu/compiler'
import { resolveAstEngine } from '../../../../ast'
import logger from '../../../../logger'
import { normalizeWatchPath } from '../../../../utils/path'
import { toAbsoluteId } from '../../../../utils/toAbsoluteId'
import { collectOnPageScrollPerformanceWarnings } from '../../../performance/onPageScrollDiagnostics'
import { readFile as readFileCached } from '../../../utils/cache'
import { getSfcCheckMtime, readAndParseSfc } from '../../../utils/vueSfc'
import { createPageEntryMatcher } from '../../../wevu'
import { getSourceFromVirtualId } from '../../resolver'
import { createCompileVueFileOptions } from '../compileOptions'
import { injectWevuPageFeaturesInJsWithViteResolver } from '../injectPageFeatures'
import { collectSetDataPickKeysFromTemplate, injectSetDataPickInJs, isAutoSetDataPickEnabled } from '../injectSetDataPick'
import { applyPageLayoutPlan, resolvePageLayoutPlan } from '../pageLayout'
import { emitScopedSlotChunks } from '../scopedSlot'
import { buildWeappVueStyleRequest } from '../styleRequest'
import { isAppEntry, registerNativeLayoutChunksForEntry, registerVueTemplateToken, resolveScriptlessVueEntryStub, resolveVueOutputBase } from './shared'

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

function mayNeedSetDataPick(template: string) {
  return TEMPLATE_DYNAMIC_HINT_RE.test(template)
}

function mayNeedPageFeatureInjection(script: string) {
  return PAGE_FEATURE_HOOK_HINTS.some(hint => script.includes(hint))
}

function mayNeedPageScrollDiagnostics(script: string) {
  return script.includes(PAGE_SCROLL_HOOK_HINT)
}

export async function transformVueLikeFile(options: {
  ctx: CompilerContext
  pluginCtx: any
  code: string
  id: string
  compilationCache: Map<string, { result: VueTransformResult, source?: string, isPage: boolean }>
  pageMatcher: ReturnType<typeof createPageEntryMatcher> | null
  setPageMatcher: (matcher: ReturnType<typeof createPageEntryMatcher>) => void
  reExportResolutionCache: Map<string, Map<string, string | undefined>>
  styleBlocksCache: Map<string, SFCStyleBlock[]>
  scopedSlotModules: Map<string, string>
  emittedScopedSlotChunks: Set<string>
  classStyleRuntimeWarned: { value: boolean }
  resolveSfcSrc: (pluginCtx: any, source: string, importer?: string) => Promise<string | undefined>
}) {
  const {
    ctx,
    pluginCtx,
    code,
    id,
    compilationCache,
    pageMatcher,
    setPageMatcher,
    reExportResolutionCache,
    styleBlocksCache,
    scopedSlotModules,
    emittedScopedSlotChunks,
    classStyleRuntimeWarned,
    resolveSfcSrc,
  } = options
  const vueTransformTiming = ctx.configService?.weappViteConfig?.debug?.vueTransformTiming
  const stageTimings: Record<string, number> = {}
  const totalStart = vueTransformTiming ? performance.now() : 0
  const measureStage = async <T>(label: string, task: () => Promise<T>) => {
    if (!vueTransformTiming) {
      return await task()
    }
    const start = performance.now()
    const result = await task()
    stageTimings[label] = Number((performance.now() - start).toFixed(2))
    return result
  }

  const configService = ctx.configService
  if (!configService) {
    return null
  }

  const sourceId = getSourceFromVirtualId(id)
  const filename = toAbsoluteId(sourceId, configService, undefined, { base: 'cwd' })
  if (!filename || !path.isAbsolute(filename)) {
    return null
  }

  if (typeof pluginCtx.addWatchFile === 'function') {
    pluginCtx.addWatchFile(normalizeWatchPath(filename))
  }

  try {
    const source = await measureStage('readSource', async () => (
      typeof code === 'string'
        ? code
        : configService.isDev
          ? await readFileCached(filename, { checkMtime: true, encoding: 'utf8' })
          : await fs.readFile(filename, 'utf-8')
    ))

    if (filename.endsWith('.vue') && source.includes('<style')) {
      await measureStage('preParseSfc', async () => {
        try {
          const parsedSfc = await readAndParseSfc(filename, {
            source,
            checkMtime: false,
            resolveSrc: {
              resolveId: (src, importer) => resolveSfcSrc(pluginCtx, src, importer),
              checkMtime: getSfcCheckMtime(ctx.configService),
            },
          })
          styleBlocksCache.set(filename, parsedSfc.descriptor.styles)
        }
        catch {
          // 忽略解析失败，后续由 compileVueFile 抛出错误
        }
      })
    }

    const libModeEnabled = configService.weappLibConfig?.enabled
    let isPage = false
    let isApp = false
    if (!libModeEnabled) {
      const scanService = ctx.scanService
      const currentPageMatcher = pageMatcher ?? createPageEntryMatcher({
        srcRoot: configService.absoluteSrcRoot,
        loadEntries: async () => {
          if (!scanService) {
            return { pages: [], subPackages: [], pluginPages: [] }
          }
          const appEntry = await scanService.loadAppEntry()
          const subPackages = scanService.loadSubPackages().map(meta => ({
            root: meta.subPackage.root,
            pages: meta.subPackage.pages,
          }))
          const pluginPages = scanService.pluginJson
            ? Object.values((scanService.pluginJson as { pages?: Record<string, string> }).pages ?? {}).map(page => String(page))
            : []
          return {
            pages: appEntry.json?.pages ?? [],
            subPackages,
            pluginPages,
          }
        },
        warn: (message: string) => logger.warn(message),
      })

      setPageMatcher(currentPageMatcher)
      if (ctx.runtimeState.scan.isDirty) {
        currentPageMatcher.markDirty()
      }
      isPage = await measureStage('matchPageEntry', async () => await currentPageMatcher.isPageFile(filename))
      isApp = isAppEntry(filename)
    }

    let transformedSource = source
    if (
      isApp
      && (AUTO_ROUTES_DEFAULT_IMPORT_RE.test(transformedSource) || AUTO_ROUTES_DYNAMIC_IMPORT_RE.test(transformedSource))
    ) {
      AUTO_ROUTES_DEFAULT_IMPORT_RE.lastIndex = 0
      AUTO_ROUTES_DYNAMIC_IMPORT_RE.lastIndex = 0
      await measureStage('ensureAutoRoutes', async () => {
        await ctx.autoRoutesService?.ensureFresh?.()
      })
      const routesRef = ctx.autoRoutesService?.getReference?.()
      const inlineRoutes = {
        pages: routesRef?.pages ?? [],
        entries: routesRef?.entries ?? [],
        subPackages: routesRef?.subPackages ?? [],
      }
      transformedSource = transformedSource
        .replace(AUTO_ROUTES_DEFAULT_IMPORT_RE, (_, localName: string) => `const ${localName} = ${JSON.stringify(inlineRoutes)};`)
        .replace(AUTO_ROUTES_DYNAMIC_IMPORT_RE, `Promise.resolve(${JSON.stringify(inlineRoutes)})`)
    }
    const compileOptions = createCompileVueFileOptions(ctx, pluginCtx, filename, isPage, isApp, configService, {
      reExportResolutionCache,
      classStyleRuntimeWarned,
    })

    const result = await measureStage('compile', async () => (
      filename.endsWith('.vue')
        ? await compileVueFile(transformedSource, filename, compileOptions)
        : await compileJsxFile(transformedSource, filename, compileOptions)
    ))

    if (isPage && result.template) {
      await measureStage('pagePostProcess', async () => {
        const resolvedLayoutPlan = await resolvePageLayoutPlan(transformedSource, filename, configService)
        if (resolvedLayoutPlan) {
          applyPageLayoutPlan(result, filename, resolvedLayoutPlan)
        }
        await registerNativeLayoutChunksForEntry(pluginCtx, ctx, filename, transformedSource)
      })
    }
    registerVueTemplateToken(ctx, filename, result.template)

    if (Array.isArray(result.meta?.sfcSrcDeps) && typeof pluginCtx.addWatchFile === 'function') {
      for (const dep of result.meta.sfcSrcDeps) {
        pluginCtx.addWatchFile(normalizeWatchPath(dep))
      }
    }

    if (isPage && result.script) {
      if (mayNeedPageScrollDiagnostics(result.script)) {
        for (const warning of collectOnPageScrollPerformanceWarnings(result.script, filename, {
          engine: resolveAstEngine(configService.weappViteConfig),
        })) {
          logger.warn(warning)
        }
      }
      if (mayNeedPageFeatureInjection(result.script)) {
        await measureStage('injectPageFeatures', async () => {
          const injected = await injectWevuPageFeaturesInJsWithViteResolver(pluginCtx, result.script!, filename, {
            checkMtime: configService.isDev,
          })
          if (injected.transformed) {
            result.script = injected.code
          }
        })
      }
    }
    if (
      !isApp
      && result.script
      && result.template
      && isAutoSetDataPickEnabled(configService.weappViteConfig)
      && mayNeedSetDataPick(result.template)
    ) {
      await measureStage('injectSetDataPick', async () => {
        const keys = collectSetDataPickKeysFromTemplate(result.template!, {
          astEngine: resolveAstEngine(configService.weappViteConfig),
        })
        const injectedPick = injectSetDataPickInJs(result.script!, keys)
        if (injectedPick.transformed) {
          result.script = injectedPick.code
        }
      })
    }
    compilationCache.set(filename, { result, source, isPage })

    const relativeBase = resolveVueOutputBase(configService, filename)
    if (relativeBase) {
      await measureStage('emitScopedSlots', async () => {
        emitScopedSlotChunks(pluginCtx, relativeBase, result, scopedSlotModules, emittedScopedSlotChunks, configService.outputExtensions)
      })
    }

    let returnedCode = result.script ?? ''
    const styleBlocks = styleBlocksCache.get(filename)
    if (styleBlocks?.length) {
      returnedCode = await measureStage('injectStyleImports', async () => {
        const styleImports = styleBlocks
          .map((styleBlock, index) => {
            const request = buildWeappVueStyleRequest(filename, styleBlock, index)
            return `import ${JSON.stringify(request)};\n`
          })
          .join('')
        return styleImports + returnedCode
      })
    }

    if (!isApp && !result.script?.trim()) {
      returnedCode += resolveScriptlessVueEntryStub(isPage)
    }

    const macroHash = result.meta?.jsonMacroHash
    if (macroHash && configService.isDev) {
      returnedCode += `\n;Object.defineProperty({}, '__weappViteJsonMacroHash', { value: ${JSON.stringify(macroHash)} })\n`
    }
    const defineOptionsHash = result.meta?.defineOptionsHash
    if (defineOptionsHash && configService.isDev) {
      returnedCode += `\n;Object.defineProperty({}, '__weappViteDefineOptionsHash', { value: ${JSON.stringify(defineOptionsHash)} })\n`
    }

    if (vueTransformTiming) {
      vueTransformTiming({
        id: filename,
        isPage,
        totalMs: Number((performance.now() - totalStart).toFixed(2)),
        stages: stageTimings,
      })
    }

    return {
      code: returnedCode,
      map: null,
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`[Vue 编译] 编译 ${filename} 失败：${message}`)
    throw error
  }
}
