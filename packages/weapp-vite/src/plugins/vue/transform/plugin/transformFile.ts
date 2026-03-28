import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../context'
import { performance } from 'node:perf_hooks'
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
import { finalizeTransformEntryCode, finalizeTransformEntryScript, handleTransformEntryPageLayoutFlow, inlineTransformAutoRoutes, loadTransformSource, preloadTransformSfcStyleBlocks, registerVueTemplateToken, resolveTransformEntryFlags, resolveVueOutputBase } from './shared'

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
    const source = await measureStage('readSource', async () => await loadTransformSource({
      code,
      filename,
      isDev: configService.isDev,
      readFileCached,
    }))

    await measureStage('preParseSfc', async () => {
      await preloadTransformSfcStyleBlocks({
        filename,
        source,
        styleBlocksCache,
        load: async (target, loadedSource) => (
          await readAndParseSfc(target, {
            ...createReadAndParseSfcOptions(pluginCtx, ctx.configService, {
              source: loadedSource,
              checkMtime: false,
            }),
          })
        ).descriptor.styles,
      })
    })

    const { isPage, isApp } = await measureStage('matchPageEntry', async () => await resolveTransformEntryFlags({
      pageMatcher,
      setPageMatcher,
      createPageMatcher: createPageEntryMatcher,
      configService,
      scanService: ctx.scanService,
      scanDirty: ctx.runtimeState.scan.isDirty,
      filename,
    }))

    let transformedSource = source
    if (isApp) {
      transformedSource = await measureStage('ensureAutoRoutes', async () => await inlineTransformAutoRoutes({
        source: transformedSource,
        autoRoutesService: ctx.autoRoutesService,
      }))
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
