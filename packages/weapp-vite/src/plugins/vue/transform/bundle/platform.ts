import type { CompilerContext } from '../../../../context'
import type { OutputExtensions } from '../../../../platforms/types'
import {
  shouldEmitGenericPlaceholderAsset,
  shouldNormalizeVueTemplateForPlatform,
} from '../../../../platform'
import { ALIPAY_GENERIC_COMPONENT_PLACEHOLDER, resolveJson } from '../../../../utils'
import { resolveScriptModuleTagByPlatform } from '../../../../utils/wxmlScriptModule'
import { scanWxml } from '../../../../wxml'
import { handleWxml } from '../../../../wxml/handle'
import { ensureScriptlessComponentAsset } from '../../../utils/scriptlessComponent'
import { emitSfcJsonAsset, emitSfcTemplateIfMissing } from '../emitAssets'
import { resolveVueTransformJsonPlatformOptions } from '../platform'

const LEADING_DOT_SLASH_RE = /^\.\//

export interface VueBundlePlatformOptions {
  normalizeUsingComponents: boolean
  normalizeTemplate: boolean
  emitGenericPlaceholder: boolean
  scriptModuleTag?: string
}

export interface VueBundlePlatformAssetOptions {
  platform: string
  templateExtension: string
  scriptModuleExtension?: string
  dependencies?: Record<string, string>
  alipayNpmMode?: string
}

export function resolveVueBundlePlatformOptions(options: {
  platform: string
  scriptModuleExtension?: string
}) {
  const jsonOptions = resolveVueTransformJsonPlatformOptions({
    platform: options.platform as any,
  })

  return {
    normalizeUsingComponents: jsonOptions.normalizeUsingComponents,
    normalizeTemplate: shouldNormalizeVueTemplateForPlatform(options.platform as any),
    emitGenericPlaceholder: shouldEmitGenericPlaceholderAsset(options.platform as any),
    scriptModuleTag: resolveScriptModuleTagByPlatform(options.platform as any, options.scriptModuleExtension),
  } satisfies VueBundlePlatformOptions
}

export function resolveVueBundlePlatformAssetOptions(options: {
  configService: Pick<CompilerContext['configService'], 'platform' | 'weappViteConfig' | 'packageJson'> | undefined
  templateExtension: string
  scriptModuleExtension?: string
}) {
  return {
    platform: options.configService?.platform ?? 'weapp',
    templateExtension: options.templateExtension,
    scriptModuleExtension: options.scriptModuleExtension,
    dependencies: options.configService?.packageJson?.dependencies,
    alipayNpmMode: options.configService?.weappViteConfig?.npm?.alipayNpmMode,
  } satisfies VueBundlePlatformAssetOptions
}

export function normalizeVueConfigForPlatform(
  config: string | undefined,
  options: {
    platform: string
    dependencies?: Record<string, string>
    alipayNpmMode?: string
  },
) {
  const jsonPlatformOptions = resolveVueTransformJsonPlatformOptions({
    platform: options.platform as any,
    packageJson: {
      dependencies: options.dependencies,
    } as any,
    weappViteConfig: {
      npm: {
        alipayNpmMode: options.alipayNpmMode,
      },
    } as any,
  })

  if (!config || !jsonPlatformOptions.normalizeUsingComponents) {
    return config
  }

  try {
    const parsed = JSON.parse(config)
    return resolveJson(
      {
        json: parsed,
      },
      undefined,
      options.platform as any,
      {
        dependencies: jsonPlatformOptions.dependencies,
        alipayNpmMode: jsonPlatformOptions.alipayNpmMode,
      },
    ) ?? config
  }
  catch {
    return config
  }
}

export function normalizeVueTemplateForPlatform(
  template: string,
  options: {
    platform: string
    templateExtension: string
    scriptModuleExtension?: string
  },
) {
  const platformOptions = resolveVueBundlePlatformOptions({
    platform: options.platform,
    scriptModuleExtension: options.scriptModuleExtension,
  })

  if (!platformOptions.normalizeTemplate) {
    return template
  }

  try {
    const token = scanWxml(template, {
      platform: options.platform as any,
    })
    return handleWxml(token, {
      templateExtension: options.templateExtension,
      scriptModuleExtension: options.scriptModuleExtension,
      scriptModuleTag: platformOptions.scriptModuleTag,
    }).code
  }
  catch {
    return template
  }
}

export function trackPlatformTemplateAnalysis(
  ctx: CompilerContext,
  filename: string,
  template: string,
) {
  if (!ctx.wxmlService) {
    return
  }

  try {
    const token = ctx.wxmlService.analyze(template)
    ctx.wxmlService.tokenMap.set(filename, token)
    ctx.wxmlService.setWxmlComponentsMap(filename, token.components)
  }
  catch {
    // 忽略模板扫描异常，保持模板发射流程可继续
  }
}

