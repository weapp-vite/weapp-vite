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
import { beginWxmlDependencies, createWxmlWatchFileResolver } from '../../wxml/processing/dependencies'
import { createWxmlRemover } from '../../wxml/remove'
import { transformWxml } from '../../wxml/transform'
import { transformI18nOutputTemplate } from '../i18n'

const TEMPLATE_STATIC_REWRITE_MARKERS = [
  '@',
  '#ifdef',
  '#endif',
  '<wxs',
  '</wxs',
  '<sjs',
  '</sjs',
  '<filter',
  '</filter',
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

function createTemplateNormalizer(ctx: CompilerContext, subPackageMeta?: SubPackageMetaValue) {
  const { configService } = ctx
  const wxml = configService?.weappViteConfig?.wxml
  const transform = typeof wxml === 'object' ? wxml.transform : undefined
  const useTransform = Boolean(transform && (!Array.isArray(transform) || transform.length))
  const removeOptions = resolveWxmlRemoveOptions(wxml)
  const remove = createWxmlRemover(removeOptions, configService?.platform)
  const syntax: WxmlSyntax = (configService?.platform ?? 'weapp') === 'weapp' ? 'legacy' : 'xml'
  return {
    useTransform,
    normalize(fileName: string, code: string) {
      let normalized = code
      if (mayNeedTemplateNormalization(code, configService?.platform)) {
        const token = scanWxml(code, { platform: configService?.platform })
        normalized = handleWxml(token, {
          platform: configService?.platform,
          removeComment: false,
          scriptModuleExtension: configService?.outputExtensions?.wxs,
          scriptModuleTag: resolveScriptModuleTagName({
            platform: configService?.platform,
            scriptModuleExtension: configService?.outputExtensions?.wxs,
          }),
          templateExtension: configService?.outputExtensions?.wxml,
        }).code
      }
      return transformI18nOutputTemplate(ctx, fileName, normalized, subPackageMeta)
    },
    async transform(fileName: string, code: string, addWatchFile: (file: string) => void, warn: (message: string) => void) {
      const custom = useTransform
        ? await transformWxml(ctx, code, fileName, syntax, addWatchFile, warn, subPackageMeta?.subPackage.root)
        : code
      return remove(custom, fileName, syntax)
    },
  }
}

interface PreparedTemplate {
  input: string
  output: string
  watchFiles: Set<string>
}

export interface PreparedTemplates {
  clear: () => void
  get: (fileName: string, input: string) => PreparedTemplate | undefined
  prepare: (fileName: string, code: string, hooks: TemplateWatchHooks) => Promise<string>
}

interface TemplateWatchHooks {
  addWatchFile: (file: string) => void
  warn: (message: string) => void
}

/** 命名前收集实际模板的引用，后续发射同一个转换结果并提交依赖。 */
export function createPreparedTemplates(ctx: CompilerContext): PreparedTemplates {
  const cache = new Map<string, PreparedTemplate>()
  let normalizer: ReturnType<typeof createTemplateNormalizer> | undefined
  let resolve: ReturnType<typeof createWxmlWatchFileResolver> | undefined
  return {
    clear() {
      cache.clear()
      normalizer = undefined
      resolve = undefined
    },
    get(fileName, input) {
      const prepared = cache.get(fileName)
      return prepared?.input === input ? prepared : undefined
    },
    async prepare(fileName, code, hooks) {
      normalizer ??= createTemplateNormalizer(ctx)
      resolve ??= createWxmlWatchFileResolver(ctx)
      const resolveWatchFile = resolve
      const input = normalizer.normalize(fileName, code)
      const prepared = cache.get(fileName)
      if (prepared?.input === input) {
        return prepared.output
      }
      const watchFiles = new Set<string>()
      const output = await normalizer.transform(fileName, input, (file) => {
        const resolved = resolveWatchFile(file)
        hooks.addWatchFile(resolved)
        watchFiles.add(resolved)
      }, hooks.warn)
      cache.set(fileName, { input, output, watchFiles })
      return output
    },
  }
}

export async function normalizeTemplateAssetEntries(
  ctx: CompilerContext,
  entries: OutputAssetEntry[],
  subPackageMeta?: SubPackageMetaValue,
  hooks?: TemplateWatchHooks & {
    preparedTemplates?: PreparedTemplates
    partial: boolean
    rewriteImages?: (entries: OutputAssetEntry[]) => Promise<void>
  },
) {
  const normalizer = createTemplateNormalizer(ctx, subPackageMeta)
  const previous = ctx.runtimeState?.wxmlProcessing
  const dependencies = normalizer.useTransform || previous?.dependencies.size || previous?.pending.size || previous?.failed.size
    ? beginWxmlDependencies(ctx, subPackageMeta ? `independent:${subPackageMeta.subPackage.root}` : 'main', hooks?.partial ?? false)
    : undefined
  try {
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
      const localized = normalizer.normalize(fileName, code)
      const prepared = hooks?.preparedTemplates?.get(fileName, localized)
      const register = normalizer.useTransform ? dependencies!.template(fileName) : undefined
      if (register && prepared) {
        for (const file of prepared.watchFiles) {
          register(file)
        }
      }
      const filtered = prepared?.output ?? await normalizer.transform(fileName, localized, (file) => {
        const resolved = register!(file)
        hooks?.addWatchFile(resolved)
      }, message => hooks?.warn(message))
      if (filtered !== code) {
        output.source = filtered
      }
    }
    await hooks?.rewriteImages?.(entries)
  }
  catch (error) {
    dependencies?.fail()
    throw error
  }
  finally {
    hooks?.preparedTemplates?.clear()
  }
  return dependencies?.publish
}
