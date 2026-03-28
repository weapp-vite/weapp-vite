import type { VueBundleState } from './shared'
import logger from '../../../../logger'
import { getPathExistsTtlMs } from '../../../../utils/cachePolicy'
import { pathExists as pathExistsCached } from '../../../utils/cache'
import { collectFallbackPageEntryIds } from '../fallbackEntries'
import { emitBundlePageLayoutsIfNeeded } from './layoutAssets'
import { addBundleWatchFile, emitFallbackPageBundleAssets, handleFallbackPageLayouts, loadFallbackPageEntryCompilation, resolveFallbackPageEmitState, resolveVueBundleAssetContext } from './shared'

export async function emitResolvedFallbackPageEntryAssets(options: {
  bundle: Record<string, any>
  pluginCtx: any
  ctx: VueBundleState['ctx']
  entryFilePath: string
  relativeBase: string
  configService: NonNullable<VueBundleState['ctx']['configService']>
  compileOptionsState: { reExportResolutionCache: Map<string, Map<string, string | undefined>>, classStyleRuntimeWarned: { value: boolean } }
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
}) {
  const { source, result } = await loadFallbackPageEntryCompilation({
    entryFilePath: options.entryFilePath,
    ctx: options.ctx,
    pluginCtx: options.pluginCtx,
    configService: options.configService,
    compileOptionsState: options.compileOptionsState,
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

  emitFallbackPageBundleAssets({
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

    addBundleWatchFile(pluginCtx, entryFilePath)

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
      })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`[Vue 编译] 编译 ${entryFilePath} 失败：${message}`)
    }
  }
}
