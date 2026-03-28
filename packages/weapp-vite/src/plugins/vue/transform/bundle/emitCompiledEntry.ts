import type { CompilationCacheEntry, VueBundleState } from './shared'
import {
  emitBundlePageLayoutsIfNeeded,
  emitScriptlessComponentJsFallbackIfMissing,
} from './layoutAssets'
import { addBundleWatchFile, emitCompiledEntryBundleAssets, getEntryBaseName, handleCompiledEntryPageLayouts, refreshCompiledVueEntryCacheInDev, resolveVueBundleAssetContext } from './shared'

export async function emitCompiledVueEntryAssets(
  bundle: Record<string, any>,
  state: VueBundleState,
  filename: string,
  cached: CompilationCacheEntry,
) {
  const { ctx, pluginCtx, reExportResolutionCache, classStyleRuntimeWarned } = state
  const { configService } = ctx
  if (!configService) {
    return
  }

  addBundleWatchFile(pluginCtx, filename)

  const compileOptionsState = { reExportResolutionCache, classStyleRuntimeWarned }
  const {
    outputExtensions,
    templateExtension,
    jsonExtension,
    scriptExtension,
    scriptModuleExtension,
    platformAssetOptions,
  } = resolveVueBundleAssetContext(configService)

  const result = await refreshCompiledVueEntryCacheInDev({
    filename,
    cached,
    ctx,
    pluginCtx,
    configService,
    compileOptionsState,
  })

  const baseName = getEntryBaseName(filename)
  const relativeBase = configService.relativeOutputPath(baseName)
  if (!relativeBase) {
    return
  }

  if (cached.isPage && cached.source) {
    await handleCompiledEntryPageLayouts({
      source: cached.source,
      filename,
      result,
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
  }

  const { shouldEmitComponentJson } = emitCompiledEntryBundleAssets({
    bundle,
    pluginCtx,
    ctx,
    filename,
    relativeBase,
    result,
    isPage: cached.isPage,
    configService,
    templateExtension,
    jsonExtension,
    scriptModuleExtension,
    outputExtensions,
    platformAssetOptions,
  })

  if (shouldEmitComponentJson && !result.script?.trim()) {
    emitScriptlessComponentJsFallbackIfMissing({
      pluginCtx,
      bundle,
      relativeBase,
      scriptExtension,
    })
  }
}
