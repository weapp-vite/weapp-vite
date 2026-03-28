import type { CompilationCacheEntry, VueBundleState } from './shared'
// eslint-disable-next-line e18e/ban-dependencies -- 当前 bundle 阶段仍统一复用 fs-extra 读取源码
import fs from 'fs-extra'
import { normalizeWatchPath } from '../../../../utils/path'
import { applyPageLayoutPlan, resolvePageLayoutPlan } from '../pageLayout'
import {
  emitBundlePageLayoutsIfNeeded,
  emitScriptlessComponentJsFallbackIfMissing,
} from './layoutAssets'
import { compileAndFinalizeVueLikeFile, emitBundleVueEntryAssets, emitSharedVueEntryJsonAsset, getEntryBaseName, isAppVueLikeFile, resolveVueBundleAssetContext } from './shared'

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

  let result = cached.result
  if (configService.isDev) {
    try {
      const source = await fs.readFile(filename, 'utf-8')
      if (source !== cached.source) {
        const isApp = isAppVueLikeFile(filename)
        const compiled = await compileAndFinalizeVueLikeFile({
          source,
          filename,
          ctx,
          pluginCtx,
          isPage: cached.isPage,
          isApp,
          configService,
          compileOptionsState,
        })

        cached.source = source
        cached.result = compiled
        result = compiled
      }
    }
    catch {
      // 忽略异常，回退到缓存的编译结果
    }
  }

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
