import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../../context'
import type { ResolvedAppShell } from '../../appShell'
import type { CompilationCacheEntry, VueBundleCompileOptionsState } from './types'
import { compileJsxFile, compileVueFile, resolveVueSfcHmrSignatures, resolveVueSfcStyleIndependentSignature } from 'wevu/compiler'
import { resolveVueEntryTopologySignature } from '../../../../../runtime/buildPlugin/vueEntryTopology'
import { storeVueSfcHmrSignatures } from '../../../../../runtime/storeVueSfcHmrSignatures'
import { recordHmrProfileOperation } from '../../../../../utils/hmrProfile'
import { normalizeFsResolvedId } from '../../../../../utils/resolvedId'
import { UniAppCompatibilityTransformError } from '../../../../uniApp'
import { registerResolvedPageLayoutDependencies } from '../../../../utils/pageLayout'
import { readAndParseSfc } from '../../../../utils/vueSfc'
import { createCompilerAppShellSignature } from '../../appShell'
import { createCompileVueFileOptions, resolveSfcStylePreprocessOptions } from '../../compileOptions'
import { applyComponentResolutionDependencies, syncVueCompilationDependencies } from '../../componentResolutionDependencies'
import { injectWevuPageFeaturesInJsWithViteResolver } from '../../injectPageFeatures'
import { resolvePageLayoutPlan } from '../../pageLayout'
import { isVueStyleOnlyDirtyReasonSummary, resolveDirtyVueEntryId, resolveTransformAutoRoutesSource } from '../../plugin/shared'
import { readVueLikeCompilerInput } from '../../sourceInput'
import { refreshStyleOnlyVueTransformResult } from '../../styleOnly'
import { isWevuMinifyEnabled } from '../../wevuPreset'
import { getEntryBaseName, isAppVueLikeFile } from './layout'
import { setVueBundlePageLayoutPlan } from './types'

export async function compileVueLikeFile(options: {
  source: string
  rawSource?: string
  topologySource?: string
  filename: string
  ctx: CompilerContext
  pluginCtx: any
  isPage: boolean
  isApp: boolean
  configService: NonNullable<CompilerContext['configService']>
  compileOptionsState: VueBundleCompileOptionsState
  appShell?: ResolvedAppShell
}) {
  const {
    source,
    filename,
    ctx,
    pluginCtx,
    isPage,
    isApp,
    configService,
    compileOptionsState,
  } = options
  if (configService.isDev && filename.endsWith('.vue')) {
    // 自动路由内联属于生成步骤，拓扑基线始终使用条件编译后的源码。
    resolveVueEntryTopologySignature(configService, filename, options.topologySource ?? source)
  }

  const resolvedPageLayoutPlan = isPage
    ? await resolvePageLayoutPlan(source, filename, configService)
    : undefined
  if (resolvedPageLayoutPlan) {
    await registerResolvedPageLayoutDependencies(ctx, filename, resolvedPageLayoutPlan.layouts)
  }
  const compileOptions = createCompileVueFileOptions(
    ctx,
    pluginCtx,
    filename,
    isPage,
    isApp,
    configService,
    compileOptionsState,
    resolvedPageLayoutPlan,
    options.appShell,
  )
  const result = filename.endsWith('.vue')
    ? await compileVueFile(source, filename, compileOptions)
    : await compileJsxFile(source, filename, compileOptions)
  applyComponentResolutionDependencies(result, compileOptions, filename)
  syncVueCompilationDependencies({ ctx, pluginCtx, filename, result, configService })
  if (isPage) {
    setVueBundlePageLayoutPlan(result, resolvedPageLayoutPlan)
  }
  if (filename.endsWith('.vue')) {
    const hmr = ctx.runtimeState?.build?.hmr
    if (configService.isDev && hmr) {
      storeVueSfcHmrSignatures(
        hmr,
        normalizeFsResolvedId(filename),
        resolveVueSfcHmrSignatures(options.rawSource ?? source, filename),
      )
    }
  }
  return result
}

