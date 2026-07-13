import type { CompileVueFileOptions, VueTransformResult } from './types'
import { compileConfigPhase } from './config'
import { parseVueFile } from './parse'

/**
 * 只重算 Vue SFC 的 JSON 配置，并复用脚本、模板与样式编译结果。
 *
 * @internal
 */
export async function refreshVueFileJsonConfig(
  source: string,
  filename: string,
  cachedResult: VueTransformResult,
  options?: CompileVueFileOptions,
): Promise<VueTransformResult | undefined> {
  const jsonConfigCache = cachedResult.meta?.jsonConfigCache
  if (!jsonConfigCache) {
    return undefined
  }

  const parsed = await parseVueFile(source, filename, options)
  const meta = {
    ...cachedResult.meta,
    hasScriptSetup: parsed.meta.hasScriptSetup,
    hasSetupOption: parsed.meta.hasSetupOption,
    sfcSrcDeps: parsed.meta.sfcSrcDeps,
  }
  const result: VueTransformResult = {
    ...cachedResult,
    meta,
  }
  delete result.config

  await compileConfigPhase({
    descriptor: parsed.descriptor,
    filename,
    autoUsingComponentsMap: { ...jsonConfigCache.autoUsingComponentsMap },
    autoImportTagsMap: jsonConfigCache.autoImportTagsMap
      ? { ...jsonConfigCache.autoImportTagsMap }
      : undefined,
    autoUsingComponents: options?.autoUsingComponents,
    autoImportTags: options?.autoImportTags,
    jsonDefaults: parsed.jsonDefaults as Record<string, any> | undefined,
    mergeJson: parsed.mergeJson,
    scriptSetupMacroConfig: parsed.scriptSetupMacroConfig,
    result,
    warn: options?.warn,
  })

  if (parsed.scriptSetupMacroHash) {
    meta.jsonMacroHash = parsed.scriptSetupMacroHash
  }
  else {
    delete meta.jsonMacroHash
  }

  return result
}
