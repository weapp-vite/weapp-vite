import type { VueBundleState } from './shared'
// eslint-disable-next-line e18e/ban-dependencies -- 当前 bundle 阶段仍统一复用 fs-extra 读取源码
import fs from 'fs-extra'
import logger from '../../../../logger'
import { getPathExistsTtlMs } from '../../../../utils/cachePolicy'
import { normalizeWatchPath } from '../../../../utils/path'
import { pathExists as pathExistsCached } from '../../../utils/cache'
import { collectFallbackPageEntryIds } from '../fallbackEntries'
import { injectWevuPageFeaturesInJsWithViteResolver } from '../injectPageFeatures'
import { collectSetDataPickKeysFromTemplate, injectSetDataPickInJs, isAutoSetDataPickEnabled } from '../injectSetDataPick'
import { resolvePageLayoutPlan } from '../pageLayout'
import { findFirstResolvedVueLikeEntry } from '../shared'
import { emitNativeLayoutAssetsIfNeeded, emitResolvedBundleLayouts, emitVueLayoutScriptFallbackIfNeeded } from './layoutAssets'
import { resolveBundleOutputExtensions } from './outputExtensions'
import { resolveVueBundlePlatformAssetOptions } from './platform'
import { compileVueLikeFile, emitSharedFallbackPageAssets, emitSharedVueEntryAssets } from './shared'

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
  const platformAssetOptions = resolveVueBundlePlatformAssetOptions({
    configService,
    templateExtension,
    scriptModuleExtension,
  })

  const collectedEntries = await collectFallbackPageEntryIds(configService, scanService)
  for (const entryId of collectedEntries) {
    const relativeBase = configService.relativeOutputPath(entryId)
    if (!relativeBase) {
      continue
    }
    const entryFilePath = await findFirstResolvedVueLikeEntry(entryId, {
      resolve: async (candidate) => {
        if (compilationCache.has(candidate)) {
          return null
        }
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

      const jsonConfig = configService.weappViteConfig?.json
      emitSharedVueEntryAssets({
        bundle,
        pluginCtx,
        ctx,
        filename: entryFilePath,
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

      emitSharedFallbackPageAssets({
        bundle,
        pluginCtx,
        relativeBase,
        result,
        outputExtensions,
        platformAssetOptions,
        styleExtension,
        jsonExtension,
        jsonDefaults: jsonConfig?.defaults?.page,
        jsonMergeStrategy: jsonConfig?.mergeStrategy,
      })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`[Vue 编译] 编译 ${entryFilePath} 失败：${message}`)
    }
  }
}
