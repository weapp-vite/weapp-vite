import type { CompilationCacheEntry, VueBundleCompileOptionsState, VueBundleState } from './shared'
import { WEAPP_VITE_RUNTIME_VIRTUAL_IDS } from '@weapp-core/constants'
import { parseJsLike, traverse } from '../../../../utils/babel'
import { rewriteWevuInternalRuntimeImportCode } from '../../../core/helpers'
import { applyAppShell, hasAppShellTemplate, isAppVueFile, resolveAppShellRelativeBase } from '../appShell'
import { emitSfcScriptAssetReplacingBundleEntry } from '../emitAssets'
import { assertTemplateHasDefaultSlot, isLayoutFile } from '../pageLayout'
import {
  emitAppShellAssetsIfNeeded,
  emitBundlePageLayoutsIfNeeded,
  emitScriptlessComponentJsFallbackIfMissing,
} from './layoutAssets'
import { emitCompiledEntryBundleAssets, handleCompiledEntryPageLayouts, resolveCompiledEntryEmitState, resolveVueBundleAssetContext } from './shared'

function shouldReplaceAppScriptBundleEntry(options: {
  filename: string
  isDev: boolean
  hasDevHmrEvent: boolean
}) {
  if (!isAppVueFile(options.filename) || !options.isDev || !options.hasDevHmrEvent) {
    return false
  }
  return true
}

function hasUnresolvedModuleImportDeclaration(script: string | undefined) {
  if (!script?.includes('import')) {
    return false
  }

  try {
    let hasUnresolvedImport = false
    const ast = parseJsLike(script)
    traverse(ast, {
      ImportDeclaration(path) {
        const source = path.node.source.value
        if (
          typeof source === 'string'
          && !(
            source === 'wevu'
            || source === 'wevu/router'
            || source === 'wevu/store'
            || source === 'wevu/api'
            || source === 'wevu/fetch'
            || source === 'wevu/web-apis'
            || source === 'wevu/internal-runtime'
            || source === 'wevu/internal-reactivity'
            || source === 'wevu/internal-template'
            || Object.values(WEAPP_VITE_RUNTIME_VIRTUAL_IDS).includes(source as any)
          )
        ) {
          hasUnresolvedImport = true
          path.stop()
        }
      },
    })
    return hasUnresolvedImport
  }
  catch {
    return true
  }
}

function retainReplacedDevHmrScriptChunk(state: VueBundleState, fileName: string) {
  const hmrState = state.ctx.runtimeState?.build?.hmr
  if (!state.ctx.configService?.isDev || hmrState?.profile?.event === undefined) {
    return
  }

  hmrState.lastEmittedChunkFileNames ??= new Set<string>()
  hmrState.lastEmittedChunkFileNames.add(fileName)
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
    hasDevHmrEvent: hmrState?.profile?.event !== undefined,
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
    const scriptFileName = `${relativeBase}.${options.scriptExtension}`
    const script = rewriteWevuInternalRuntimeImportCode(
      scriptFileName,
      result.script,
      {
        runtimeFileName: ctx.runtimeState?.build?.output?.wevuInternalRuntimeFileName,
        runtimeFileNames: ctx.runtimeState?.build?.output?.wevuInternalRuntimeFileNames,
      },
    )
    if (hasUnresolvedModuleImportDeclaration(script)) {
      return
    }
    emitSfcScriptAssetReplacingBundleEntry(
      pluginCtx,
      bundle,
      relativeBase,
      script,
      options.scriptExtension,
    )
    retainReplacedDevHmrScriptChunk(state, scriptFileName)
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
  const { ctx, pluginCtx, reExportResolutionCache, classStyleRuntimeWarned, compileOptionsCache, componentMetaCache } = state
  const { configService } = ctx
  if (!configService) {
    return
  }

  const compileOptionsState = { reExportResolutionCache, classStyleRuntimeWarned, compileOptionsCache, componentMetaCache }
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
