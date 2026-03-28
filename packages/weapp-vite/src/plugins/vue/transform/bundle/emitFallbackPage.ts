import type { VueBundleState } from './shared'
import logger from '../../../../logger'
import { getPathExistsTtlMs } from '../../../../utils/cachePolicy'
import { pathExists as pathExistsCached } from '../../../utils/cache'
import { collectFallbackPageEntryIds } from '../fallbackEntries'
import { emitBundlePageLayoutsIfNeeded } from './layoutAssets'
import { addBundleWatchFile, emitFallbackPageBundleAssets, handleFallbackPageLayouts, loadFallbackPageEntryCompilation, resolveFallbackPageEntryFile, resolveVueBundleAssetContext } from './shared'

export async function emitFallbackPageAssets(
  bundle: Record<string, any>,
  state: VueBundleState,
) {
  const { ctx, pluginCtx, compilationCache, reExportResolutionCache, classStyleRuntimeWarned } = state
  const { configService, scanService } = ctx
  if (!configService || !scanService) {
    return
  }

  const compileOptionsState = { reExportResolutionCache, classStyleRuntimeWarned }
  const {
    outputExtensions,
    templateExtension,
    styleExtension,
    jsonExtension,
    scriptModuleExtension,
    platformAssetOptions,
  } = resolveVueBundleAssetContext(configService)

  const collectedEntries = await collectFallbackPageEntryIds(configService, scanService)
  for (const entryId of collectedEntries) {
    const relativeBase = configService.relativeOutputPath(entryId)
    if (!relativeBase) {
      continue
    }
    const entryFilePath = await resolveFallbackPageEntryFile({
      entryId,
      compilationCache,
      pathExists: async (candidate) => {
        return await pathExistsCached(candidate, { ttlMs: getPathExistsTtlMs(configService) })
          ? candidate
          : undefined
      },
    })
    if (entryFilePath === null) {
      continue
    }
    if (!entryFilePath) {
      continue
    }

    addBundleWatchFile(pluginCtx, entryFilePath)

    try {
      const { source, result } = await loadFallbackPageEntryCompilation({
        entryFilePath,
        ctx,
        pluginCtx,
        configService,
        compileOptionsState,
      })

      await handleFallbackPageLayouts({
        source,
        entryFilePath,
        configService,
        emitLayouts: async (layouts) => {
          await emitBundlePageLayoutsIfNeeded({
            layouts,
            pluginCtx,
            bundle,
            ctx,
            configService,
            compileOptionsState,
            outputExtensions,
          })
        },
      })

      emitFallbackPageBundleAssets({
        bundle,
        pluginCtx,
        ctx,
        filename: entryFilePath,
        relativeBase,
        result,
        configService,
        templateExtension,
        styleExtension,
        jsonExtension,
        scriptModuleExtension,
        outputExtensions,
        platformAssetOptions,
      })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`[Vue 编译] 编译 ${entryFilePath} 失败：${message}`)
    }
  }
}
