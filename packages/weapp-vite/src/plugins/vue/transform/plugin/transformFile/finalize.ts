import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../../context'
import type { ResolvedAppShell } from '../../appShell'
import type { TransformStageMeasurer, VueCompilationCache, VueHmrStageMeasurer, VueStyleBlocksCache } from './types'
import { resolveVueSfcStyleIndependentSignature } from '../../../../../utils/file/vueSfcSignature'
import { syncVueSfcStyleDependencies } from '../../../../utils/invalidateEntry'
import { emitScopedSlotChunks, registerScopedSlotHostGenerics } from '../../scopedSlot'
import { finalizeTransformCompiledResult, finalizeTransformEntryCode } from '../shared'
import { createSfcStyleBlocksSignature, loadStyleBlocksForStyleOnlyRefresh } from '../styleOnlyRefresh'
import { parseUsingComponents } from '../usingComponents'

export async function finalizeVueTransform(options: {
  ctx: CompilerContext
  pluginCtx: any
  filename: string
  source: string
  autoRoutesSignature?: string
  result: VueTransformResult
  compilationCache: VueCompilationCache
  currentStyleIndependentSignature?: string
  previousStyleSignature?: string
  dirtyEntryId?: string
  dirtyVueEntryIds?: Set<string>
  isCssImporterDirty: boolean
  isPage: boolean
  isApp: boolean
  sourceMap: boolean
  styleBlocksCache: VueStyleBlocksCache
  styleRefreshTokens: Map<string, number | string>
  scopedSlotModules: Map<string, string>
  emittedScopedSlotChunks: Set<string>
  setAppShell: (shell: ResolvedAppShell | undefined) => void
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
  } = options
  const configService = ctx.configService!
  let currentStyleBlocks = Array.isArray(result.meta?.styleBlocks)
    ? result.meta.styleBlocks as SFCStyleBlock[]
    : styleBlocksCache.get(filename)
  if (!currentStyleBlocks) {
    currentStyleBlocks = await measureStage('preloadSfcStyles', async () => await loadStyleBlocksForStyleOnlyRefresh({
      filename,
      source,
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
  ctx.moduleGraphService.replaceEntryDependencies(filename, 'style', sfcStyleDependencies)
  registerScopedSlotHostGenerics(ctx, result.scopedSlotComponents, parseUsingComponents(result.config))

  await measureVueHmrStage('finalizeCompiledResult', 'vueFinalizeCompiledMs', async () => {
    await finalizeTransformCompiledResult({
      ctx,
      pluginCtx,
      filename,
      source,
      autoRoutesSignature,
      result,
      compilationCache,
      styleIndependentSignature: filename.endsWith('.vue')
        ? (currentStyleIndependentSignature ?? resolveVueSfcStyleIndependentSignature(source, filename))
        : undefined,
      setAppShell,
      configService,
      isPage,
      isApp,
      sourceMap,
      scopedSlotModules,
      emittedScopedSlotChunks,
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
  return returnedCode
}
