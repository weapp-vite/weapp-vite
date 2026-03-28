import type { ClassStyleWxsAsset, CompilationCacheEntry, VueBundleState } from './shared'
// eslint-disable-next-line e18e/ban-dependencies -- 当前 bundle 阶段仍统一复用 fs-extra 读取源码
import fs from 'fs-extra'
import { getClassStyleWxsSource } from 'wevu/compiler'
import { normalizeWatchPath } from '../../../../utils/path'
import { resolveClassStyleWxsLocationForBase } from '../classStyle'
import { emitClassStyleWxsAssetIfMissing, emitSfcJsonAsset } from '../emitAssets'
import { injectWevuPageFeaturesInJsWithViteResolver } from '../injectPageFeatures'
import { collectSetDataPickKeysFromTemplate, injectSetDataPickInJs, isAutoSetDataPickEnabled } from '../injectSetDataPick'
import { applyPageLayoutPlan, resolvePageLayoutPlan } from '../pageLayout'
import { emitScopedSlotAssets } from '../scopedSlot'
import { emitNativeLayoutAssetsIfNeeded, emitScriptlessComponentJsFallbackIfMissing, emitVueLayoutScriptFallbackIfNeeded } from './layoutAssets'
import { resolveBundleOutputExtensions } from './outputExtensions'
import { emitPlatformTemplateAsset, preparePlatformConfigAsset, resolveVueBundlePlatformAssetOptions } from './platform'
import { compileVueLikeFile, getEntryBaseName, isAppVueLikeFile } from './shared'

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
    if (resolvedLayoutPlan?.layouts.some(layout => layout.kind === 'native')) {
      for (const layout of resolvedLayoutPlan.layouts) {
        if (layout.kind !== 'native') {
          continue
        }
        await emitNativeLayoutAssetsIfNeeded({
          pluginCtx,
          bundle,
          layoutBasePath: layout.file,
          configService,
          outputExtensions,
        })
      }
    }
    if (resolvedLayoutPlan?.layouts.some(layout => layout.kind === 'vue')) {
      for (const layout of resolvedLayoutPlan.layouts) {
        if (layout.kind !== 'vue') {
          continue
        }
        await emitVueLayoutScriptFallbackIfNeeded({
          pluginCtx,
          bundle,
          layoutFilePath: layout.file,
          ctx,
          configService,
          compileOptionsState,
          outputExtensions,
        })
      }
    }
  }

  if (result.template) {
    emitPlatformTemplateAsset(bundle, {
      ctx,
      pluginCtx,
      filename,
      relativeBase,
      template: result.template,
      ...platformAssetOptions,
    })
  }

  const wxsExtension = scriptModuleExtension
  const needsClassStyleWxs = Boolean(result.classStyleWxs)
    || Boolean(result.scopedSlotComponents?.some(slot => slot.classStyleWxs))
  let classStyleWxs: ClassStyleWxsAsset | undefined
  if (needsClassStyleWxs && typeof wxsExtension === 'string' && wxsExtension.length > 0) {
    const classStyleWxsLocation = resolveClassStyleWxsLocationForBase(ctx, relativeBase, wxsExtension, configService)
    classStyleWxs = {
      fileName: classStyleWxsLocation.fileName,
      source: getClassStyleWxsSource({ extension: wxsExtension }),
    }
  }

  if (result.classStyleWxs && classStyleWxs) {
    emitClassStyleWxsAssetIfMissing(
      pluginCtx,
      bundle,
      classStyleWxs.fileName,
      classStyleWxs.source,
    )
  }

  emitScopedSlotAssets(pluginCtx, bundle, relativeBase, result, ctx, classStyleWxs, outputExtensions, {
    defaults: jsonConfig?.defaults?.component,
    mergeStrategy: jsonConfig?.mergeStrategy,
  })

  if (result.config || shouldEmitComponentJson) {
    const normalizedConfig = preparePlatformConfigAsset(bundle, {
      pluginCtx,
      relativeBase,
      config: result.config,
      outputExtensions,
      ...platformAssetOptions,
    })
    emitSfcJsonAsset(pluginCtx, bundle, relativeBase, { config: normalizedConfig }, {
      defaultConfig: shouldEmitComponentJson ? { component: true } : undefined,
      mergeExistingAsset: shouldMergeJsonAsset,
      mergeStrategy: jsonConfig?.mergeStrategy,
      defaults: jsonConfig?.defaults?.[jsonKind],
      kind: jsonKind,
      extension: jsonExtension,
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
