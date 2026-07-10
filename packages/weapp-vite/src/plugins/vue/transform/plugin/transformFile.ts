import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../context'
import type { ResolvedAppShell } from '../appShell'
import type { CompileVueFileResolvedOptions } from '../compileOptions'
import { performance } from 'node:perf_hooks'
import { compileJsxFile, compileVueFile } from 'wevu/compiler'
import { resolveVueSfcStyleIndependentSignature } from '../../../../utils/file/vueSfcSignature'
import { recordHmrProfileDuration } from '../../../../utils/hmrProfile'
import { readFile as readFileCached } from '../../../utils/cache'
import { syncVueSfcStyleDependencies } from '../../../utils/invalidateEntry'
import { addNormalizedWatchFile } from '../../../utils/watchFiles'
import { createPageEntryMatcher } from '../../../wevu'
import { getSourceFromVirtualId } from '../../resolver'
import { createCompileVueFileOptions, isVueTransformSourceMapEnabled } from '../compileOptions'
import { emitScopedSlotChunks, registerScopedSlotHostGenerics } from '../scopedSlot'
import { refreshStyleOnlyVueTransformResult } from '../styleOnly'
import { compileTransformEntryResult, createTransformStageMeasurer, finalizeTransformCompiledResult, finalizeTransformEntryCode, isVueCssImporterDirtyReasonSummary, isVueStyleOnlyDirtyReasonSummary, loadTransformSource, logTransformFileError, normalizeVueTransformResult, resolveDirtyVueEntryId, resolveTransformAutoRoutesSource, resolveTransformEntryFlags, resolveTransformFilename } from './shared'
import { createSfcStyleBlocksSignature, loadStyleBlocksForStyleOnlyRefresh } from './styleOnlyRefresh'
import { parseUsingComponents } from './usingComponents'

