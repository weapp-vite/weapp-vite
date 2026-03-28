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
import { emitScriptlessComponentAsset, SCRIPTLESS_COMPONENT_STUB } from '../../../utils/scriptlessComponent'
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

  if (options.ctx.wxmlService) {
    try {
      const token = options.ctx.wxmlService.analyze(normalizedTemplate)
      options.ctx.wxmlService.tokenMap.set(options.filename, token)
      options.ctx.wxmlService.setWxmlComponentsMap(options.filename, token.components)
    }
    catch {
      // 忽略模板扫描异常，保持模板发射流程可继续
    }
  }

  emitSfcTemplateIfMissing(options.pluginCtx, bundle, options.relativeBase, normalizedTemplate, options.templateExtension)
  return normalizedTemplate
}

export function emitAlipayGenericPlaceholderAssets(
  ctx: { emitFile: (asset: { type: 'asset', fileName: string, source: string }) => void },
  bundle: Record<string, any>,
  relativeBase: string,
  configSource: string | undefined,
  outputExtensions: OutputExtensions | undefined,
  platform: string,
) {
  if (!resolveVueBundlePlatformOptions({ platform }).emitGenericPlaceholder || !configSource) {
    return
  }

  let config: Record<string, any>
  try {
    const parsed = JSON.parse(configSource)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return
    }
    config = parsed
  }
  catch {
    return
  }

  const componentGenerics = config.componentGenerics
  if (!componentGenerics || typeof componentGenerics !== 'object' || Array.isArray(componentGenerics)) {
    return
  }

  const shouldEmit = Object.values(componentGenerics).some((value) => {
    if (value === true) {
      return true
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false
    }
    return (value as Record<string, any>).default === ALIPAY_GENERIC_COMPONENT_PLACEHOLDER
  })
  if (!shouldEmit) {
    return
  }

  const templateExtension = outputExtensions?.wxml ?? 'wxml'
  const jsonExtension = outputExtensions?.json ?? 'json'
  const scriptExtension = outputExtensions?.js ?? 'js'
  const dirIndex = relativeBase.lastIndexOf('/')
  const dir = dirIndex >= 0 ? relativeBase.slice(0, dirIndex) : ''
  const placeholderName = ALIPAY_GENERIC_COMPONENT_PLACEHOLDER.replace(LEADING_DOT_SLASH_RE, '')
  const placeholderBase = dir ? `${dir}/${placeholderName}` : placeholderName

  emitSfcTemplateIfMissing(ctx, bundle, placeholderBase, '<view />', templateExtension)
  emitSfcJsonAsset(ctx, bundle, placeholderBase, { config: JSON.stringify({ component: true }) }, {
    extension: jsonExtension,
    kind: 'component',
  })

  const scriptFileName = `${placeholderBase}.${scriptExtension}`
  const existing = bundle[scriptFileName]
  const scriptSource = SCRIPTLESS_COMPONENT_STUB
  if (existing && existing.type === 'asset') {
    const current = existing.source?.toString?.() ?? ''
    if (current !== scriptSource) {
      existing.source = scriptSource
    }
    return
  }

  emitScriptlessComponentAsset(ctx, scriptFileName)
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
  const normalizedConfig = normalizeVueConfigForPlatform(options.config, {
    platform: options.platform,
    dependencies: options.dependencies,
    alipayNpmMode: options.alipayNpmMode,
  })
  emitAlipayGenericPlaceholderAssets(
    options.pluginCtx,
    bundle,
    options.relativeBase,
    normalizedConfig,
    options.outputExtensions,
    options.platform,
  )
  return normalizedConfig
}
