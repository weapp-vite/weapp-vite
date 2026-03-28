import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../context'
import { compileJsxFile, compileVueFile } from 'wevu/compiler'
import { readFile as readFileCached } from '../../../utils/cache'
import { createReadAndParseSfcOptions, readAndParseSfc } from '../../../utils/vueSfc'
import { addNormalizedWatchFile } from '../../../utils/watchFiles'
import { createPageEntryMatcher } from '../../../wevu'
import { getSourceFromVirtualId } from '../../resolver'
import { createCompileVueFileOptions } from '../compileOptions'
import { emitScopedSlotChunks } from '../scopedSlot'
import { compileTransformEntryResult, createTransformStageMeasurer, finalizeTransformCompiledResult, finalizeTransformEntryCode, inlineTransformAutoRoutes, loadTransformSource, logTransformFileError, preloadTransformSfcStyleBlocks, resolveTransformEntryFlags, resolveTransformFilename } from './shared'

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
  const { measureStage, reportTiming } = createTransformStageMeasurer(vueTransformTiming)

  const configService = ctx.configService
  if (!configService) {
    return null
  }

  const filename = resolveTransformFilename({
    id,
    configService,
    pluginCtx,
    getSourceFromVirtualId,
    addWatchFile: addNormalizedWatchFile,
  })
  if (!filename) {
    return null
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

    const result = await measureStage('compile', async () => await compileTransformEntryResult({
      transformedSource,
      filename,
      compileOptions,
      compileVueFile,
      compileJsxFile,
    }))

    await measureStage('finalizeCompiledResult', async () => {
      await finalizeTransformCompiledResult({
        ctx,
        pluginCtx,
        filename,
        source: transformedSource,
        result,
        compilationCache,
        configService,
        isPage,
        isApp,
        scopedSlotModules,
        emittedScopedSlotChunks,
        addWatchFile: addNormalizedWatchFile,
        emitScopedSlotChunks,
      })
    })

    const returnedCode = await measureStage('finalizeCode', async () => finalizeTransformEntryCode({
      result,
      filename,
      styleBlocks: styleBlocksCache.get(filename),
      isPage,
      isApp,
      isDev: configService.isDev,
    }))

    reportTiming(filename, isPage)

    return {
      code: returnedCode,
      map: null,
    }
  }
  catch (error) {
    logTransformFileError(filename, error)
    throw error
  }
}
