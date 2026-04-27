import type { CompileVueFileOptions, VueTransformResult } from './types'
import { collectComponentSourceInfo } from './componentSources'
import { compileConfigPhase } from './config'
import { finalizeResult } from './finalize'
import { parseVueFile } from './parse'
import { compileScriptPhase } from './script'
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

  const templateOptions = componentSourceInfo.wevuComponentTags.size
    ? {
        ...options?.template,
        wevuComponentTags: componentSourceInfo.wevuComponentTags,
      }
    : {
        ...options?.template,
        wevuComponentTags: [],
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
