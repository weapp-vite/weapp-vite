import type { AstEngineName, AstParserLike } from '../types'
import type { FeatureFlagOptions } from './featureFlags'
import { analyzeScriptsWithNative, analyzeScriptWithNative, shouldUseNativeAst } from '../native'
import { jsScriptAnalysisService } from './internal/scriptAnalysis'

export interface ScriptAnalysisOptions<TFeature extends string = string> {
  engine?: AstEngineName
  parserLike?: AstParserLike
  featureFlags?: FeatureFlagOptions<TFeature>
}

export interface ScriptAnalysisResult<TFeature extends string = string> {
  hasStaticRequireLiteral: boolean
  hasPlatformApiAccess: boolean
  featureFlags: Set<TFeature>
}

export interface ScriptAnalysisBatchInput<TFeature extends string = string> {
  code: string
  filename?: string
  featureFlags?: FeatureFlagOptions<TFeature>
}

function normalizeNativeAnalysis<TFeature extends string>(
  nativeAnalysis: {
    hasStaticRequireLiteral: boolean
    hasPlatformApiAccess: boolean
    featureFlags: string[]
  },
  featureFlags?: FeatureFlagOptions<TFeature>,
): ScriptAnalysisResult<TFeature> {
  const validFeatures = new Set(Object.values(featureFlags?.hookToFeature ?? {}))
  const enabled = new Set<TFeature>()
  for (const feature of nativeAnalysis.featureFlags) {
    if (!validFeatures.size || validFeatures.has(feature as TFeature)) {
      enabled.add(feature as TFeature)
    }
  }
  return {
    featureFlags: enabled,
    hasPlatformApiAccess: nativeAnalysis.hasPlatformApiAccess,
    hasStaticRequireLiteral: nativeAnalysis.hasStaticRequireLiteral,
  }
}

function analyzeScriptWithJs<TFeature extends string = string>(
  code: string,
  options?: ScriptAnalysisOptions<TFeature>,
): ScriptAnalysisResult<TFeature> {
  return {
    featureFlags: options?.featureFlags
      ? jsScriptAnalysisService.collectFeatureFlags(code, options.featureFlags)
      : new Set<TFeature>(),
    hasPlatformApiAccess: jsScriptAnalysisService.mayContainPlatformApiAccess(code, {
      engine: options?.engine,
      parserLike: options?.parserLike,
    }),
    hasStaticRequireLiteral: jsScriptAnalysisService.mayContainStaticRequireLiteral(code, {
      engine: options?.engine,
      parserLike: options?.parserLike,
    }),
  }
}

/**
 * 同一份脚本只尝试一次 native；失败后显式选择完整的 JS fallback 服务。
 */
export function analyzeScript<TFeature extends string = string>(
  code: string,
  options?: ScriptAnalysisOptions<TFeature>,
): ScriptAnalysisResult<TFeature> {
  if (shouldUseNativeAst()) {
    try {
      const nativeAnalysis = analyzeScriptWithNative(code, {
        hookToFeature: options?.featureFlags?.hookToFeature,
        moduleId: options?.featureFlags?.moduleId,
      })
      if (nativeAnalysis) {
        return normalizeNativeAnalysis(nativeAnalysis, options?.featureFlags)
      }
    }
    catch {
      // native 失败只选择一次 JS 服务，不重新进入单文件或叶子 native。
    }
  }
  return analyzeScriptWithJs(code, options)
}

/**
 * 批次只跨 native 边界一次，失败项各自执行一次完整 JS fallback。
 */
export function analyzeScripts<TFeature extends string = string>(
  inputs: ScriptAnalysisBatchInput<TFeature>[],
  options?: ScriptAnalysisOptions<TFeature>,
): Array<ScriptAnalysisResult<TFeature>> {
  let nativeResults: ReturnType<typeof analyzeScriptsWithNative>
  if (shouldUseNativeAst() && inputs.length > 0) {
    try {
      nativeResults = analyzeScriptsWithNative(inputs.map(input => ({
        code: input.code,
        filename: input.filename,
        hookToFeature: input.featureFlags?.hookToFeature ?? options?.featureFlags?.hookToFeature,
        moduleId: input.featureFlags?.moduleId ?? options?.featureFlags?.moduleId,
      })))
    }
    catch {
      // 批次失败后逐项选择纯 JS 服务，不调用公开 analyzeScript 重试。
    }
  }

  return inputs.map((input, index) => {
    const featureFlags = input.featureFlags ?? options?.featureFlags
    const nativeAnalysis = nativeResults?.[index]
    if (nativeAnalysis) {
      try {
        return normalizeNativeAnalysis(nativeAnalysis, featureFlags)
      }
      catch {
        // 可选摘要消费失败只回退当前项，不重复已完成的邻项。
      }
    }
    // JS 调用在 native catch 之外；JS 自身失败不被捕获后重复执行。
    return analyzeScriptWithJs(input.code, { ...options, featureFlags })
  })
}
