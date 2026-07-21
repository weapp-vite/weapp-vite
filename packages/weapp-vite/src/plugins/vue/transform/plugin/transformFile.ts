import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { CompilerContext } from '../../../../context'
import type { ResolvedAppShell } from '../appShell'
import type { CompileVueFileResolvedOptions } from '../compileOptions'
import type { VueCompilationCache, VueStyleBlocksCache } from './transformFile/types'
import { performance } from 'node:perf_hooks'
import { compileJsxFile, compileVueFile } from 'wevu/compiler'
import { recordHmrProfileDuration } from '../../../../utils/hmrProfile'
import { readFile as readFileCached } from '../../../utils/cache'
import { createPageEntryMatcher } from '../../../wevu'
import { getSourceFromVirtualId } from '../../resolver'
import { createCompileVueFileOptions, isVueTransformSourceMapEnabled } from '../compileOptions'
import { compileTransformEntryResult, createTransformStageMeasurer, isVueCssImporterDirtyReasonSummary, isVueStyleOnlyDirtyReasonSummary, loadTransformSource, logTransformFileError, normalizeVueTransformResult, resolveDirtyVueEntryId, resolveTransformAutoRoutesSource, resolveTransformEntryFlags, resolveTransformFilename } from './shared'
import { createSfcStyleBlocksSignature } from './styleOnlyRefresh'
import { finalizeVueTransform } from './transformFile/finalize'
import { tryRefreshJsonOnlyVueCompilation } from './transformFile/jsonOnly'
import { tryReuseVueCompilation } from './transformFile/reuse'

export async function transformVueLikeFile(options: {
  ctx: CompilerContext
  pluginCtx: any
  code: string
  id: string
  compilationCache: VueCompilationCache
  setAppShell: (shell: ResolvedAppShell | undefined) => void
  pageMatcher: ReturnType<typeof createPageEntryMatcher> | null
  setPageMatcher: (matcher: ReturnType<typeof createPageEntryMatcher>) => void
  scanDirtySynced: boolean
  setScanDirtySynced: (synced: boolean) => void
  reExportResolutionCache: Map<string, Map<string, string | undefined>>
  compileOptionsCache: Map<string, CompileVueFileResolvedOptions>
  componentMetaCache: NonNullable<CompileVueFileResolvedOptions['componentMetaCache']>
  styleBlocksCache: VueStyleBlocksCache
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
    const reuseResult = await tryReuseVueCompilation({
      ctx,
      pluginCtx,
      filename,
      source: transformedSource,
      cachedCompilation,
      previousStyleSignature,
      autoRoutesSignature,
      dirtyEntryId,
      dirtyVueEntryIds,
      isCssImporterDirty,
      canAttemptStyleOnlyReuse,
      sourceMap,
      isApp,
      styleBlocksCache,
      styleRefreshTokens,
      readAndParseSfc,
      createReadAndParseSfcOptions,
      measureStage,
      measureVueHmrStage,
      reportTiming,
    })
    if (reuseResult.returnedCode) {
      return {
        code: reuseResult.returnedCode.code,
        map: reuseResult.returnedCode.map,
      }
    }
    const { currentStyleIndependentSignature } = reuseResult
    const compileOptions = createCompileVueFileOptions(ctx, pluginCtx, filename, isPage, isApp, configService, {
      reExportResolutionCache,
      classStyleRuntimeWarned,
      compileOptionsCache,
      componentMetaCache,
    })

    const jsonOnlyResult = await measureVueHmrStage('refreshJsonConfig', 'vueCompileMs', async () => {
      return await tryRefreshJsonOnlyVueCompilation({
        cachedResult: cachedCompilation?.result,
        compileOptions,
        dirtyEntryId,
        dirtyReasonSummary: ctx.runtimeState?.build?.hmr?.profile?.dirtyReasonSummary,
        filename,
        isDev: configService.isDev,
        scanDirty: ctx.runtimeState.scan.isDirty,
        source: transformedSource,
        autoRoutesSignature,
        cachedAutoRoutesSignature: cachedCompilation?.autoRoutesSignature,
      })
    })
    if (jsonOnlyResult) {
      const returnedCode = await finalizeVueTransform({
        ctx,
        pluginCtx,
        filename,
        source: transformedSource,
        autoRoutesSignature,
        result: jsonOnlyResult,
        compilationCache,
        currentStyleIndependentSignature: cachedCompilation?.styleIndependentSignature,
        previousStyleSignature,
        dirtyEntryId,
        dirtyVueEntryIds,
        isCssImporterDirty,
        isPage,
        isApp,
        sourceMap,
        styleBlocksCache,
        styleRefreshTokens,
        scopedSlotModules,
        emittedScopedSlotChunks,
        setAppShell,
        readAndParseSfc,
        createReadAndParseSfcOptions,
        measureStage,
        measureVueHmrStage,
        reportTiming,
      })
      return {
        code: returnedCode.code,
        map: returnedCode.map,
      }
    }

    const result = normalizeVueTransformResult(await measureVueHmrStage('compile', 'vueCompileMs', async () => await compileTransformEntryResult({
      transformedSource,
      filename,
      compileOptions,
      compileVueFile,
      compileJsxFile,
    })))
    const returnedCode = await finalizeVueTransform({
      ctx,
      pluginCtx,
      filename,
      source: transformedSource,
      autoRoutesSignature,
      result,
      compilationCache,
      currentStyleIndependentSignature,
      previousStyleSignature,
      dirtyEntryId,
      dirtyVueEntryIds,
      isCssImporterDirty,
      isPage,
      isApp,
      sourceMap,
      styleBlocksCache,
      styleRefreshTokens,
      scopedSlotModules,
      emittedScopedSlotChunks,
      setAppShell,
      readAndParseSfc,
      createReadAndParseSfcOptions,
      measureStage,
      measureVueHmrStage,
      reportTiming,
    })

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
