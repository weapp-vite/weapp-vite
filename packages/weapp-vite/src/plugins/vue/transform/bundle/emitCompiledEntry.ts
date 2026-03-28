import type { CompilationCacheEntry, VueBundleState } from './shared'
import {
  emitBundlePageLayoutsIfNeeded,
  emitScriptlessComponentJsFallbackIfMissing,
} from './layoutAssets'
import { addBundleWatchFile, emitCompiledEntryBundleAssets, handleCompiledEntryPageLayouts, resolveCompiledEntryEmitState, resolveVueBundleAssetContext } from './shared'

export async function emitResolvedCompiledVueEntryAssets(options: {
  bundle: Record<string, any>
  state: VueBundleState
  filename: string
  cached: CompilationCacheEntry
  result: CompilationCacheEntry['result']
  relativeBase: string
  compileOptionsState: { reExportResolutionCache: Map<string, Map<string, string | undefined>>, classStyleRuntimeWarned: { value: boolean } }
  outputExtensions: NonNullable<NonNullable<VueBundleState['ctx']['configService']>['outputExtensions']>
  templateExtension: string
  jsonExtension: string
  scriptExtension: string
  scriptModuleExtension?: string
  platformAssetOptions: {
    platform: string
    templateExtension: string
    scriptModuleExtension?: string
    dependencies?: Record<string, string>
    alipayNpmMode?: string
  }
}) {
  const { bundle, state, filename, cached, result, relativeBase, compileOptionsState } = options
  const { ctx, pluginCtx } = state
  const { configService } = ctx
  if (!configService) {
    return
  }

  if (cached.isPage && cached.source) {
    await handleCompiledEntryPageLayouts({
      source: cached.source,
      filename,
      result,
      configService,
      emitLayouts: async (layouts) => {
        await emitBundlePageLayoutsIfNeeded({
          layouts,
          pluginCtx,
          bundle,
          ctx,
          configService,
          compileOptionsState,
          outputExtensions: options.outputExtensions,
        })
      },
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
    templateExtension: options.templateExtension,
    jsonExtension: options.jsonExtension,
    scriptModuleExtension: options.scriptModuleExtension,
    outputExtensions: options.outputExtensions,
    platformAssetOptions: options.platformAssetOptions,
  })

  if (shouldEmitComponentJson && !result.script?.trim()) {
    emitScriptlessComponentJsFallbackIfMissing({
      pluginCtx,
      bundle,
      relativeBase,
      scriptExtension: options.scriptExtension,
    })
  }
}

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

  const emitState = await resolveCompiledEntryEmitState({
    filename,
    cached,
    ctx,
    pluginCtx,
    configService,
    compileOptionsState,
  })
  if (!emitState) {
    return
  }
  await emitResolvedCompiledVueEntryAssets({
    bundle,
    state,
    filename,
    cached,
    result: emitState.result,
    relativeBase: emitState.relativeBase,
    compileOptionsState,
    outputExtensions,
    templateExtension,
    jsonExtension,
    scriptExtension,
    scriptModuleExtension,
    platformAssetOptions,
  })
}
