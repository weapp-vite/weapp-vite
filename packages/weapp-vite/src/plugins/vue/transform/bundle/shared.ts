import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../context'
import type { JsonMergeStrategy } from '../../../../types'
// eslint-disable-next-line e18e/ban-dependencies -- 当前 bundle 阶段仍统一复用 fs-extra 读取源码
import fs from 'fs-extra'
import { compileJsxFile, compileVueFile, getClassStyleWxsSource } from 'wevu/compiler'
import { normalizeWatchPath } from '../../../../utils/path'
import { addResolvedPageLayoutWatchFiles } from '../../../utils/pageLayout'
import { resolveClassStyleWxsLocationForBase } from '../classStyle'
import { createCompileVueFileOptions } from '../compileOptions'
import { emitClassStyleWxsAssetIfMissing, emitSfcJsonAsset, emitSfcStyleIfMissing } from '../emitAssets'
import { injectWevuPageFeaturesInJsWithViteResolver } from '../injectPageFeatures'
import { collectSetDataPickKeysFromTemplate, injectSetDataPickInJs, isAutoSetDataPickEnabled } from '../injectSetDataPick'
import { applyPageLayoutPlan, resolvePageLayoutPlan } from '../pageLayout'
import { emitScopedSlotAssets } from '../scopedSlot'
import { findFirstResolvedVueLikeEntry } from '../shared'
import { resolveBundleOutputExtensions } from './outputExtensions'
import { emitPlatformTemplateAsset, preparePlatformConfigAsset, resolveVueBundlePlatformAssetOptions } from './platform'

const APP_VUE_LIKE_FILE_RE = /[\\/]app\.(?:vue|jsx|tsx)$/

export { registerVueTemplateToken } from '../shared'

export interface CompilationCacheEntry {
  result: VueTransformResult
  source?: string
  isPage: boolean
}

export interface VueBundleState {
  ctx: CompilerContext
  pluginCtx: any
  compilationCache: Map<string, CompilationCacheEntry>
  reExportResolutionCache: Map<string, Map<string, string | undefined>>
  classStyleRuntimeWarned: { value: boolean }
}

export interface ClassStyleWxsAsset {
  fileName: string
  source: string
}

export function resolveVueBundleAssetContext(
  configService: NonNullable<CompilerContext['configService']>,
) {
  const outputExtensions = configService.outputExtensions
  const bundleOutputExtensions = resolveBundleOutputExtensions(outputExtensions)

  return {
    outputExtensions,
    ...bundleOutputExtensions,
    platformAssetOptions: resolveVueBundlePlatformAssetOptions({
      configService,
      templateExtension: bundleOutputExtensions.templateExtension,
      scriptModuleExtension: bundleOutputExtensions.scriptModuleExtension,
    }),
  }
}

export function emitSharedVueEntryJsonAsset(options: {
  bundle: Record<string, any>
  pluginCtx: any
  relativeBase: string
  config: string | undefined
  outputExtensions: NonNullable<CompilerContext['configService']>['outputExtensions']
  platformAssetOptions: {
    platform: string
    templateExtension: string
    scriptModuleExtension?: string
    dependencies?: Record<string, string>
    alipayNpmMode?: string
  }
  jsonOptions: {
    defaultConfig?: Record<string, any>
    mergeExistingAsset?: boolean
    defaults?: Record<string, any>
    mergeStrategy?: JsonMergeStrategy
    kind: 'app' | 'page' | 'component'
    extension: string
  }
}) {
  const normalizedConfig = preparePlatformConfigAsset(options.bundle, {
    pluginCtx: options.pluginCtx,
    relativeBase: options.relativeBase,
    config: options.config,
    outputExtensions: options.outputExtensions,
    ...options.platformAssetOptions,
  })

  emitSfcJsonAsset(
    options.pluginCtx,
    options.bundle,
    options.relativeBase,
    { config: normalizedConfig },
    options.jsonOptions,
  )
}

