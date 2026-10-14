import type { VueBundleCompileOptionsState, VueBundleState } from './shared'
import { removeExtensionDeep } from '@weapp-core/shared'
import logger from '../../../../logger'
import { getPathExistsTtlMs } from '../../../../utils/cachePolicy'
import { withRealpathScope } from '../../../../utils/realpathScope'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { pathExists as pathExistsCached } from '../../../utils/cache'
import { collectFallbackPageEntryIds } from '../fallbackEntries'
import { emitBundlePageLayoutsIfNeeded } from './layoutAssets'
import { emitFallbackPageBundleAssets, handleFallbackPageLayouts, loadFallbackPageEntryCompilation, resolveFallbackPageEmitState, resolveVueBundleAssetContext } from './shared'

function collectPendingFallbackEntries(
  entryIds: Iterable<string>,
  emittedEntryIds: Set<string> | undefined,
  configService: NonNullable<VueBundleState['ctx']['configService']>,
) {
  if (!emittedEntryIds) {
    return entryIds
  }
  // 一次同步遍历建立本轮输出身份；不逐页重扫发布集合，也不跨 await 保留真实路径缓存。
  return withRealpathScope(() => {
    const outputs = new Set<string>()
    for (const emittedEntryId of emittedEntryIds) {
      const normalizedEmitted = normalizeFsResolvedId(emittedEntryId)
      if (normalizedEmitted) {
        outputs.add(removeExtensionDeep(configService.relativeOutputPath(normalizedEmitted)))
      }
    }
    return Array.from(entryIds).filter(entryId =>
      outputs.has(removeExtensionDeep(configService.relativeOutputPath(entryId))))
  })
}

export async function emitResolvedFallbackPageEntryAssets(options: {
  bundle: Record<string, any>
  pluginCtx: any
  ctx: VueBundleState['ctx']
  entryFilePath: string
  relativeBase: string
  configService: NonNullable<VueBundleState['ctx']['configService']>
  compileOptionsState: VueBundleCompileOptionsState
  outputExtensions: NonNullable<NonNullable<VueBundleState['ctx']['configService']>['outputExtensions']>
  templateExtension: string
  styleExtension: string
  jsonExtension: string
  scriptModuleExtension?: string
  platformAssetOptions: {
    platform: string
    templateExtension: string
    scriptModuleExtension?: string
    dependencies?: Record<string, string>
    alipayNpmMode?: string
  }
  appShell?: VueBundleState['appShell']
}) {
  const { source, result } = await loadFallbackPageEntryCompilation({
    entryFilePath: options.entryFilePath,
    ctx: options.ctx,
    pluginCtx: options.pluginCtx,
    configService: options.configService,
    compileOptionsState: options.compileOptionsState,
    appShell: options.appShell,
  })

  await handleFallbackPageLayouts({
    source,
    entryFilePath: options.entryFilePath,
    configService: options.configService,
    emitLayouts: async (layouts) => {
      await emitBundlePageLayoutsIfNeeded({
        layouts,
        pluginCtx: options.pluginCtx,
        bundle: options.bundle,
        ctx: options.ctx,
        configService: options.configService,
        compileOptionsState: options.compileOptionsState,
        outputExtensions: options.outputExtensions,
      })
    },
  })

  await emitFallbackPageBundleAssets({
    bundle: options.bundle,
    pluginCtx: options.pluginCtx,
    ctx: options.ctx,
    filename: options.entryFilePath,
    relativeBase: options.relativeBase,
    result,
    configService: options.configService,
    templateExtension: options.templateExtension,
    styleExtension: options.styleExtension,
    jsonExtension: options.jsonExtension,
    scriptModuleExtension: options.scriptModuleExtension,
    outputExtensions: options.outputExtensions,
    platformAssetOptions: options.platformAssetOptions,
  })
}

export async function emitFallbackPageAssets(
  bundle: Record<string, any>,
  state: VueBundleState,
  options?: {
    emittedEntryIds?: Set<string>
  },
) {
  const { ctx, pluginCtx, compilationCache, reExportResolutionCache, classStyleRuntimeWarned, compileOptionsCache, componentMetaCache } = state
  const { configService, scanService } = ctx
  if (!configService || !scanService) {
    return
  }

  const compileOptionsState = {
    reExportResolutionCache,
    classStyleRuntimeWarned,
    compileOptionsCache,
    componentMetaCache,
    emitResolvedComponentEntries: false,
  }
  const {
    outputExtensions,
    templateExtension,
    styleExtension,
    jsonExtension,
    scriptModuleExtension,
    platformAssetOptions,
  } = resolveVueBundleAssetContext(configService)

  const collectedEntries = await collectFallbackPageEntryIds(configService, scanService)
  for (const entryId of collectPendingFallbackEntries(collectedEntries, options?.emittedEntryIds, configService)) {
    const emitState = await resolveFallbackPageEmitState({
      entryId,
      configService,
      compilationCache,
      pathExists: async (candidate) => {
        return await pathExistsCached(candidate, { ttlMs: getPathExistsTtlMs(configService) })
          ? candidate
          : undefined
      },
    })
    if (!emitState) {
      continue
    }
    const { relativeBase, entryFilePath } = emitState

    try {
      await emitResolvedFallbackPageEntryAssets({
        bundle,
        pluginCtx,
        entryFilePath,
        ctx,
        relativeBase,
        configService,
        compileOptionsState,
        templateExtension,
        styleExtension,
        jsonExtension,
        scriptModuleExtension,
        outputExtensions,
        platformAssetOptions,
        appShell: state.appShell,
      })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`[Vue 编译] 编译 ${entryFilePath} 失败：${message}`)
    }
  }
}
