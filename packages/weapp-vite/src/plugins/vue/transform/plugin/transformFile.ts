import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../context'
import type { ResolvedAppShell } from '../appShell'
import type { CompileVueFileResolvedOptions } from '../compileOptions'
import { compileJsxFile, compileVueFile } from 'wevu/compiler'
import { readFile as readFileCached } from '../../../utils/cache'
import { syncVueSfcStyleDependencies } from '../../../utils/invalidateEntry'
import { addNormalizedWatchFile } from '../../../utils/watchFiles'
import { createPageEntryMatcher } from '../../../wevu'
import { getSourceFromVirtualId } from '../../resolver'
import { createCompileVueFileOptions } from '../compileOptions'
import { emitScopedSlotChunks, registerScopedSlotHostGenerics } from '../scopedSlot'
import { compileTransformEntryResult, createTransformStageMeasurer, finalizeTransformCompiledResult, finalizeTransformEntryCode, loadTransformSource, logTransformFileError, normalizeVueTransformResult, preloadTransformSfcStyleBlocks, resolveTransformAutoRoutesSource, resolveTransformEntryFlags, resolveTransformFilename } from './shared'

function parseUsingComponents(config: string | undefined) {
  if (!config) {
    return {}
  }
  try {
    const parsed = JSON.parse(config)
    const usingComponents = parsed?.usingComponents
    return usingComponents && typeof usingComponents === 'object' && !Array.isArray(usingComponents)
      ? usingComponents as Record<string, string>
      : {}
  }
  catch {
    return {}
  }
}

function createSfcStyleBlocksSignature(styleBlocks: SFCStyleBlock[] | undefined) {
  if (!styleBlocks?.length) {
    return ''
  }
  return JSON.stringify(styleBlocks.map(styleBlock => ({
    attrs: styleBlock.attrs,
    content: styleBlock.content,
    lang: styleBlock.lang,
    module: styleBlock.module,
    scoped: styleBlock.scoped,
  })))
}

export async function transformVueLikeFile(options: {
  ctx: CompilerContext
  pluginCtx: any
  code: string
  id: string
  compilationCache: Map<string, { result: VueTransformResult, source?: string, isPage: boolean, autoRoutesSignature?: string, refreshToken?: number }>
  setAppShell: (shell: ResolvedAppShell | undefined) => void
  pageMatcher: ReturnType<typeof createPageEntryMatcher> | null
  setPageMatcher: (matcher: ReturnType<typeof createPageEntryMatcher>) => void
  scanDirtySynced: boolean
  setScanDirtySynced: (synced: boolean) => void
  reExportResolutionCache: Map<string, Map<string, string | undefined>>
  compileOptionsCache: Map<string, CompileVueFileResolvedOptions>
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

  try {
    const cachedCompilation = compilationCache.get(filename)
    const previousStyleSignature = createSfcStyleBlocksSignature(
      (cachedCompilation?.result.meta?.styleBlocks as SFCStyleBlock[] | undefined)
      ?? styleBlocksCache.get(filename),
    )
    const source = await measureStage('readSource', async () => await loadTransformSource({
      code,
      filename,
      isDev: configService.isDev,
      readFileCached,
    }))

    await measureStage('preloadSfcStyles', async () => {
      await preloadTransformSfcStyleBlocks({
        filename,
        source,
        styleBlocksCache,
        load: async (target, source) => {
          const parsed = await readAndParseSfc(target, createReadAndParseSfcOptions(pluginCtx, configService, {
            source,
            checkMtime: configService.isDev,
          }))
          return parsed.descriptor.styles
        },
      })
    })

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
    const compileOptions = createCompileVueFileOptions(ctx, pluginCtx, filename, isPage, isApp, configService, {
      reExportResolutionCache,
      classStyleRuntimeWarned,
      compileOptionsCache,
    })

    const result = normalizeVueTransformResult(await measureStage('compile', async () => await compileTransformEntryResult({
      transformedSource,
      filename,
      compileOptions,
      compileVueFile,
      compileJsxFile,
    })))
    const currentStyleBlocks = Array.isArray(result.meta?.styleBlocks)
      ? result.meta.styleBlocks as SFCStyleBlock[]
      : styleBlocksCache.get(filename)
    if (currentStyleBlocks) {
      styleBlocksCache.set(filename, currentStyleBlocks)
    }
    if (configService.isDev && ctx.runtimeState?.build?.hmr?.dirtyVueEntryIds?.has(filename)) {
      const currentStyleSignature = createSfcStyleBlocksSignature(currentStyleBlocks)
      const hmrEventId = ctx.runtimeState.build.hmr.profile.eventId
      if (hmrEventId != null && currentStyleSignature && currentStyleSignature !== previousStyleSignature) {
        styleRefreshTokens.set(filename, hmrEventId)
      }
      else {
        styleRefreshTokens.delete(filename)
      }
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

    await measureStage('finalizeCompiledResult', async () => {
      await finalizeTransformCompiledResult({
        ctx,
        pluginCtx,
        filename,
        source: transformedSource,
        autoRoutesSignature,
        result,
        compilationCache,
        setAppShell,
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
      styleBlocks: (result.meta?.styleBlocks as SFCStyleBlock[] | undefined) ?? styleBlocksCache.get(filename),
      isPage,
      isApp,
      isDev: configService.isDev,
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
