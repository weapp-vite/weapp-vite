import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { CompilerContext } from '../../../../../context'
import type { TransformStageMeasurer, VueCompilationCacheEntry, VueHmrStageMeasurer, VueStyleBlocksCache } from './types'
import { resolveVueSfcStyleIndependentSignature } from '../../../../../utils/file/vueSfcSignature'
import { refreshStyleOnlyVueTransformResult } from '../../styleOnly'
import { finalizeTransformEntryCode, normalizeVueTransformResult } from '../shared'
import { createSfcStyleBlocksSignature, loadStyleBlocksForStyleOnlyRefresh } from '../styleOnlyRefresh'

export async function tryReuseVueCompilation(options: {
  ctx: CompilerContext
  pluginCtx: any
  filename: string
  source: string
  cachedCompilation: VueCompilationCacheEntry | undefined
  previousStyleSignature?: string
  autoRoutesSignature?: string
  dirtyEntryId?: string
  dirtyVueEntryIds?: Set<string>
  isCssImporterDirty: boolean
  canAttemptStyleOnlyReuse: boolean
  sourceMap: boolean
  isApp: boolean
  styleBlocksCache: VueStyleBlocksCache
  styleRefreshTokens: Map<string, number | string>
  readAndParseSfc: typeof import('../../../../utils/vueSfc').readAndParseSfc
  createReadAndParseSfcOptions: typeof import('../../../../utils/vueSfc').createReadAndParseSfcOptions
  measureStage: TransformStageMeasurer
  measureVueHmrStage: VueHmrStageMeasurer
  reportTiming: (filename: string, isPage: boolean) => void
}) {
  const {
    ctx,
    pluginCtx,
    filename,
    source,
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
  } = options
  const configService = ctx.configService!

  if (
    configService.isDev
    && cachedCompilation
    && !ctx.runtimeState.scan.isDirty
    && cachedCompilation.source === source
    && cachedCompilation.autoRoutesSignature === autoRoutesSignature
  ) {
    cachedCompilation.refreshToken = 0
    const cachedResult = normalizeVueTransformResult(cachedCompilation.result)
    let cachedStyleBlocks = (cachedResult.meta?.styleBlocks as SFCStyleBlock[] | undefined) ?? styleBlocksCache.get(filename)
    let canReturnCachedCompilation = true
    if (dirtyEntryId && canAttemptStyleOnlyReuse && filename.endsWith('.vue')) {
      const refreshedStyleBlocks = await measureStage('loadStyleOnlySfcStyles', async () => await loadStyleBlocksForStyleOnlyRefresh({
        filename,
        source,
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

      return { returnedCode }
    }
  }

  const currentStyleIndependentSignature = (configService.isDev && dirtyEntryId && canAttemptStyleOnlyReuse && filename.endsWith('.vue'))
    ? resolveVueSfcStyleIndependentSignature(source, filename)
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
    && cachedCompilation.source !== source,
  )
  if (canReuseStyleOnlyVueCompilation && cachedCompilation) {
    const cachedResult = normalizeVueTransformResult(cachedCompilation.result)
    const styleBlocks = await measureStage('loadStyleOnlySfcStyles', async () => await loadStyleBlocksForStyleOnlyRefresh({
      filename,
      source,
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
      cachedCompilation.source = source
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

      return { currentStyleIndependentSignature, returnedCode }
    }
  }

  return { currentStyleIndependentSignature }
}
