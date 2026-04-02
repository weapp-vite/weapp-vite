import type { CompileVueFileOptions, VueTransformResult } from './types'
import { compileConfigPhase } from './config'
import { finalizeResult } from './finalize'
import { parseVueFile } from './parse'
import { compileScriptPhase } from './script'
import { compileStylePhase } from './style'
import { compileTemplatePhase } from './template'

export type { AutoImportTagsOptions, AutoUsingComponentsOptions, CompileVueFileOptions, VueTransformResult } from './types'

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
    meta: { ...parsed.meta },
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

  const templateCompiled = compileTemplatePhase(
    parsed.descriptor,
    filename,
    options?.template,
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
  )
  result.script = scriptPhase.script

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