export function emitSharedFallbackPageAssets(options: {
  bundle: Record<string, any>
  pluginCtx: any
  relativeBase: string
  result: Pick<VueTransformResult, 'style' | 'config'>
  outputExtensions: NonNullable<CompilerContext['configService']>['outputExtensions']
  platformAssetOptions: {
    platform: string
    templateExtension: string
    scriptModuleExtension?: string
    dependencies?: Record<string, string>
    alipayNpmMode?: string
  }
  styleExtension: string
  jsonExtension: string
  jsonDefaults?: Record<string, any>
  jsonMergeStrategy?: JsonMergeStrategy
}) {
  const {
    bundle,
    pluginCtx,
    relativeBase,
    result,
    outputExtensions,
    platformAssetOptions,
    styleExtension,
    jsonExtension,
    jsonDefaults,
    jsonMergeStrategy,
  } = options

  if (result.style) {
    emitSfcStyleIfMissing(pluginCtx, bundle, relativeBase, result.style, styleExtension)
  }

  emitSharedVueEntryJsonAsset({
    bundle,
    pluginCtx,
    relativeBase,
    config: result.config,
    outputExtensions,
    platformAssetOptions,
    jsonOptions: {
      mergeExistingAsset: true,
      mergeStrategy: jsonMergeStrategy,
      defaults: jsonDefaults,
      kind: 'page',
      extension: jsonExtension,
    },
  })
}

export function resolveClassStyleWxsAsset(
  ctx: CompilerContext,
  relativeBase: string,
  wxsExtension: string | undefined,
  configService: NonNullable<CompilerContext['configService']>,
  result: Pick<VueTransformResult, 'classStyleWxs' | 'scopedSlotComponents'>,
): ClassStyleWxsAsset | undefined {
  const needsClassStyleWxs = Boolean(result.classStyleWxs)
    || Boolean(result.scopedSlotComponents?.some(slot => slot.classStyleWxs))
  if (!needsClassStyleWxs || typeof wxsExtension !== 'string' || wxsExtension.length === 0) {
    return undefined
  }

  const classStyleWxsLocation = resolveClassStyleWxsLocationForBase(ctx, relativeBase, wxsExtension, configService)
  return {
    fileName: classStyleWxsLocation.fileName,
    source: getClassStyleWxsSource({ extension: wxsExtension }),
  }
}

export function emitSharedVueEntryAssets(options: {
  bundle: Record<string, any>
  pluginCtx: any
  ctx: CompilerContext
  filename: string
  relativeBase: string
  result: VueTransformResult
  configService: NonNullable<CompilerContext['configService']>
  templateExtension: string
  scriptModuleExtension?: string
  outputExtensions: NonNullable<CompilerContext['configService']>['outputExtensions']
  platformAssetOptions: {
    platform: string
    templateExtension: string
    scriptModuleExtension?: string
    dependencies?: Record<string, string>
    alipayNpmMode?: string
  }
  scopedSlotDefaults?: Record<string, any>
  scopedSlotMergeStrategy?: any
}) {
  const {
    bundle,
    pluginCtx,
    ctx,
    filename,
    relativeBase,
    result,
    configService,
    scriptModuleExtension,
    outputExtensions,
    platformAssetOptions,
    scopedSlotDefaults,
    scopedSlotMergeStrategy,
  } = options

  if (result.template) {
    emitPlatformTemplateAsset(bundle, {
      ctx,
      pluginCtx,
      filename,
      relativeBase,
      template: result.template,
      ...platformAssetOptions,
    })
  }

  const classStyleWxs = resolveClassStyleWxsAsset(
    ctx,
    relativeBase,
    scriptModuleExtension,
    configService,
    result,
  )

  if (result.classStyleWxs && classStyleWxs) {
    emitClassStyleWxsAssetIfMissing(
      pluginCtx,
      bundle,
      classStyleWxs.fileName,
      classStyleWxs.source,
    )
  }

  emitScopedSlotAssets(pluginCtx, bundle, relativeBase, result, ctx, classStyleWxs, outputExtensions, {
    defaults: scopedSlotDefaults,
    mergeStrategy: scopedSlotMergeStrategy,
  })

  return {
    classStyleWxs,
  }
}