export async function finalizeCompiledVueLikeResult(options: {
  result: VueTransformResult
  filename: string
  pluginCtx: any
  configService: NonNullable<CompilerContext['configService']>
  isPage: boolean
  isApp: boolean
}) {
  const { result, filename, pluginCtx, configService, isPage } = options

  if (isPage && result.script) {
    const injected = await injectWevuPageFeaturesInJsWithViteResolver(pluginCtx, result.script, filename, {
      checkMtime: configService.isDev,
      minify: isWevuMinifyEnabled(configService.weappViteConfig, configService.isDev),
      sourceMap: false,
    })
    if (injected.transformed) {
      result.script = injected.code
    }
  }

  return result
}

export async function compileAndFinalizeVueLikeFile(options: {
  source: string
  rawSource?: string
  topologySource?: string
  filename: string
  ctx: CompilerContext
  pluginCtx: any
  isPage: boolean
  isApp: boolean
  configService: NonNullable<CompilerContext['configService']>
  compileOptionsState: VueBundleCompileOptionsState
  appShell?: ResolvedAppShell
}) {
  const result = await compileVueLikeFile(options)
  return await finalizeCompiledVueLikeResult({
    result,
    filename: options.filename,
    pluginCtx: options.pluginCtx,
    configService: options.configService,
    isPage: options.isPage,
    isApp: options.isApp,
  })
}

export async function refreshCompiledVueEntryCacheInDev(options: {
  filename: string
  cached: CompilationCacheEntry
  ctx: CompilerContext
  pluginCtx: any
  configService: NonNullable<CompilerContext['configService']>
  compileOptionsState: VueBundleCompileOptionsState
  appShell?: ResolvedAppShell
  validatedCompilations?: WeakSet<VueTransformResult>
}) {
  const { filename, cached, ctx, pluginCtx, configService, compileOptionsState } = options
  if (!configService.isDev) {
    return cached.result
  }

  const profile = ctx.runtimeState?.build?.hmr?.profile
  const isApp = isAppVueLikeFile(filename)
  const appShellSignature = createCompilerAppShellSignature(cached.isPage && !isApp ? options.appShell : undefined)
  const isAppShellUnchanged = (cached.appShellSignature ?? 'null') === appShellSignature
  const dirtyVueEntryIds = ctx.runtimeState?.build?.hmr?.dirtyVueEntryIds
  const dirtyEntryId = resolveDirtyVueEntryId(dirtyVueEntryIds, filename)
  // transform 已使用本代输入及依赖完成校验；不重复读取同一快照，也不复用上一代的校验标记。
  if (
    !isApp
    && cached.source !== undefined
    && !dirtyEntryId
    && (cached.refreshToken ?? 0) === 0
    && isAppShellUnchanged
    && options.validatedCompilations?.has(cached.result)
  ) {
    recordHmrProfileOperation(profile, 'vueBundleCacheHitCount')
    return cached.result
  }

  // 输入缺失或快照失效必须交给发布事务保留旧代，不能把读取失败解释成可复用编译结果。
  const { rawSource, source: preparedSource } = await readVueLikeCompilerInput(configService, filename)
  try {
    const transformed = isApp
      ? await resolveTransformAutoRoutesSource({
          source: preparedSource,
          autoRoutesService: ctx.autoRoutesService,
        })
      : {
          source: preparedSource,
          signature: undefined,
        }
    const source = transformed.source
    if (
      source === cached.source
      && transformed.signature === cached.autoRoutesSignature
      && isAppShellUnchanged
    ) {
      cached.refreshToken = 0
      if (dirtyEntryId) {
        dirtyVueEntryIds?.delete(dirtyEntryId)
      }
      recordHmrProfileOperation(profile, 'vueBundleCacheHitCount')
      return cached.result
    }
    const currentStyleIndependentSignature = (dirtyEntryId && filename.endsWith('.vue'))
      && isVueStyleOnlyDirtyReasonSummary(ctx.runtimeState?.build?.hmr?.profile?.dirtyReasonSummary)
      ? resolveVueSfcStyleIndependentSignature(source, filename)
      : undefined
    if (
      dirtyEntryId
      && filename.endsWith('.vue')
      && cached.styleIndependentSignature
      && currentStyleIndependentSignature
      && cached.styleIndependentSignature === currentStyleIndependentSignature
      && transformed.signature === cached.autoRoutesSignature
      && isAppShellUnchanged
      && cached.source !== source
    ) {
      const { descriptor } = await readAndParseSfc(filename, {
        source,
        checkMtime: configService.isDev,
      })
      if (!await refreshStyleOnlyVueTransformResult(
        cached.result,
        filename,
        descriptor.styles,
        descriptor.cssVars,
        resolveSfcStylePreprocessOptions(configService),
      )) {
        cached.styleIndependentSignature = undefined
      }
      else {
        cached.source = source
        cached.styleIndependentSignature = currentStyleIndependentSignature
        cached.refreshToken = 0
        storeVueSfcHmrSignatures(
          ctx.runtimeState.build.hmr,
          normalizeFsResolvedId(filename),
          resolveVueSfcHmrSignatures(rawSource, filename),
        )
        dirtyVueEntryIds?.delete(dirtyEntryId)
        recordHmrProfileOperation(profile, 'vueBundleStyleOnlyCount')
        return cached.result
      }
    }

    recordHmrProfileOperation(profile, 'vueBundleRecompileCount')
    const compiled = await compileAndFinalizeVueLikeFile({
      source,
      rawSource,
      topologySource: preparedSource,
      filename,
      ctx,
      pluginCtx,
      isPage: cached.isPage,
      isApp,
      configService,
      compileOptionsState,
      appShell: options.appShell,
    })

    const nextStyleIndependentSignature = filename.endsWith('.vue')
      ? (currentStyleIndependentSignature ?? resolveVueSfcStyleIndependentSignature(source, filename))
      : undefined

    cached.source = source
    cached.autoRoutesSignature = transformed.signature
    cached.appShellSignature = appShellSignature
    cached.styleIndependentSignature = nextStyleIndependentSignature
    cached.refreshToken = 0
    if (dirtyEntryId) {
      dirtyVueEntryIds?.delete(dirtyEntryId)
    }
    cached.result = compiled
    return compiled
  }
  catch (error) {
    if (error instanceof UniAppCompatibilityTransformError) {
      throw error
    }
    return cached.result
  }
}

