import type { CompileVueFileOptions, VueTransformResult } from './types'
import { compileScript } from 'vue/compiler-sfc'
import { collectComponentSourceInfo } from './componentSources'
import { compileConfigPhase } from './config'
import { finalizeResult } from './finalize'
import { parseVueFile } from './parse'
import { compileScriptPhase, resolveEffectivePropsDerivedKeys, resolveScriptSetupPropsAliases } from './script'
import { compileStylePhase } from './style'
import { compileTemplatePhase } from './template'

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

  const result: VueTransformResult = {
    meta: {
      ...parsed.meta,
      styleBlocks: parsed.descriptor.styles,
    },
  }

  const autoUsingComponents = (options?.autoUsingComponents?.enabled
    && parsed.descriptor.scriptSetup
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
        id: filename,
        isProd: false,
      })
    : undefined
  const propsAliases = scriptCompiled
    ? resolveScriptSetupPropsAliases(scriptCompiled.bindings as Record<string, any> | undefined)
    : undefined
  const propsDerivedKeys = scriptCompiled
    ? resolveEffectivePropsDerivedKeys(scriptCompiled.bindings as Record<string, any> | undefined, scriptCompiled.content)
    : undefined

  const baseTemplateOptions = parsed.isAppFile
    ? {
        ...options?.template,
        propsAliases,
        propsDerivedKeys,
        scriptSetupBindings: scriptCompiled?.bindings as Record<string, unknown> | undefined,
        scopedSlotsRequireProps: true,
      }
    : {
        ...options?.template,
        propsAliases,
        propsDerivedKeys,
        scriptSetupBindings: scriptCompiled?.bindings as Record<string, unknown> | undefined,
      }

  const templateOptions = componentSourceInfo.wevuComponentTags.size
    ? {
        ...baseTemplateOptions,
        wevuComponentTags: componentSourceInfo.wevuComponentTags,
        componentNameMap: componentSourceInfo.componentNameMap,
      }
    : {
        ...baseTemplateOptions,
        wevuComponentTags: [],
        componentNameMap: componentSourceInfo.componentNameMap,
      }

  const templateCompiled = compileTemplatePhase(
    parsed.descriptor,
    filename,
    templateOptions,
    result,
  )

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
  )
  result.script = scriptPhase.script
  result.scriptMap = scriptPhase.scriptMap

  compileStylePhase(parsed.descriptor, filename, result)

  await compileConfigPhase({
    descriptor: parsed.descriptor,
    filename,
    autoUsingComponentsMap: scriptPhase.autoUsingComponentsMap,
    autoUsingComponents,
    autoImportTags,
    jsonDefaults: parsed.jsonDefaults as Record<string, any> | undefined,
    mergeJson: parsed.mergeJson,
    scriptSetupMacroConfig: parsed.scriptSetupMacroConfig,
    result,
    warn: options?.warn,
  })

  finalizeResult(result, {
    scriptSetupMacroHash: parsed.scriptSetupMacroHash,
    defineOptionsHash: parsed.defineOptionsHash,
  })

  return result
}
