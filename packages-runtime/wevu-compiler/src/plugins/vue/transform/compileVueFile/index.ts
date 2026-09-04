import type { CompileVueFileOptions, VueTransformResult } from './types'
import { compileScript } from 'vue/compiler-sfc'
import { getMiniProgramTemplatePlatform } from '../../compiler/template'
import { generateScopedId } from '../scopedId'
import { collectComponentSourceInfo } from './componentSources'
import { compileConfigPhase } from './config'
import { finalizeResult } from './finalize'
import { applyCompilerTemplateWrappers, mergeCompilerLayoutUsingComponents } from './pageLayout'
import { parseVueFile } from './parse'
import { compileScriptPhase, resolveEffectivePropsDerivedKeys, resolveScriptSetupPropsAliases } from './script'
import { compileStylePhase } from './style'
import { compileTemplatePhase } from './template'

export { refreshVueFileJsonConfig } from './jsonOnly'

export type {
  AutoImportTagsOptions,
  AutoUsingComponentsOptions,
  CompileVueFileOptions,
  ResolvedUsingComponentInfo,
  ResolvedUsingComponentPath,
  VueTransformResult,
} from './types'

/**
 * 编译 Vue 单文件组件，输出脚本、模板、样式与配置结果。
 */
export async function compileVueFile(
  source: string,
  filename: string,
  options?: CompileVueFileOptions,
): Promise<VueTransformResult> {
  const parsed = await parseVueFile(source, filename, options)
  const sfcId = generateScopedId(filename)

  const result: VueTransformResult = {
    meta: {
      ...parsed.meta,
      styleBlocks: parsed.descriptor.styles,
    },
  }

  const autoUsingComponents = (options?.autoUsingComponents?.enabled
    && (parsed.descriptor.scriptSetup || parsed.descriptor.script)
    && parsed.descriptor.template
    && options.autoUsingComponents.resolveUsingComponentPath)
    ? options.autoUsingComponents
    : undefined

  const autoImportTags = (options?.autoImportTags?.enabled
    && parsed.descriptor.template
    && options.autoImportTags.resolveUsingComponent)
    ? options.autoImportTags
    : undefined

  const componentSourceInfo = await collectComponentSourceInfo({
    descriptor: parsed.descriptor,
    descriptorForCompile: parsed.descriptorForCompile,
    filename,
    compileOptions: options,
    autoUsingComponents,
    autoImportTags,
  })

  const scriptCompiled = parsed.descriptor.script || parsed.descriptor.scriptSetup
    ? compileScript(parsed.descriptorForCompile, {
        id: sfcId,
        isProd: false,
      })
    : undefined
  const propsAliases = scriptCompiled
    ? resolveScriptSetupPropsAliases(scriptCompiled.bindings as Record<string, any> | undefined)
    : undefined
  const propsDerivedKeys = scriptCompiled
    ? resolveEffectivePropsDerivedKeys(scriptCompiled.bindings as Record<string, any> | undefined, scriptCompiled.content)
    : undefined

  const styleCompiled = await compileStylePhase(parsed.descriptor, filename, result, options?.style)

  const scopedId = parsed.descriptor.styles.some(style => style.scoped)
    ? `data-v-${sfcId}`
    : undefined
  const baseTemplateOptions = parsed.isAppFile
    ? {
        ...options?.template,
        isPage: options?.isPage,
        runtimeBindingManifest: options?.runtimeBindingManifest,
        propsAliases,
        propsDerivedKeys,
        scriptSetupBindings: scriptCompiled?.bindings as Record<string, unknown> | undefined,
        scopedSlotsRequireProps: true,
        scopeId: scopedId,
        slottedScopeId: scopedId && styleCompiled.usesSlotted ? `${scopedId}-s` : undefined,
        cssVars: parsed.descriptor.cssVars.length > 0,
      }
    : {
        ...options?.template,
        isPage: options?.isPage,
        runtimeBindingManifest: options?.runtimeBindingManifest,
        propsAliases,
        propsDerivedKeys,
        scriptSetupBindings: scriptCompiled?.bindings as Record<string, unknown> | undefined,
        scopeId: scopedId,
        slottedScopeId: scopedId && styleCompiled.usesSlotted ? `${scopedId}-s` : undefined,
        cssVars: parsed.descriptor.cssVars.length > 0,
      }

  const templateOptions = componentSourceInfo.wevuComponentTags.size
    ? {
        ...baseTemplateOptions,
        wevuComponentTags: componentSourceInfo.wevuComponentTags,
        componentNameMap: componentSourceInfo.componentNameMap,
        miniProgramComponentTags: componentSourceInfo.miniProgramComponentTags,
      }
    : {
        ...baseTemplateOptions,
        wevuComponentTags: [],
        componentNameMap: componentSourceInfo.componentNameMap,
        miniProgramComponentTags: componentSourceInfo.miniProgramComponentTags,
      }

  const templateCompiled = compileTemplatePhase(
    parsed.descriptor,
    filename,
    source,
    parsed.templateResolvedId,
    templateOptions,
    result,
    options?.bindingManifestSourceFile,
  )
  if (templateCompiled?.diagnostics.length && options?.warn) {
    for (const diagnostic of templateCompiled.diagnostics) {
      options.warn(diagnostic.message)
    }
  }

  if (templateCompiled && result.template && (options?.pageLayout || options?.appShell)) {
    result.template = applyCompilerTemplateWrappers({
      template: result.template,
      manifest: templateCompiled.bindingManifest,
      platform: templateOptions.platform ?? getMiniProgramTemplatePlatform(),
      pageLayout: options.pageLayout,
      appShell: options.appShell,
    })
    templateCompiled.code = result.template
  }
  const scriptPhase = await compileScriptPhase(
    parsed.descriptor,
    parsed.descriptorForCompile,
    filename,
    options,
    autoUsingComponents,
    templateCompiled,
    parsed.isAppFile,
    componentSourceInfo,
    scriptCompiled,
    {
      propsAliases,
      propsDerivedKeys,
      cssModules: result.cssModules,
    },
    source,
  )
  result.script = scriptPhase.script
  result.scriptMap = scriptPhase.scriptMap
  if (scriptPhase.template) {
    result.template = scriptPhase.template
  }
  if (scriptPhase.bindingManifest) {
    result.bindingManifest = scriptPhase.bindingManifest
  }
  if (scriptPhase.diagnostics?.length) {
    result.diagnostics = [...(result.diagnostics ?? []), ...scriptPhase.diagnostics]
  }

  await compileConfigPhase({
    descriptor: parsed.descriptor,
    filename,
    autoUsingComponentsMap: scriptPhase.autoUsingComponentsMap,
    autoImportTagsMap: componentSourceInfo.autoImportTagsMap,
    autoUsingComponents,
    autoImportTags,
    jsonDefaults: parsed.jsonDefaults as Record<string, any> | undefined,
    mergeJson: parsed.mergeJson,
    scriptSetupMacroConfig: parsed.scriptSetupMacroConfig,
    result,
    warn: options?.warn,
  })
  result.config = mergeCompilerLayoutUsingComponents(
    result.config,
    options?.pageLayout,
    options?.appShell,
  )

  result.meta!.jsonConfigCache = {
    autoUsingComponentsMap: { ...scriptPhase.autoUsingComponentsMap },
    autoImportTagsMap: componentSourceInfo.autoImportTagsMap
      ? { ...componentSourceInfo.autoImportTagsMap }
      : undefined,
  }

  finalizeResult(result, {
    scriptSetupMacroHash: parsed.scriptSetupMacroHash,
    defineOptionsHash: parsed.defineOptionsHash,
  })

  return result
}
