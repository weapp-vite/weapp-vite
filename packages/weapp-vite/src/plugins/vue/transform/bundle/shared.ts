import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../context'
import type { JsonMergeStrategy } from '../../../../types'
import { compileJsxFile, compileVueFile, getClassStyleWxsSource } from 'wevu/compiler'
import { addResolvedPageLayoutWatchFiles } from '../../../utils/pageLayout'
import { resolveClassStyleWxsLocationForBase } from '../classStyle'
import { createCompileVueFileOptions } from '../compileOptions'
import { emitClassStyleWxsAssetIfMissing, emitSfcJsonAsset } from '../emitAssets'
import { applyPageLayoutPlan, resolvePageLayoutPlan } from '../pageLayout'
import { emitScopedSlotAssets } from '../scopedSlot'
import { emitPlatformTemplateAsset, preparePlatformConfigAsset } from './platform'

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