export async function transformVueLikeFile(options: {
  ctx: CompilerContext
  pluginCtx: any
  code: string
  id: string
  compilationCache: Map<string, { result: VueTransformResult, source?: string, isPage: boolean, autoRoutesSignature?: string, refreshToken?: number, styleIndependentSignature?: string }>
  setAppShell: (shell: ResolvedAppShell | undefined) => void
  pageMatcher: ReturnType<typeof createPageEntryMatcher> | null
  setPageMatcher: (matcher: ReturnType<typeof createPageEntryMatcher>) => void
  scanDirtySynced: boolean
  setScanDirtySynced: (synced: boolean) => void
  reExportResolutionCache: Map<string, Map<string, string | undefined>>
  compileOptionsCache: Map<string, CompileVueFileResolvedOptions>
  componentMetaCache: NonNullable<CompileVueFileResolvedOptions['componentMetaCache']>
  styleBlocksCache: Map<string, SFCStyleBlock[]>
  styleRefreshTokens: Map<string, number | string>
  scopedSlotModules: Map<string, string>
  emittedScopedSlotChunks: Set<string>
  classStyleRuntimeWarned: { value: boolean }
  readAndParseSfc: typeof import('../../../utils/vueSfc').readAndParseSfc
  createReadAndParseSfcOptions: typeof import('../../../utils/vueSfc').createReadAndParseSfcOptions
}) {
  const {
    ctx,
    pluginCtx,
    code,
    id,
    compilationCache,
    setAppShell,
    pageMatcher,
    setPageMatcher,
    scanDirtySynced,
    setScanDirtySynced,
    reExportResolutionCache,
    compileOptionsCache,
    componentMetaCache,
    styleBlocksCache,
    styleRefreshTokens,
    scopedSlotModules,
    emittedScopedSlotChunks,
    classStyleRuntimeWarned,
    readAndParseSfc,
    createReadAndParseSfcOptions,
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
  const sourceMap = isVueTransformSourceMapEnabled(configService)
  const measureVueHmrStage = async <T>(
    stage: string,
    profileKey: Parameters<typeof recordHmrProfileDuration>[1],
    action: () => Promise<T>,
  ) => {
    const startedAt = performance.now()
    try {
      return await measureStage(stage, action)
    }
    finally {
      recordHmrProfileDuration(
        ctx.runtimeState.build?.hmr?.profile,
        profileKey,
        performance.now() - startedAt,
      )
    }
  }

  try {
    const cachedCompilation = compilationCache.get(filename)
    const previousStyleSignature = createSfcStyleBlocksSignature(
      (cachedCompilation?.result.meta?.styleBlocks as SFCStyleBlock[] | undefined)
      ?? styleBlocksCache.get(filename),
    )
    const source = await measureVueHmrStage('readSource', 'vueReadSourceMs', async () => await loadTransformSource({
      code,
      filename,
      isDev: configService.isDev,
      readFileCached,
    }))

    const { isPage, isApp } = await measureStage('matchPageEntry', async () => await resolveTransformEntryFlags({
      pageMatcher,
      setPageMatcher,
      createPageMatcher: createPageEntryMatcher,
      configService,
      scanService: ctx.scanService,
      scanDirty: ctx.runtimeState.scan.isDirty,
      scanDirtySynced,
      setScanDirtySynced,
      filename,
    }))

    let transformedSource = source
    let autoRoutesSignature: string | undefined
    if (isApp) {
      const transformed = await measureStage('ensureAutoRoutes', async () => await resolveTransformAutoRoutesSource({
        source: transformedSource,
        autoRoutesService: ctx.autoRoutesService,
      }))
      transformedSource = transformed.source
      autoRoutesSignature = transformed.signature
    }
    const dirtyVueEntryIds = ctx.runtimeState?.build?.hmr?.dirtyVueEntryIds
    const dirtyEntryId = resolveDirtyVueEntryId(dirtyVueEntryIds, filename)
    const isCssImporterDirty = isVueCssImporterDirtyReasonSummary(
      ctx.runtimeState?.build?.hmr?.profile?.dirtyReasonSummary,
    )
    const canAttemptStyleOnlyReuse = isVueStyleOnlyDirtyReasonSummary(
      ctx.runtimeState?.build?.hmr?.profile?.dirtyReasonSummary,
    )
    if (
      configService.isDev
      && cachedCompilation
      && !ctx.runtimeState.scan.isDirty
      && cachedCompilation.source === transformedSource
      && cachedCompilation.autoRoutesSignature === autoRoutesSignature
    ) {
      cachedCompilation.refreshToken = 0
      const cachedResult = normalizeVueTransformResult(cachedCompilation.result)
      let cachedStyleBlocks = (cachedResult.meta?.styleBlocks as SFCStyleBlock[] | undefined) ?? styleBlocksCache.get(filename)
      let canReturnCachedCompilation = true
      if (dirtyEntryId && canAttemptStyleOnlyReuse && filename.endsWith('.vue')) {
        const refreshedStyleBlocks = await measureStage('loadStyleOnlySfcStyles', async () => await loadStyleBlocksForStyleOnlyRefresh({
          filename,
          source: transformedSource,
          styleBlocksCache,
          force: true,
          readAndParseSfc,
          createReadAndParseSfcOptions,
          pluginCtx,
          configService,
        }))
        const didRefreshStyle = refreshStyleOnlyVueTransformResult(cachedResult, filename, refreshedStyleBlocks)
        if (!didRefreshStyle) {
          cachedCompilation.styleIndependentSignature = undefined
          canReturnCachedCompilation = false
        }
        else {
          cachedStyleBlocks = refreshedStyleBlocks
          cachedCompilation.result = cachedResult
          const currentStyleSignature = createSfcStyleBlocksSignature(cachedStyleBlocks)
          const hmrEventId = ctx.runtimeState.build?.hmr?.profile?.eventId
          if (
            hmrEventId != null
            && (
              isCssImporterDirty
              || (currentStyleSignature && currentStyleSignature !== previousStyleSignature)
            )
          ) {
            styleRefreshTokens.set(filename, hmrEventId)
          }
          else {
            styleRefreshTokens.delete(filename)
          }
        }
      }
      if (!canReturnCachedCompilation) {
        cachedCompilation.refreshToken = 1
      }
      else {
        const returnedCode = await measureVueHmrStage('finalizeCode', 'vueFinalizeCodeMs', async () => finalizeTransformEntryCode({
          result: cachedResult,
          filename,
          styleBlocks: cachedStyleBlocks,
          isPage: cachedCompilation.isPage,
          isApp,
          isDev: configService.isDev,
          sourceMap,
          hmrStyleToken: styleRefreshTokens.get(filename),
        }))

        if (dirtyEntryId) {
          dirtyVueEntryIds?.delete(dirtyEntryId)
        }
        reportTiming(filename, cachedCompilation.isPage)

        return {
          code: returnedCode.code,
          map: returnedCode.map,
        }
      }
    }
    const currentStyleIndependentSignature = (configService.isDev && dirtyEntryId && canAttemptStyleOnlyReuse && filename.endsWith('.vue'))
      ? resolveVueSfcStyleIndependentSignature(transformedSource, filename)
      : undefined
    const canReuseStyleOnlyVueCompilation = Boolean(
      configService.isDev
      && cachedCompilation
      && dirtyEntryId
      && canAttemptStyleOnlyReuse
      && filename.endsWith('.vue')
      && !ctx.runtimeState.scan.isDirty
      && cachedCompilation.autoRoutesSignature === autoRoutesSignature
      && cachedCompilation.styleIndependentSignature
      && currentStyleIndependentSignature
      && cachedCompilation.styleIndependentSignature === currentStyleIndependentSignature
      && cachedCompilation.source !== transformedSource,
    )
    if (canReuseStyleOnlyVueCompilation && cachedCompilation) {
      const cachedResult = normalizeVueTransformResult(cachedCompilation.result)
      const styleBlocks = await measureStage('loadStyleOnlySfcStyles', async () => await loadStyleBlocksForStyleOnlyRefresh({
        filename,
        source: transformedSource,
        styleBlocksCache,
        force: true,
        readAndParseSfc,
        createReadAndParseSfcOptions,
        pluginCtx,
        configService,
      }))
      const didRefreshStyle = refreshStyleOnlyVueTransformResult(cachedResult, filename, styleBlocks)
      if (!didRefreshStyle) {
        cachedCompilation.styleIndependentSignature = undefined
      }
      else {
        cachedCompilation.source = transformedSource
        cachedCompilation.result = cachedResult
        cachedCompilation.styleIndependentSignature = currentStyleIndependentSignature
        cachedCompilation.refreshToken = 0
        const hmrEventId = ctx.runtimeState.build?.hmr?.profile?.eventId
        if (hmrEventId != null && (isCssImporterDirty || styleBlocks?.length)) {
          styleRefreshTokens.set(filename, hmrEventId)
        }
        const returnedCode = await measureVueHmrStage('finalizeCode', 'vueFinalizeCodeMs', async () => finalizeTransformEntryCode({
          result: cachedResult,
          filename,
          styleBlocks,
          isPage: cachedCompilation.isPage,
          isApp,
          isDev: configService.isDev,
          sourceMap,
          hmrStyleToken: styleRefreshTokens.get(filename),
        }))

        if (dirtyEntryId) {
          dirtyVueEntryIds?.delete(dirtyEntryId)
        }
        reportTiming(filename, cachedCompilation.isPage)

        return {
          code: returnedCode.code,
          map: returnedCode.map,
        }
      }
    }
    const compileOptions = createCompileVueFileOptions(ctx, pluginCtx, filename, isPage, isApp, configService, {
      reExportResolutionCache,
      classStyleRuntimeWarned,
      compileOptionsCache,
      componentMetaCache,
    })

    const result = normalizeVueTransformResult(await measureVueHmrStage('compile', 'vueCompileMs', async () => await compileTransformEntryResult({
      transformedSource,
      filename,
      compileOptions,
      compileVueFile,
      compileJsxFile,
    })))
    let currentStyleBlocks = Array.isArray(result.meta?.styleBlocks)
      ? result.meta.styleBlocks as SFCStyleBlock[]
      : styleBlocksCache.get(filename)
    if (!currentStyleBlocks) {
      currentStyleBlocks = await measureStage('preloadSfcStyles', async () => await loadStyleBlocksForStyleOnlyRefresh({
        filename,
        source: transformedSource,
        styleBlocksCache,
        readAndParseSfc,
        createReadAndParseSfcOptions,
        pluginCtx,
        configService,
      }))
    }
    if (currentStyleBlocks) {
      styleBlocksCache.set(filename, currentStyleBlocks)
    }
    if (configService.isDev && dirtyEntryId) {
      const currentStyleSignature = createSfcStyleBlocksSignature(currentStyleBlocks)
      const hmrEventId = ctx.runtimeState.build?.hmr?.profile?.eventId
      if (
        hmrEventId != null
        && (
          isCssImporterDirty
          || (currentStyleSignature && currentStyleSignature !== previousStyleSignature)
        )
      ) {
        styleRefreshTokens.set(filename, hmrEventId)
      }
      else {
        styleRefreshTokens.delete(filename)
      }
      dirtyVueEntryIds?.delete(dirtyEntryId)
    }
    const sfcStyleDependencies = syncVueSfcStyleDependencies(
      ctx,
      filename,
      currentStyleBlocks,
    )
    for (const dependency of sfcStyleDependencies) {
      addNormalizedWatchFile(pluginCtx, dependency)
    }
    registerScopedSlotHostGenerics(ctx, result.scopedSlotComponents, parseUsingComponents(result.config))

    await measureVueHmrStage('finalizeCompiledResult', 'vueFinalizeCompiledMs', async () => {
      await finalizeTransformCompiledResult({
        ctx,
        pluginCtx,
        filename,
        source: transformedSource,
        autoRoutesSignature,
        result,
        compilationCache,
        styleIndependentSignature: filename.endsWith('.vue')
          ? (currentStyleIndependentSignature ?? resolveVueSfcStyleIndependentSignature(transformedSource, filename))
          : undefined,
        setAppShell,
        configService,
        isPage,
        isApp,
        sourceMap,
        scopedSlotModules,
        emittedScopedSlotChunks,
        addWatchFile: addNormalizedWatchFile,
        emitScopedSlotChunks,
      })
    })

    const returnedCode = await measureVueHmrStage('finalizeCode', 'vueFinalizeCodeMs', async () => finalizeTransformEntryCode({
      result,
      filename,
      styleBlocks: (result.meta?.styleBlocks as SFCStyleBlock[] | undefined) ?? styleBlocksCache.get(filename),
      isPage,
      isApp,
      isDev: configService.isDev,
      sourceMap,
      hmrStyleToken: configService.isDev ? styleRefreshTokens.get(filename) : undefined,
    }))

    reportTiming(filename, isPage)

    return {
      code: returnedCode.code,
      map: returnedCode.map,
    }
  }
  catch (error) {
    logTransformFileError(filename, error)
    throw error
  }
}
