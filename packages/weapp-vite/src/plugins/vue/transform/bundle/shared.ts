import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../context'
import type { JsonMergeStrategy } from '../../../../types'
// eslint-disable-next-line e18e/ban-dependencies -- 当前 bundle 阶段仍统一复用 fs-extra 读取源码
import fs from 'fs-extra'
import { compileJsxFile, compileVueFile, getClassStyleWxsSource } from 'wevu/compiler'
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
