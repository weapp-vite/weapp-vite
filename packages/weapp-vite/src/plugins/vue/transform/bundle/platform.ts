import type { CompilerContext } from '../../../../context'
import type { OutputExtensions } from '../../../../platforms/types'
import {
  shouldEmitGenericPlaceholderAsset,
  shouldNormalizeUsingComponents,
  shouldNormalizeVueTemplateForPlatform,
} from '../../../../platform'
import { ALIPAY_GENERIC_COMPONENT_PLACEHOLDER, resolveJson } from '../../../../utils'
import { resolveScriptModuleTagByPlatform } from '../../../../utils/wxmlScriptModule'
import { scanWxml } from '../../../../wxml'
import { handleWxml } from '../../../../wxml/handle'
import { emitSfcJsonAsset, emitSfcTemplateIfMissing } from '../emitAssets'
import { SCRIPTLESS_COMPONENT_STUB } from './shared'

const LEADING_DOT_SLASH_RE = /^\.\//

export function normalizeVueConfigForPlatform(
  config: string | undefined,
  options: {
    platform: string
    dependencies?: Record<string, string>
    alipayNpmMode?: string
  },
) {
  if (!config || !shouldNormalizeUsingComponents(options.platform as any)) {
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
        dependencies: options.dependencies,
        alipayNpmMode: options.alipayNpmMode,
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
  if (!shouldNormalizeVueTemplateForPlatform(options.platform as any)) {
    return template
  }

  try {
    const token = scanWxml(template, {
      platform: options.platform as any,
    })
    return handleWxml(token, {
      templateExtension: options.templateExtension,
      scriptModuleExtension: options.scriptModuleExtension,
      scriptModuleTag: resolveScriptModuleTagByPlatform(options.platform as any, options.scriptModuleExtension),
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
  if (!shouldEmitGenericPlaceholderAsset(platform as any) || !configSource) {
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

  ctx.emitFile({ type: 'asset', fileName: scriptFileName, source: scriptSource })
}
