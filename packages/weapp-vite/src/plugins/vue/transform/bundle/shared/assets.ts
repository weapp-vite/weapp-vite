import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../../context'
import type { JsonMergeStrategy } from '../../../../../types'
import type { ClassStyleWxsAsset } from './types'
import { getClassStyleWxsSource } from 'wevu/compiler'
import { resolveClassStyleWxsLocationForBase } from '../../classStyle'
import { emitClassStyleWxsAssetIfMissing, emitSfcJsonAsset, emitSfcStyleIfMissing } from '../../emitAssets'
import { emitScopedSlotAssets } from '../../scopedSlot'
import { resolveBundleOutputExtensions } from '../outputExtensions'
import { emitPlatformTemplateAsset, preparePlatformConfigAsset, resolveVueBundlePlatformAssetOptions } from '../platform'

const APP_VUE_LIKE_FILE_RE = /[\\/]app\.(?:vue|jsx|tsx)$/

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
