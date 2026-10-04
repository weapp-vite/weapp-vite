import type { CompilationCacheEntry, VueBundleCompileOptionsState, VueBundleState } from './shared'
import { hasAppShellTemplate, isAppVueFile, resolveAppShellRelativeBase } from '../appShell'
import { assertTemplateHasDefaultSlot, isLayoutFile } from '../pageLayout'
import {
  emitAppShellAssetsIfNeeded,
  emitBundlePageLayoutsIfNeeded,
  emitScriptlessComponentJsFallbackIfMissing,
} from './layoutAssets'
import { emitCompiledEntryBundleAssets, handleCompiledEntryPageLayouts, resolveCompiledEntryEmitState, resolveVueBundleAssetContext } from './shared'

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

  // 可执行入口由 bundler 的 load/transform 生成；资产阶段不能用 compiler 原始脚本覆盖入口。
  // App 源码与路由变化沿入口失效链重建，模板、样式、JSON 继续由本阶段发布。
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
  const { ctx, pluginCtx, reExportResolutionCache, classStyleRuntimeWarned, compileOptionsCache, componentMetaCache } = state
  const { configService } = ctx
  if (!configService) {
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
    appShell: state.appShell,
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