export function emitPlatformTemplateAsset(
  bundle: Record<string, any>,
  options: {
    ctx: CompilerContext
    pluginCtx: any
    filename: string
    relativeBase: string
    template: string
    platform: string
    templateExtension: string
    scriptModuleExtension?: string
  },
) {
  const normalizedTemplate = normalizeVueTemplateForPlatform(options.template, {
    platform: options.platform,
    templateExtension: options.templateExtension,
    scriptModuleExtension: options.scriptModuleExtension,
  })

  trackPlatformTemplateAnalysis(options.ctx, options.filename, normalizedTemplate)

  emitSfcTemplateIfMissing(options.pluginCtx, bundle, options.relativeBase, normalizedTemplate, options.templateExtension)
  return normalizedTemplate
}

export function resolveAlipayGenericPlaceholderBase(relativeBase: string) {
  const dirIndex = relativeBase.lastIndexOf('/')
  const dir = dirIndex >= 0 ? relativeBase.slice(0, dirIndex) : ''
  const placeholderName = ALIPAY_GENERIC_COMPONENT_PLACEHOLDER.replace(LEADING_DOT_SLASH_RE, '')
  return dir ? `${dir}/${placeholderName}` : placeholderName
}

export function emitAlipayGenericPlaceholderAssetsByBase(
  ctx: { emitFile: (asset: { type: 'asset', fileName: string, source: string }) => void },
  bundle: Record<string, any>,
  placeholderBase: string,
  outputExtensions: OutputExtensions | undefined,
) {
  const templateExtension = outputExtensions?.wxml ?? 'wxml'
  const jsonExtension = outputExtensions?.json ?? 'json'
  const scriptExtension = outputExtensions?.js ?? 'js'

  emitSfcTemplateIfMissing(ctx, bundle, placeholderBase, '<view />', templateExtension)
  emitSfcJsonAsset(ctx, bundle, placeholderBase, { config: JSON.stringify({ component: true }) }, {
    extension: jsonExtension,
    kind: 'component',
  })

  ensureScriptlessComponentAsset(ctx, bundle, placeholderBase, scriptExtension)
}

export function shouldEmitAlipayGenericPlaceholder(configSource: string | undefined) {
  if (!configSource) {
    return false
  }

  let config: Record<string, any>
  try {
    const parsed = JSON.parse(configSource)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return false
    }
    config = parsed
  }
  catch {
    return false
  }

  const componentGenerics = config.componentGenerics
  if (!componentGenerics || typeof componentGenerics !== 'object' || Array.isArray(componentGenerics)) {
    return false
  }

  return Object.values(componentGenerics).some((value) => {
    if (value === true) {
      return true
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false
    }
    return (value as Record<string, any>).default === ALIPAY_GENERIC_COMPONENT_PLACEHOLDER
  })
}

export function resolveGenericPlaceholderBaseForPlatform(
  relativeBase: string,
  configSource: string | undefined,
  platform: string,
) {
  if (!resolveVueBundlePlatformOptions({ platform }).emitGenericPlaceholder || !configSource) {
    return undefined
  }

  if (!shouldEmitAlipayGenericPlaceholder(configSource)) {
    return undefined
  }

  return resolveAlipayGenericPlaceholderBase(relativeBase)
}

export function emitAlipayGenericPlaceholderAssets(
  ctx: { emitFile: (asset: { type: 'asset', fileName: string, source: string }) => void },
  bundle: Record<string, any>,
  relativeBase: string,
  configSource: string | undefined,
  outputExtensions: OutputExtensions | undefined,
  platform: string,
) {
  const placeholderBase = resolveGenericPlaceholderBaseForPlatform(relativeBase, configSource, platform)
  if (!placeholderBase) {
    return
  }

  emitAlipayGenericPlaceholderAssetsByBase(
    ctx,
    bundle,
    placeholderBase,
    outputExtensions,
  )
}

export function prepareNormalizedVueConfigForPlatform(options: {
  config: string | undefined
  platform: string
  dependencies?: Record<string, string>
  alipayNpmMode?: string
}) {
  return normalizeVueConfigForPlatform(options.config, {
    platform: options.platform,
    dependencies: options.dependencies,
    alipayNpmMode: options.alipayNpmMode,
  })
}

export function emitPlatformConfigSideEffects(
  bundle: Record<string, any>,
  options: {
    pluginCtx: any
    relativeBase: string
    config: string | undefined
    outputExtensions: OutputExtensions | undefined
    platform: string
  },
) {
  emitAlipayGenericPlaceholderAssets(
    options.pluginCtx,
    bundle,
    options.relativeBase,
    options.config,
    options.outputExtensions,
    options.platform,
  )
}

export function preparePlatformConfigAsset(
  bundle: Record<string, any>,
  options: {
    pluginCtx: any
    relativeBase: string
    config: string | undefined
    outputExtensions: OutputExtensions | undefined
    platform: string
    dependencies?: Record<string, string>
    alipayNpmMode?: string
  },
) {
  const normalizedConfig = prepareNormalizedVueConfigForPlatform({
    config: options.config,
    platform: options.platform,
    dependencies: options.dependencies,
    alipayNpmMode: options.alipayNpmMode,
  })
  emitPlatformConfigSideEffects(bundle, {
    pluginCtx: options.pluginCtx,
    relativeBase: options.relativeBase,
    config: normalizedConfig,
    outputExtensions: options.outputExtensions,
    platform: options.platform,
  })
  return normalizedConfig
}
