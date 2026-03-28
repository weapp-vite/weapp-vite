import type { CompilationCacheEntry, VueBundleState } from './shared'
import { normalizeWatchPath } from '../../../../utils/path'
import { applyPageLayoutPlan, resolvePageLayoutPlan } from '../pageLayout'
import {
  emitBundlePageLayoutsIfNeeded,
  emitScriptlessComponentJsFallbackIfMissing,
} from './layoutAssets'
import { emitBundleVueEntryAssets, emitSharedVueEntryJsonAsset, getEntryBaseName, isAppVueLikeFile, refreshCompiledVueEntryCacheInDev, resolveVueBundleAssetContext } from './shared'

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

  if (typeof pluginCtx.addWatchFile === 'function') {
    pluginCtx.addWatchFile(normalizeWatchPath(filename))
  }

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

  const isAppVue = isAppVueLikeFile(filename)
  const shouldEmitComponentJson = !isAppVue && !cached.isPage
  const shouldMergeJsonAsset = isAppVue
  const jsonKind = isAppVue ? 'app' : cached.isPage ? 'page' : 'component'

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

  const { jsonConfig } = emitBundleVueEntryAssets({
    bundle,
    pluginCtx,
    ctx,
    filename,
    relativeBase,
    result,
    configService,
    templateExtension,
    scriptModuleExtension,
    outputExtensions,
    platformAssetOptions,
  })

  if (result.config || shouldEmitComponentJson) {
    emitSharedVueEntryJsonAsset({
      bundle,
      pluginCtx,
      relativeBase,
      config: result.config,
      outputExtensions,
      platformAssetOptions,
      jsonOptions: {
        defaultConfig: shouldEmitComponentJson ? { component: true } : undefined,
        mergeExistingAsset: shouldMergeJsonAsset,
        mergeStrategy: jsonConfig?.mergeStrategy,
        defaults: jsonConfig?.defaults?.[jsonKind],
        kind: jsonKind,
        extension: jsonExtension,
      },
    })
  }

  if (!isAppVue && !cached.isPage && !result.script?.trim()) {
    emitScriptlessComponentJsFallbackIfMissing({
      pluginCtx,
      bundle,
      relativeBase,
      scriptExtension,
    })
  }
}