export async function resolveCompiledEntryEmitState(options: {
  filename: string
  cached: CompilationCacheEntry
  ctx: CompilerContext
  pluginCtx: any
  configService: NonNullable<CompilerContext['configService']>
  compileOptionsState: VueBundleCompileOptionsState
  appShell?: ResolvedAppShell
  validatedCompilations?: WeakSet<VueTransformResult>
}) {
  const result = await refreshCompiledVueEntryCacheInDev({
    filename: options.filename,
    cached: options.cached,
    ctx: options.ctx,
    pluginCtx: options.pluginCtx,
    configService: options.configService,
    compileOptionsState: options.compileOptionsState,
    appShell: options.appShell,
    validatedCompilations: options.validatedCompilations,
  })

  const baseName = getEntryBaseName(options.filename)
  const relativeBase = options.configService.relativeOutputPath(baseName)
  if (!relativeBase) {
    return undefined
  }

  return {
    result,
    relativeBase,
  }
}

export async function loadFallbackPageEntryCompilation(options: {
  entryFilePath: string
  ctx: CompilerContext
  pluginCtx: any
  configService: NonNullable<CompilerContext['configService']>
  compileOptionsState: VueBundleCompileOptionsState
  appShell?: ResolvedAppShell
}) {
  const { rawSource, source } = await readVueLikeCompilerInput(options.configService, options.entryFilePath)
  const result = await compileAndFinalizeVueLikeFile({
    source,
    rawSource,
    filename: options.entryFilePath,
    ctx: options.ctx,
    pluginCtx: options.pluginCtx,
    isPage: true,
    isApp: false,
    configService: options.configService,
    compileOptionsState: options.compileOptionsState,
    appShell: options.appShell,
  })

  return {
    source,
    result,
  }
}
