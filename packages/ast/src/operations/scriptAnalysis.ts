import type { AstEngineName, AstParserLike } from '../types'
import type { FeatureFlagOptions } from './featureFlags'
import { analyzeScriptsWithNative, analyzeScriptWithNative, shouldUseNativeAst } from '../native'
import { collectFeatureFlagsFromCode } from './featureFlags'
import { mayContainPlatformApiAccess } from './platformApi'
import { mayContainStaticRequireLiteral } from './require'

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

/**
 * 对同一份脚本做批量 AST 预分析，避免多个轻量检查重复 parse 或跨 native 边界。
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
      // native AST 是可选批处理快速路径，失败时回退原有解析。
    }
  }

  return {
    featureFlags: options?.featureFlags
      ? collectFeatureFlagsFromCode(code, options.featureFlags)
      : new Set<TFeature>(),
    hasPlatformApiAccess: mayContainPlatformApiAccess(code, {
      engine: options?.engine,
      parserLike: options?.parserLike,
    }),
    hasStaticRequireLiteral: mayContainStaticRequireLiteral(code, {
      engine: options?.engine,
      parserLike: options?.parserLike,
    }),
  }
}

/**
 * 对多份脚本做批量 native 预分析，减少 JS 与 Rust 的往返次数。
 */
export function analyzeScripts<TFeature extends string = string>(
  inputs: ScriptAnalysisBatchInput<TFeature>[],
  options?: ScriptAnalysisOptions<TFeature>,
): Array<ScriptAnalysisResult<TFeature>> {
  if (shouldUseNativeAst() && inputs.length > 0) {
    try {
      const nativeResults = analyzeScriptsWithNative(inputs.map(input => ({
        code: input.code,
        filename: input.filename,
        hookToFeature: input.featureFlags?.hookToFeature ?? options?.featureFlags?.hookToFeature,
        moduleId: input.featureFlags?.moduleId ?? options?.featureFlags?.moduleId,
      })))
      if (nativeResults?.length === inputs.length) {
        return nativeResults.map((nativeAnalysis, index) => {
          return normalizeNativeAnalysis(
            nativeAnalysis,
            inputs[index]?.featureFlags ?? options?.featureFlags,
          )
        })
      }
    }
    catch {
      // native AST 是可选批处理快速路径，失败时逐项回退原有解析。
    }
  }

  return inputs.map(input => analyzeScript(input.code, {
    ...options,
    featureFlags: input.featureFlags ?? options?.featureFlags,
  }))
}
