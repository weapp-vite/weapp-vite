import type { CompilationCacheEntry, VueBundleState } from './shared'
import { applyPageLayoutPlan, resolvePageLayoutPlan } from '../pageLayout'
import {
  emitBundlePageLayoutsIfNeeded,
  emitScriptlessComponentJsFallbackIfMissing,
} from './layoutAssets'
import { addBundleWatchFile, emitCompiledEntryBundleAssets, getEntryBaseName, refreshCompiledVueEntryCacheInDev, resolveVueBundleAssetContext } from './shared'

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
    const resolvedLayoutPlan = await resolvePageLayoutPlan(cached.source, filename, configService)
    if (resolvedLayoutPlan) {
      applyPageLayoutPlan(result, filename, resolvedLayoutPlan)
    }
    await emitBundlePageLayoutsIfNeeded({
      layouts: resolvedLayoutPlan?.layouts,
      pluginCtx,
      bundle,
      ctx,
      configService,
      compileOptionsState,
      outputExtensions,
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
