import type { CompileVueFileOptions, ResolvedUsingComponentPath, VueTransformResult } from '../vue/transform/compileVueFile/types'
import { removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
import { createWevuRuntimeCapabilityMetadataFromBindingManifest } from '../../runtimeCapabilities'
import { isAutoImportCandidateTag } from '../../utils/vueTemplateTags'
import { getMiniProgramTemplatePlatform } from '../vue/compiler/template'
import { applyCompilerTemplateWrappers, mergeCompilerLayoutUsingComponents } from '../vue/transform/compileVueFile/pageLayout'
import { extractJsonMacroFromScriptSetup, mayContainJsonMacro } from '../vue/transform/jsonMacros'
import { createJsonMerger } from '../vue/transform/jsonMerge'
import { transformScript } from '../vue/transform/script'
import { createJsxDiagnostics } from './compileJsx/diagnostics'
import { injectDynamicIslandRuntime, stripRenderOptionFromScript } from './compileJsx/script'
import { compileJsxTemplateAndCollectComponents } from './compileJsx/template'
import { transformVueJsxScript } from './vueJsxTransform'

const LEADING_DOT_RE = /^\./
const SETUP_CALL_RE = /\bsetup\s*\(/

function normalizeUsingComponentFrom(value: ResolvedUsingComponentPath | undefined) {
  if (!value) {
    return undefined
  }
  return typeof value === 'string' ? value : value.from
}

function toMiniProgramComponentTag(name: string) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
}

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

  if (mayContainJsonMacro(source)) {
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
  }

  const {
    template: rawTemplate,
    warnings: templateWarnings,
    bindingManifest,
    inlineExpressions,
    autoComponentContext,
    dynamicIslands,
    dependencies,
  } = compileJsxTemplateAndCollectComponents(source, filename, options)

  const autoUsingComponentsMap: Record<string, string> = {}
  const localComponentAliases = new Map<string, string>()
  if (options?.autoUsingComponents?.resolveUsingComponentPath && autoComponentContext.templateTags.size > 0) {
    for (const imported of autoComponentContext.importedComponents) {
      if (!autoComponentContext.templateTags.has(imported.localName)) {
        continue
      }

      let resolved = normalizeUsingComponentFrom(await options.autoUsingComponents.resolveUsingComponentPath(
        imported.importSource,
        filename,
        {
          localName: imported.localName,
          importedName: imported.importedName,
          kind: imported.kind,
        },
      ))

      if (!resolved && imported.importSource.startsWith('/')) {
        resolved = removeExtensionDeep(imported.importSource)
      }
      if (!resolved) {
        continue
      }

      const componentName = imported.importSource.startsWith('.') || imported.importSource.startsWith('/')
        ? toMiniProgramComponentTag(imported.localName)
        : imported.localName
      autoUsingComponentsMap[componentName] = resolved
      if (componentName !== imported.localName) {
        localComponentAliases.set(imported.localName, componentName)
      }
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

      const resolvedName = resolved.name || tag
      autoImportTagsMap[localComponentAliases.get(resolvedName) ?? resolvedName] = resolved.from
    }
  }

  let compiledTemplateStr = rawTemplate
  for (const [from, to] of localComponentAliases) {
    if (compiledTemplateStr) {
      compiledTemplateStr = compiledTemplateStr
        .replaceAll(`<${from}`, `<${to}`)
        .replaceAll(`</${from}>`, `</${to}>`)
    }
  }
  if (compiledTemplateStr && (options?.pageLayout || options?.appShell)) {
    compiledTemplateStr = applyCompilerTemplateWrappers({
      template: compiledTemplateStr,
      manifest: bindingManifest,
      platform: options?.template?.platform ?? getMiniProgramTemplatePlatform(),
      pageLayout: options?.pageLayout,
      appShell: options?.appShell,
    })
  }
  const normalizedScriptSource = injectDynamicIslandRuntime(
    stripRenderOptionFromScript(scriptSource, filename, templateWarnings),
    dynamicIslands,
  )
  const vueJsxTransformed = transformVueJsxScript(normalizedScriptSource, filename, options?.sourceMap !== false)
  const runtimeCapabilities = createWevuRuntimeCapabilityMetadataFromBindingManifest(bindingManifest)
  const transformedScript = transformScript(vueJsxTransformed.code, {
    skipComponentTransform: options?.skipComponentTransform ?? options?.isApp,
    isApp: options?.isApp,
    isPage: options?.isPage,
    minify: options?.minify,
    sourceMap: options?.sourceMap,
    warn: options?.warn,
    wevuDefaults: options?.wevuDefaults,
    inlineExpressions,
    bindingManifest: options?.isApp ? undefined : bindingManifest,
    autoSetDataPick: !options?.isApp && options?.autoSetDataPick,
    runtimeBindingManifest: options?.runtimeBindingManifest,
    pageLayout: options?.isApp ? undefined : options?.pageLayout,
    runtimeCapabilities,
  })

  const diagnostics = templateWarnings.length
    ? createJsxDiagnostics(templateWarnings, filename)
    : undefined
  if (diagnostics && options?.warn) {
    diagnostics.forEach(diagnostic => options.warn?.(diagnostic.message))
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
  const config = mergeCompilerLayoutUsingComponents(
    configObj && Object.keys(configObj).length > 0
      ? JSON.stringify(configObj, null, 2)
      : undefined,
    options?.pageLayout,
    options?.appShell,
  )

  const result: VueTransformResult = {
    script: transformedScript.code,
    scriptMap: transformedScript.map ?? vueJsxTransformed.map,
    template: compiledTemplateStr,
    diagnostics,
    bindingManifest,
    config,
    meta: {
      hasScriptSetup: false,
      hasSetupOption: SETUP_CALL_RE.test(normalizedScriptSource),
      jsonMacroHash: scriptMacroHash,
      jsxDynamicIslands: dynamicIslands,
      ...(transformedScript.runtimeCapabilities
        ? { runtimeCapabilities: transformedScript.runtimeCapabilities }
        : {}),
      jsxDependencies: dependencies,
    },
  }

  return result
}