export function emitBundleVueEntryAssets(options: {
  bundle: Record<string, any>
  pluginCtx: any
  ctx: CompilerContext
  filename: string
  relativeBase: string
  result: VueTransformResult
  configService: NonNullable<CompilerContext['configService']>
  templateExtension: string
  scriptModuleExtension?: string
  outputExtensions: NonNullable<CompilerContext['configService']>['outputExtensions']
  platformAssetOptions: {
    platform: string
    templateExtension: string
    scriptModuleExtension?: string
    dependencies?: Record<string, string>
    alipayNpmMode?: string
  }
}) {
  const jsonConfig = options.configService.weappViteConfig?.json

  emitSharedVueEntryAssets({
    ...options,
    scopedSlotDefaults: jsonConfig?.defaults?.component,
    scopedSlotMergeStrategy: jsonConfig?.mergeStrategy,
  })

  return {
    jsonConfig,
  }
}

export function addBundleWatchFile(pluginCtx: any, filePath: string) {
  if (typeof pluginCtx.addWatchFile !== 'function') {
    return
  }

  pluginCtx.addWatchFile(normalizeWatchPath(filePath))
}

export function emitFallbackPageBundleAssets(options: {
  bundle: Record<string, any>
  pluginCtx: any
  ctx: CompilerContext
  filename: string
  relativeBase: string
  result: Pick<VueTransformResult, 'template' | 'style' | 'config' | 'classStyleWxs' | 'scopedSlotComponents'>
  configService: NonNullable<CompilerContext['configService']>
  templateExtension: string
  styleExtension: string
  jsonExtension: string
  scriptModuleExtension?: string
  outputExtensions: NonNullable<CompilerContext['configService']>['outputExtensions']
  platformAssetOptions: {
    platform: string
    templateExtension: string
    scriptModuleExtension?: string
    dependencies?: Record<string, string>
    alipayNpmMode?: string
  }
}) {
  const { jsonConfig } = emitBundleVueEntryAssets({
    bundle: options.bundle,
    pluginCtx: options.pluginCtx,
    ctx: options.ctx,
    filename: options.filename,
    relativeBase: options.relativeBase,
    result: options.result as VueTransformResult,
    configService: options.configService,
    templateExtension: options.templateExtension,
    scriptModuleExtension: options.scriptModuleExtension,
    outputExtensions: options.outputExtensions,
    platformAssetOptions: options.platformAssetOptions,
  })

  emitSharedFallbackPageAssets({
    bundle: options.bundle,
    pluginCtx: options.pluginCtx,
    relativeBase: options.relativeBase,
    result: options.result,
    outputExtensions: options.outputExtensions,
    platformAssetOptions: options.platformAssetOptions,
    styleExtension: options.styleExtension,
    jsonExtension: options.jsonExtension,
    jsonDefaults: jsonConfig?.defaults?.page,
    jsonMergeStrategy: jsonConfig?.mergeStrategy,
  })
}

export function emitCompiledEntryBundleAssets(options: {
  bundle: Record<string, any>
  pluginCtx: any
  ctx: CompilerContext
  filename: string
  relativeBase: string
  result: VueTransformResult
  isPage: boolean
  configService: NonNullable<CompilerContext['configService']>
  templateExtension: string
  jsonExtension: string
  scriptModuleExtension?: string
  outputExtensions: NonNullable<CompilerContext['configService']>['outputExtensions']
  platformAssetOptions: {
    platform: string
    templateExtension: string
    scriptModuleExtension?: string
    dependencies?: Record<string, string>
    alipayNpmMode?: string
  }
}) {
  const isAppVue = APP_VUE_LIKE_FILE_RE.test(options.filename)
  const shouldEmitComponentJson = !isAppVue && !options.isPage
  const shouldMergeJsonAsset = isAppVue
  const jsonKind = isAppVue ? 'app' : options.isPage ? 'page' : 'component'

  const { jsonConfig } = emitBundleVueEntryAssets({
    bundle: options.bundle,
    pluginCtx: options.pluginCtx,
    ctx: options.ctx,
    filename: options.filename,
    relativeBase: options.relativeBase,
    result: options.result,
    configService: options.configService,
    templateExtension: options.templateExtension,
    scriptModuleExtension: options.scriptModuleExtension,
    outputExtensions: options.outputExtensions,
    platformAssetOptions: options.platformAssetOptions,
  })

  if (options.result.config || shouldEmitComponentJson) {
    emitSharedVueEntryJsonAsset({
      bundle: options.bundle,
      pluginCtx: options.pluginCtx,
      relativeBase: options.relativeBase,
      config: options.result.config,
      outputExtensions: options.outputExtensions,
      platformAssetOptions: options.platformAssetOptions,
      jsonOptions: {
        defaultConfig: shouldEmitComponentJson ? { component: true } : undefined,
        mergeExistingAsset: shouldMergeJsonAsset,
        mergeStrategy: jsonConfig?.mergeStrategy,
        defaults: jsonConfig?.defaults?.[jsonKind],
        kind: jsonKind,
        extension: options.jsonExtension,
      },
    })
  }

  return {
    isAppVue,
    shouldEmitComponentJson,
  }
}

