import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../context'
import { performance } from 'node:perf_hooks'
// eslint-disable-next-line e18e/ban-dependencies -- 当前 transform 阶段仍统一复用 fs-extra 读取源码
import fs from 'fs-extra'
import path from 'pathe'
import { compileJsxFile, compileVueFile } from 'wevu/compiler'
import logger from '../../../../logger'
import { toAbsoluteId } from '../../../../utils/toAbsoluteId'
import { readFile as readFileCached } from '../../../utils/cache'
import { createReadAndParseSfcOptions, readAndParseSfc } from '../../../utils/vueSfc'
import { addNormalizedWatchFile } from '../../../utils/watchFiles'
import { createPageEntryMatcher } from '../../../wevu'
import { getSourceFromVirtualId } from '../../resolver'
import { createCompileVueFileOptions } from '../compileOptions'
import { emitScopedSlotChunks } from '../scopedSlot'
import { ensureSfcStyleBlocks, finalizeTransformEntryCode, finalizeTransformEntryScript, handleTransformEntryPageLayoutFlow, isAppEntry, registerVueTemplateToken, resolveVueOutputBase } from './shared'

const AUTO_ROUTES_DEFAULT_IMPORT_RE = /import\s+([A-Za-z_$][\w$]*)\s+from\s+['"](?:weapp-vite\/auto-routes|virtual:weapp-vite-auto-routes)['"];?/g
const AUTO_ROUTES_DYNAMIC_IMPORT_RE = /import\(\s*['"](?:weapp-vite\/auto-routes|virtual:weapp-vite-auto-routes)['"]\s*\)/g

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
    addNormalizedWatchFile(pluginCtx, filename)
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
          await ensureSfcStyleBlocks(filename, styleBlocksCache, {
            load: async target => (
              await readAndParseSfc(target, {
                ...createReadAndParseSfcOptions(pluginCtx, ctx.configService, {
                  source,
                  checkMtime: false,
                }),
              })
            ).descriptor.styles,
          })
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
        await handleTransformEntryPageLayoutFlow({
          pluginCtx,
          ctx,
          filename,
          source: transformedSource,
          result,
        })
      })
    }
    registerVueTemplateToken(ctx, filename, result.template)

    if (Array.isArray(result.meta?.sfcSrcDeps) && typeof pluginCtx.addWatchFile === 'function') {
      for (const dep of result.meta.sfcSrcDeps) {
        addNormalizedWatchFile(pluginCtx, dep)
      }
    }

    await measureStage('finalizeScript', async () => {
      await finalizeTransformEntryScript({
        result,
        filename,
        pluginCtx,
        configService,
        isPage,
        isApp,
      })
    })
    compilationCache.set(filename, { result, source, isPage })

    const relativeBase = resolveVueOutputBase(configService, filename)
    if (relativeBase) {
      await measureStage('emitScopedSlots', async () => {
        emitScopedSlotChunks(pluginCtx, relativeBase, result, scopedSlotModules, emittedScopedSlotChunks, configService.outputExtensions)
      })
    }

    const returnedCode = await measureStage('finalizeCode', async () => finalizeTransformEntryCode({
      result,
      filename,
      styleBlocks: styleBlocksCache.get(filename),
      isPage,
      isApp,
      isDev: configService.isDev,
    }))

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
