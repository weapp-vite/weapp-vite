import type { CompileVueFileOptions, VueTransformResult } from '../vue/transform/compileVueFile/types'
import { removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
import { isAutoImportCandidateTag } from '../../utils/vueTemplateTags'
import { extractJsonMacroFromScriptSetup } from '../vue/transform/jsonMacros'
import { createJsonMerger } from '../vue/transform/jsonMerge'
import { transformScript } from '../vue/transform/script'
import { stripRenderOptionFromScript } from './compileJsx/script'
import { compileJsxTemplateAndCollectComponents } from './compileJsx/template'

const LEADING_DOT_RE = /^\./
const SETUP_CALL_RE = /\bsetup\s*\(/

/**
 * 编译 JSX/TSX 文件，输出 wevu 脚本与 WXML 模板。
 */
export async function compileJsxFile(
  source: string,
  filename: string,
  options?: CompileVueFileOptions,
): Promise<VueTransformResult> {
  const jsonKind = options?.json?.kind
    ?? (options?.isApp ? 'app' : options?.isPage ? 'page' : 'component')
  const jsonDefaults = options?.json?.defaults?.[jsonKind]
  const mergeJson = createJsonMerger(options?.json?.mergeStrategy, { filename, kind: jsonKind })

  let scriptSource = source
  let scriptMacroConfig: Record<string, any> | undefined
  let scriptMacroHash: string | undefined
  const scriptLang = path.extname(filename).replace(LEADING_DOT_RE, '') || undefined

  try {
    const extracted = await extractJsonMacroFromScriptSetup(source, filename, scriptLang, {
      merge: (target, incoming) => mergeJson(target, incoming, 'macro'),
    })
    scriptSource = extracted.stripped
    scriptMacroConfig = extracted.config
    scriptMacroHash = extracted.macroHash
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`解析 ${filename} 失败：${message}`)
  }

  const { template: compiledTemplateStr, warnings: templateWarnings, inlineExpressions, autoComponentContext } = compileJsxTemplateAndCollectComponents(source, filename, options)

  const autoUsingComponentsMap: Record<string, string> = {}
  if (options?.autoUsingComponents?.resolveUsingComponentPath && autoComponentContext.templateTags.size > 0) {
    for (const imported of autoComponentContext.importedComponents) {
      if (!autoComponentContext.templateTags.has(imported.localName)) {
        continue
      }

      let resolved = await options.autoUsingComponents.resolveUsingComponentPath(
        imported.importSource,
        filename,
        {
          localName: imported.localName,
          importedName: imported.importedName,
          kind: imported.kind,
        },
      )

      if (!resolved && imported.importSource.startsWith('/')) {
        resolved = removeExtensionDeep(imported.importSource)
      }
      if (!resolved) {
        continue
      }

      autoUsingComponentsMap[imported.localName] = resolved
    }
  }

  const autoImportTagsMap: Record<string, string> = {}
  if (options?.autoImportTags?.resolveUsingComponent && autoComponentContext.templateTags.size > 0) {
    for (const tag of autoComponentContext.templateTags) {
      if (!isAutoImportCandidateTag(tag)) {
        continue
      }

      let resolved: { name: string, from: string } | undefined
      try {
        resolved = await options.autoImportTags.resolveUsingComponent(tag, filename)
      }
      catch {
        resolved = undefined
      }

      if (!resolved?.from) {
        continue
      }

      autoImportTagsMap[resolved.name || tag] = resolved.from
    }
  }

  const normalizedScriptSource = stripRenderOptionFromScript(scriptSource, filename, options?.warn)
  const transformedScript = transformScript(normalizedScriptSource, {
    skipComponentTransform: options?.isApp,
    isApp: options?.isApp,
    isPage: options?.isPage,
    warn: options?.warn,
    wevuDefaults: options?.wevuDefaults,
    inlineExpressions,
  })

  if (templateWarnings.length && options?.warn) {
    templateWarnings.forEach(message => options.warn?.(`[JSX 编译] ${message}`))
  }

  let configObj: Record<string, any> | undefined

  const shouldMergeUsingComponents = Object.keys(autoUsingComponentsMap).length > 0 || Object.keys(autoImportTagsMap).length > 0
  if (shouldMergeUsingComponents) {
    const existingRaw = configObj?.usingComponents
    const usingComponents: Record<string, string> = (existingRaw && typeof existingRaw === 'object' && !Array.isArray(existingRaw))
      ? existingRaw
      : {}

    for (const [name, from] of Object.entries(autoImportTagsMap)) {
      if (Reflect.has(usingComponents, name) && usingComponents[name] !== from) {
        options?.autoImportTags?.warn?.(
          `[JSX 编译] usingComponents 冲突：${filename} 中 usingComponents['${name}']='${usingComponents[name]}' 将被 JSX 标签自动引入覆盖为 '${from}'`,
        )
      }
      usingComponents[name] = from
    }

    for (const [name, from] of Object.entries(autoUsingComponentsMap)) {
      if (Reflect.has(usingComponents, name) && usingComponents[name] !== from) {
        options?.autoUsingComponents?.warn?.(
          `[JSX 编译] usingComponents 冲突：${filename} 中 usingComponents['${name}']='${usingComponents[name]}' 将被 JSX 导入组件覆盖为 '${from}'`,
        )
      }
      usingComponents[name] = from
    }

    configObj = mergeJson(configObj ?? {}, { usingComponents }, 'auto-using-components')
  }

  if (jsonDefaults && Object.keys(jsonDefaults).length > 0) {
    configObj = mergeJson(configObj ?? {}, jsonDefaults, 'defaults')
  }
  if (scriptMacroConfig && Object.keys(scriptMacroConfig).length > 0) {
    configObj = mergeJson(configObj ?? {}, scriptMacroConfig, 'macro')
  }

  const result: VueTransformResult = {
    script: transformedScript.code,
    template: compiledTemplateStr,
    config: configObj && Object.keys(configObj).length > 0
      ? JSON.stringify(configObj, null, 2)
      : undefined,
    meta: {
      hasScriptSetup: false,
      hasSetupOption: SETUP_CALL_RE.test(normalizedScriptSource),
      jsonMacroHash: scriptMacroHash,
    },
  }

  return result
}