export function getEntryBaseName(filename: string) {
  const extIndex = filename.lastIndexOf('.')
  if (extIndex < 0) {
    return filename
  }
  return filename.slice(0, extIndex)
}

export function isAppVueLikeFile(filename: string) {
  return APP_VUE_LIKE_FILE_RE.test(filename)
}

export async function compileVueLikeFile(options: {
  source: string
  filename: string
  ctx: CompilerContext
  pluginCtx: any
  isPage: boolean
  isApp: boolean
  configService: NonNullable<CompilerContext['configService']>
  compileOptionsState: { reExportResolutionCache: Map<string, Map<string, string | undefined>>, classStyleRuntimeWarned: { value: boolean } }
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

  const compileOptions = createCompileVueFileOptions(ctx, pluginCtx, filename, isPage, isApp, configService, compileOptionsState)
  if (filename.endsWith('.vue')) {
    const result = await compileVueFile(source, filename, compileOptions)
    if (isPage && result.template) {
      const resolvedLayoutPlan = await resolvePageLayoutPlan(source, filename, configService)
      if (resolvedLayoutPlan) {
        applyPageLayoutPlan(result, filename, resolvedLayoutPlan)
        await addResolvedPageLayoutWatchFiles(pluginCtx, resolvedLayoutPlan.layouts)
      }
    }
    return result
  }
  const result = await compileJsxFile(source, filename, compileOptions)
  if (isPage && result.template) {
    const resolvedLayoutPlan = await resolvePageLayoutPlan(source, filename, configService)
    if (resolvedLayoutPlan) {
      applyPageLayoutPlan(result, filename, resolvedLayoutPlan)
      await addResolvedPageLayoutWatchFiles(pluginCtx, resolvedLayoutPlan.layouts)
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
  const { result, filename, pluginCtx, configService, isPage, isApp } = options

  if (isPage && result.script) {
    const injected = await injectWevuPageFeaturesInJsWithViteResolver(pluginCtx, result.script, filename, {
      checkMtime: configService.isDev,
    })
    if (injected.transformed) {
      result.script = injected.code
    }
  }

  if (
    !isApp
    && result.script
    && result.template
    && isAutoSetDataPickEnabled(configService.weappViteConfig)
  ) {
    const keys = collectSetDataPickKeysFromTemplate(result.template)
    const injectedPick = injectSetDataPickInJs(result.script, keys)
    if (injectedPick.transformed) {
      result.script = injectedPick.code
    }
  }

  return result
}

export async function compileAndFinalizeVueLikeFile(options: {
  source: string
  filename: string
  ctx: CompilerContext
  pluginCtx: any
  isPage: boolean
  isApp: boolean
  configService: NonNullable<CompilerContext['configService']>
  compileOptionsState: { reExportResolutionCache: Map<string, Map<string, string | undefined>>, classStyleRuntimeWarned: { value: boolean } }
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
  compileOptionsState: { reExportResolutionCache: Map<string, Map<string, string | undefined>>, classStyleRuntimeWarned: { value: boolean } }
}) {
  const { filename, cached, ctx, pluginCtx, configService, compileOptionsState } = options
  if (!configService.isDev) {
    return cached.result
  }

  try {
    const source = await fs.readFile(filename, 'utf-8')
    if (source === cached.source) {
      return cached.result
    }

    const compiled = await compileAndFinalizeVueLikeFile({
      source,
      filename,
      ctx,
      pluginCtx,
      isPage: cached.isPage,
      isApp: isAppVueLikeFile(filename),
      configService,
      compileOptionsState,
    })

    cached.source = source
    cached.result = compiled
    return compiled
  }
  catch {
    return cached.result
  }
}

export async function resolveCompiledEntryEmitState(options: {
  filename: string
  cached: CompilationCacheEntry
  ctx: CompilerContext
  pluginCtx: any
  configService: NonNullable<CompilerContext['configService']>
  compileOptionsState: { reExportResolutionCache: Map<string, Map<string, string | undefined>>, classStyleRuntimeWarned: { value: boolean } }
}) {
  const result = await refreshCompiledVueEntryCacheInDev({
    filename: options.filename,
    cached: options.cached,
    ctx: options.ctx,
    pluginCtx: options.pluginCtx,
    configService: options.configService,
    compileOptionsState: options.compileOptionsState,
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

export async function resolveFallbackPageEntryFile(options: {
  entryId: string
  compilationCache: Map<string, CompilationCacheEntry>
  pathExists: (candidate: string) => Promise<string | undefined | null>
}) {
  return await findFirstResolvedVueLikeEntry(options.entryId, {
    resolve: async (candidate) => {
      if (options.compilationCache.has(candidate)) {
        return null
      }
      return await options.pathExists(candidate)
    },
  })
}

export async function resolveFallbackPageEmitState(options: {
  entryId: string
  configService: NonNullable<CompilerContext['configService']>
  compilationCache: Map<string, CompilationCacheEntry>
  pathExists: (candidate: string) => Promise<string | undefined | null>
}) {
  const relativeBase = options.configService.relativeOutputPath(options.entryId)
  if (!relativeBase) {
    return undefined
  }

  const entryFilePath = await resolveFallbackPageEntryFile({
    entryId: options.entryId,
    compilationCache: options.compilationCache,
    pathExists: options.pathExists,
  })
  if (!entryFilePath) {
    return undefined
  }

  return {
    relativeBase,
    entryFilePath,
  }
}

export async function loadFallbackPageEntryCompilation(options: {
  entryFilePath: string
  ctx: CompilerContext
  pluginCtx: any
  configService: NonNullable<CompilerContext['configService']>
  compileOptionsState: { reExportResolutionCache: Map<string, Map<string, string | undefined>>, classStyleRuntimeWarned: { value: boolean } }
}) {
  const source = await fs.readFile(options.entryFilePath, 'utf-8')
  const result = await compileAndFinalizeVueLikeFile({
    source,
    filename: options.entryFilePath,
    ctx: options.ctx,
    pluginCtx: options.pluginCtx,
    isPage: true,
    isApp: false,
    configService: options.configService,
    compileOptionsState: options.compileOptionsState,
  })

  return {
    source,
    result,
  }
}

export async function handleFallbackPageLayouts(options: {
  source: string
  entryFilePath: string
  configService: NonNullable<CompilerContext['configService']>
  emitLayouts: (layouts: Awaited<ReturnType<typeof resolvePageLayoutPlan>>['layouts'] | undefined) => Promise<void>
}) {
  const resolvedLayoutPlan = await resolvePageLayoutPlan(
    options.source,
    options.entryFilePath,
    options.configService,
  )
  await options.emitLayouts(resolvedLayoutPlan?.layouts)
}

export async function handleCompiledEntryPageLayouts(options: {
  source: string
  filename: string
  result: VueTransformResult
  configService: NonNullable<CompilerContext['configService']>
  emitLayouts: (layouts: Awaited<ReturnType<typeof resolvePageLayoutPlan>>['layouts'] | undefined) => Promise<void>
}) {
  const resolvedLayoutPlan = await resolvePageLayoutPlan(
    options.source,
    options.filename,
    options.configService,
  )

  if (resolvedLayoutPlan) {
    applyPageLayoutPlan(options.result, options.filename, resolvedLayoutPlan)
  }

  await options.emitLayouts(resolvedLayoutPlan?.layouts)
}
