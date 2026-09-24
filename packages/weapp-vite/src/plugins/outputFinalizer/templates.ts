import type { OutputBundle } from 'rolldown'
import type { CompilerContext } from '../../context'
import type { MpPlatform, SubPackageMetaValue } from '../../types'
import type { WxmlSyntax } from '../../wxml/template/lexical'
import { Buffer } from 'node:buffer'
import { getSupportedMiniProgramDirectivePrefixes } from '@weapp-core/shared'
import { getWxmlPlatformTransformOptions } from '../../platform'
import { resolveScriptModuleTagName } from '../../utils/wxmlScriptModule'
import { handleWxml, scanWxml } from '../../wxml'
import { resolveWxmlRemoveOptions } from '../../wxml/options'
import { createWxmlRemover } from '../../wxml/remove'
import { transformWxml } from '../../wxml/transform'
import { beginWxmlTransformDependencies } from '../../wxml/transform/dependencies'
import { transformI18nOutputTemplate } from '../i18n'

const TEMPLATE_STATIC_REWRITE_MARKERS = [
  '@',
  '#ifdef',
  '#endif',
  '<wxs',
  '</wxs',
  '<sjs',
  '</sjs',
  '.html',
  '.wxs',
  '.sjs',
  '.wxml',
  '.axml',
  '.swan',
  '.ttml',
  '.jxml',
  '.qml',
  '.ksml',
  '.xhsml',
  'import.meta.',
  'wx-if',
  'wx-for',
] as const
const TEMPLATE_DIRECTIVE_PREFIXES = getSupportedMiniProgramDirectivePrefixes()

export interface OutputAssetEntry {
  bundleFileName: string
  output: Extract<OutputBundle[string], { type: 'asset' }>
}

export function mayNeedTemplateNormalization(code: string, platform?: MpPlatform) {
  let lowerCode: string | undefined
  const readLowerCode = () => {
    lowerCode ??= code.toLowerCase()
    return lowerCode
  }
  const hasUppercase = /[A-Z]/.test(code)
  const { directivePrefix, eventBindingStyle, normalizeComponentTagName } = getWxmlPlatformTransformOptions(platform)
  if (normalizeComponentTagName && hasUppercase) {
    return true
  }

  for (const prefix of TEMPLATE_DIRECTIVE_PREFIXES) {
    if (prefix !== directivePrefix) {
      const marker = prefix === 's' ? 's-' : `${prefix}:`
      if (code.includes(marker)) {
        return true
      }
    }
  }

  if (eventBindingStyle === 'alipay' && (
    readLowerCode().includes('bind')
    || readLowerCode().includes('catch')
    || readLowerCode().includes('capture-')
    || readLowerCode().includes('mut-bind')
  )) {
    return true
  }

  const normalizedCode = hasUppercase ? readLowerCode() : code
  return TEMPLATE_STATIC_REWRITE_MARKERS.some(marker => normalizedCode.includes(marker))
}

export async function normalizeTemplateAssetEntries(
  ctx: CompilerContext,
  entries: OutputAssetEntry[],
  subPackageMeta?: SubPackageMetaValue,
  hooks?: { addWatchFile: (file: string) => void, warn: (message: string) => void, partial: boolean },
) {
  const { configService } = ctx
  const wxml = configService?.weappViteConfig?.wxml
  const transform = typeof wxml === 'object' ? wxml.transform : undefined
  const useTransform = Boolean(transform && (!Array.isArray(transform) || transform.length))
  const removeOptions = resolveWxmlRemoveOptions(wxml)
  const remove = createWxmlRemover(removeOptions)
  const previous = ctx.runtimeState?.wxmlTransform
  const dependencies = useTransform || previous?.dependencies.size || previous?.pending.size
    ? beginWxmlTransformDependencies(ctx, subPackageMeta ? `independent:${subPackageMeta.subPackage.root}` : 'main', hooks?.partial ?? false)
    : undefined
  const syntax: WxmlSyntax = (configService?.platform ?? 'weapp') === 'weapp' ? 'legacy' : 'xml'
  for (const { bundleFileName, output } of entries) {
    const fileName = output.fileName || bundleFileName
    const source = output.source
    const code = typeof source === 'string'
      ? source
      : source instanceof Uint8Array
        ? Buffer.from(source).toString('utf8')
        : undefined
    if (code === undefined) {
      continue
    }
    let normalized = code
    if (mayNeedTemplateNormalization(code, configService?.platform)) {
      const token = scanWxml(code, { platform: configService?.platform })
      normalized = handleWxml(token, {
        removeComment: false,
        scriptModuleExtension: configService?.outputExtensions?.wxs,
        scriptModuleTag: resolveScriptModuleTagName({
          platform: configService?.platform,
          scriptModuleExtension: configService?.outputExtensions?.wxs,
        }),
        templateExtension: configService?.outputExtensions?.wxml,
      }).code
    }
    const localized = transformI18nOutputTemplate(ctx, fileName, normalized, subPackageMeta)
    let custom = localized
    if (useTransform) {
      const register = dependencies!.template(fileName)
      custom = await transformWxml(ctx, localized, fileName, syntax, (file) => {
        const resolved = register(file)
        hooks?.addWatchFile(resolved)
      }, message => hooks?.warn(message), subPackageMeta?.subPackage.root)
    }
    const transformed = remove(custom, fileName, syntax)
    if (transformed !== code) {
      output.source = transformed
    }
  }
  dependencies?.commit()
}
