import type { CompilationCacheEntry, VueBundleState } from './shared'
// eslint-disable-next-line e18e/ban-dependencies -- 当前 bundle 阶段仍统一复用 fs-extra 读取源码
import fs from 'fs-extra'
import { normalizeWatchPath } from '../../../../utils/path'
import { injectWevuPageFeaturesInJsWithViteResolver } from '../injectPageFeatures'
import { collectSetDataPickKeysFromTemplate, injectSetDataPickInJs, isAutoSetDataPickEnabled } from '../injectSetDataPick'
import { applyPageLayoutPlan, resolvePageLayoutPlan } from '../pageLayout'
import {
  emitNativeLayoutAssetsIfNeeded,
  emitResolvedBundleLayouts,
  emitScriptlessComponentJsFallbackIfMissing,
  emitVueLayoutScriptFallbackIfNeeded,
} from './layoutAssets'
import { resolveBundleOutputExtensions } from './outputExtensions'
import { resolveVueBundlePlatformAssetOptions } from './platform'
import { compileVueLikeFile, emitSharedVueEntryAssets, emitSharedVueEntryJsonAsset, getEntryBaseName, isAppVueLikeFile } from './shared'

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
  const outputExtensions = configService.outputExtensions
  const {
    templateExtension,
    jsonExtension,
    scriptExtension,
    scriptModuleExtension,
  } = resolveBundleOutputExtensions(outputExtensions)
  const platformAssetOptions = resolveVueBundlePlatformAssetOptions({
    configService,
    templateExtension,
    scriptModuleExtension,
  })

  let result = cached.result
  if (configService.isDev) {
    try {
      const source = await fs.readFile(filename, 'utf-8')
      if (source !== cached.source) {
        const isApp = isAppVueLikeFile(filename)
        const compiled = await compileVueLikeFile({
          source,
          filename,
          ctx,
          pluginCtx,
          isPage: cached.isPage,
          isApp,
          configService,
          compileOptionsState,
        })

        if (cached.isPage && compiled.script) {
          const injected = await injectWevuPageFeaturesInJsWithViteResolver(pluginCtx, compiled.script, filename, {
            checkMtime: configService.isDev,
          })
          if (injected.transformed) {
            compiled.script = injected.code
          }
        }
        if (
          !isApp
          && compiled.script
          && compiled.template
          && isAutoSetDataPickEnabled(configService.weappViteConfig)
        ) {
          const keys = collectSetDataPickKeysFromTemplate(compiled.template)
          const injectedPick = injectSetDataPickInJs(compiled.script, keys)
          if (injectedPick.transformed) {
            compiled.script = injectedPick.code
          }
        }

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
  const jsonConfig = configService.weappViteConfig?.json
  const jsonKind = isAppVue ? 'app' : cached.isPage ? 'page' : 'component'

  if (cached.isPage && cached.source) {
    const resolvedLayoutPlan = await resolvePageLayoutPlan(cached.source, filename, configService)
    if (resolvedLayoutPlan) {
      applyPageLayoutPlan(result, filename, resolvedLayoutPlan)
    }
    if (resolvedLayoutPlan?.layouts.length) {
      await emitResolvedBundleLayouts({
        layouts: resolvedLayoutPlan.layouts,
        emitNativeLayout: async (layoutFilePath) => {
          await emitNativeLayoutAssetsIfNeeded({
            pluginCtx,
            bundle,
            layoutBasePath: layoutFilePath,
            configService,
            outputExtensions,
          })
        },
        emitVueLayout: async (layoutFilePath) => {
          await emitVueLayoutScriptFallbackIfNeeded({
            pluginCtx,
            bundle,
            layoutFilePath,
            ctx,
            configService,
            compileOptionsState,
            outputExtensions,
          })
        },
      })
    }
  }

  emitSharedVueEntryAssets({
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
    scopedSlotDefaults: jsonConfig?.defaults?.component,
    scopedSlotMergeStrategy: jsonConfig?.mergeStrategy,
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
