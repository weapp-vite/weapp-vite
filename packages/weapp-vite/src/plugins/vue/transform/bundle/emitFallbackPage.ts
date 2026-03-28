import type { VueBundleState } from './shared'
// eslint-disable-next-line e18e/ban-dependencies -- 当前 bundle 阶段仍统一复用 fs-extra 读取源码
import fs from 'fs-extra'
import logger from '../../../../logger'
import { getPathExistsTtlMs } from '../../../../utils/cachePolicy'
import { normalizeWatchPath } from '../../../../utils/path'
import { pathExists as pathExistsCached } from '../../../utils/cache'
import { collectFallbackPageEntryIds } from '../fallbackEntries'
import { resolvePageLayoutPlan } from '../pageLayout'
import { findFirstResolvedVueLikeEntry } from '../shared'
import { emitBundlePageLayoutsIfNeeded } from './layoutAssets'
import { compileAndFinalizeVueLikeFile, emitSharedFallbackPageAssets, emitSharedVueEntryAssets, resolveVueBundleAssetContext } from './shared'

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
      const result = await compileAndFinalizeVueLikeFile({
        source,
        filename: entryFilePath,
        ctx,
        pluginCtx,
        isPage: true,
        isApp: false,
        configService,
        compileOptionsState,
      })

      const resolvedLayoutPlan = await resolvePageLayoutPlan(source, entryFilePath, configService)
      await emitBundlePageLayoutsIfNeeded({
        layouts: resolvedLayoutPlan?.layouts,
        pluginCtx,
        bundle,
        ctx,
        configService,
        compileOptionsState,
        outputExtensions,
      })

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
