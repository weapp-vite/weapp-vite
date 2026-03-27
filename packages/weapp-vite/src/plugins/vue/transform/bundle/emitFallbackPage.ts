import type { ClassStyleWxsAsset, VueBundleState } from './shared'
// eslint-disable-next-line e18e/ban-dependencies -- 当前 bundle 阶段仍统一复用 fs-extra 读取源码
import fs from 'fs-extra'
import { getClassStyleWxsSource } from 'wevu/compiler'
import logger from '../../../../logger'
import { getPathExistsTtlMs } from '../../../../utils/cachePolicy'
import { normalizeWatchPath } from '../../../../utils/path'
import { pathExists as pathExistsCached } from '../../../utils/cache'
import { resolveClassStyleWxsLocationForBase } from '../classStyle'
import { emitClassStyleWxsAssetIfMissing, emitSfcJsonAsset, emitSfcStyleIfMissing } from '../emitAssets'
import { collectFallbackPageEntryIds } from '../fallbackEntries'
import { injectWevuPageFeaturesInJsWithViteResolver } from '../injectPageFeatures'
import { collectSetDataPickKeysFromTemplate, injectSetDataPickInJs, isAutoSetDataPickEnabled } from '../injectSetDataPick'
import { resolvePageLayoutPlan } from '../pageLayout'
import { emitScopedSlotAssets } from '../scopedSlot'
import { emitNativeLayoutAssetsIfNeeded, emitVueLayoutScriptFallbackIfNeeded } from './layoutAssets'
import { resolveBundleOutputExtensions } from './outputExtensions'
import { emitPlatformTemplateAsset, preparePlatformConfigAsset } from './platform'
import { compileVueLikeFile } from './shared'

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
  const outputExtensions = configService.outputExtensions
  const {
    templateExtension,
    styleExtension,
    jsonExtension,
    scriptModuleExtension,
  } = resolveBundleOutputExtensions(outputExtensions)

  const collectedEntries = await collectFallbackPageEntryIds(configService, scanService)
  for (const entryId of collectedEntries) {
    const relativeBase = configService.relativeOutputPath(entryId)
    if (!relativeBase) {
      continue
    }
    const candidatePaths = [`${entryId}.vue`, `${entryId}.tsx`, `${entryId}.jsx`]
    const existingPath = candidatePaths.find(candidate => compilationCache.has(candidate))
    if (existingPath) {
      continue
    }

    let entryFilePath: string | undefined
    for (const candidate of candidatePaths) {
      if (await pathExistsCached(candidate, { ttlMs: getPathExistsTtlMs(configService) })) {
        entryFilePath = candidate
        break
      }
    }
    if (!entryFilePath) {
      continue
    }

    if (typeof pluginCtx.addWatchFile === 'function') {
      pluginCtx.addWatchFile(normalizeWatchPath(entryFilePath))
    }

    try {
      const source = await fs.readFile(entryFilePath, 'utf-8')
      const result = await compileVueLikeFile({
        source,
        filename: entryFilePath,
        ctx,
        pluginCtx,
        isPage: true,
        isApp: false,
        configService,
        compileOptionsState,
      })

      if (result.script) {
        const injected = await injectWevuPageFeaturesInJsWithViteResolver(pluginCtx, result.script, entryFilePath, {
          checkMtime: configService.isDev,
        })
        if (injected.transformed) {
          result.script = injected.code
        }
      }
      if (
        result.script
        && result.template
        && isAutoSetDataPickEnabled(configService.weappViteConfig)
      ) {
        const keys = collectSetDataPickKeysFromTemplate(result.template)
        const injectedPick = injectSetDataPickInJs(result.script, keys)
        if (injectedPick.transformed) {
          result.script = injectedPick.code
        }
      }

      const resolvedLayoutPlan = await resolvePageLayoutPlan(source, entryFilePath, configService)
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

      if (result.template) {
        emitPlatformTemplateAsset(bundle, {
          ctx,
          pluginCtx,
          filename: entryFilePath,
          relativeBase,
          template: result.template,
          platform: configService.platform,
          templateExtension,
          scriptModuleExtension,
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

      const jsonConfig = configService.weappViteConfig?.json
      emitScopedSlotAssets(pluginCtx, bundle, relativeBase, result, ctx, classStyleWxs, outputExtensions, {
        defaults: jsonConfig?.defaults?.component,
        mergeStrategy: jsonConfig?.mergeStrategy,
      })

      if (result.style) {
        emitSfcStyleIfMissing(pluginCtx, bundle, relativeBase, result.style, styleExtension)
      }

      const normalizedConfig = preparePlatformConfigAsset(bundle, {
        pluginCtx,
        relativeBase,
        config: result.config,
        outputExtensions,
        platform: configService.platform,
        dependencies: configService.packageJson?.dependencies,
        alipayNpmMode: configService.weappViteConfig?.npm?.alipayNpmMode,
      })
      emitSfcJsonAsset(pluginCtx, bundle, relativeBase, { config: normalizedConfig }, {
        mergeExistingAsset: true,
        mergeStrategy: jsonConfig?.mergeStrategy,
        defaults: jsonConfig?.defaults?.page,
        kind: 'page',
        extension: jsonExtension,
      })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`[Vue 编译] 编译 ${entryFilePath} 失败：${message}`)
    }
  }
}
