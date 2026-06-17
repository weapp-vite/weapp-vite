import type { CompilationCacheEntry, VueBundleCompileOptionsState, VueBundleState } from './shared'
import { applyAppShell, hasAppShellTemplate, isAppVueFile, resolveAppShellRelativeBase } from '../appShell'
import { emitSfcScriptAssetReplacingBundleEntry } from '../emitAssets'
import { assertTemplateHasDefaultSlot, isLayoutFile } from '../pageLayout'
import {
  emitAppShellAssetsIfNeeded,
  emitBundlePageLayoutsIfNeeded,
  emitScriptlessComponentJsFallbackIfMissing,
} from './layoutAssets'
import { addBundleWatchFile, emitCompiledEntryBundleAssets, handleCompiledEntryPageLayouts, resolveCompiledEntryEmitState, resolveVueBundleAssetContext } from './shared'

function shouldReplaceAppScriptBundleEntry(options: {
  filename: string
  isDev: boolean
  dirtyReasonSummary?: string[]
}) {
  if (!isAppVueFile(options.filename) || !options.isDev) {
    return false
  }
  return options.dirtyReasonSummary?.some(item =>
    item.startsWith('entry-auto-routes:')
    || item.startsWith('auto-routes-topology:')
    || item.startsWith('entry-direct:')
    || item.startsWith('entry-json-only:'),
  ) === true
}

export async function emitResolvedCompiledVueEntryAssets(options: {
  bundle: Record<string, any>
  state: VueBundleState
  filename: string
  cached: CompilationCacheEntry
  result: CompilationCacheEntry['result']
  relativeBase: string
  compileOptionsState: VueBundleCompileOptionsState
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
  const hmrState = ctx.runtimeState?.build?.hmr
  const shouldReplaceAppScript = shouldReplaceAppScriptBundleEntry({
    filename,
    isDev: configService.isDev,
    dirtyReasonSummary: hmrState?.profile?.dirtyReasonSummary,
  })

  if (isAppVueFile(filename) && hasAppShellTemplate(result)) {
    emitAppShellAssetsIfNeeded({
      bundle,
      pluginCtx,
      ctx,
      filename,
      relativeBase: resolveAppShellRelativeBase(configService),
      result,
      configService,
      templateExtension: options.templateExtension,
      jsonExtension: options.jsonExtension,
      scriptExtension: options.scriptExtension,
      scriptModuleExtension: options.scriptModuleExtension,
      outputExtensions: options.outputExtensions,
      platformAssetOptions: options.platformAssetOptions,
    })
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
    applyAppShell(result, filename, state.appShell)
  }

  if (isLayoutFile(filename, configService)) {
    assertTemplateHasDefaultSlot({
      filename,
      kind: 'page-layout',
      template: result.template,
    })
  }

  const { shouldEmitComponentJson } = await emitCompiledEntryBundleAssets({
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

  if (shouldReplaceAppScript && result.script?.trim()) {
    emitSfcScriptAssetReplacingBundleEntry(
      pluginCtx,
      bundle,
      relativeBase,
      result.script,
      options.scriptExtension,
    )
  }

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
  const { ctx, pluginCtx, reExportResolutionCache, classStyleRuntimeWarned, compileOptionsCache } = state
  const { configService } = ctx
  if (!configService) {
    return
  }

  addBundleWatchFile(pluginCtx, filename)

  const compileOptionsState = { reExportResolutionCache, classStyleRuntimeWarned, compileOptionsCache }
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
