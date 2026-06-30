import type { AstEngineName, AstParserLike } from '../types'
import type { FeatureFlagOptions } from './featureFlags'
import { analyzeScriptWithNative, shouldUseNativeAst } from '../native'
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
        const validFeatures = new Set(Object.values(options?.featureFlags?.hookToFeature ?? {}))
        const featureFlags = new Set<TFeature>()
        for (const feature of nativeAnalysis.featureFlags) {
          if (!validFeatures.size || validFeatures.has(feature as TFeature)) {
            featureFlags.add(feature as TFeature)
          }
        }
        return {
          featureFlags,
          hasPlatformApiAccess: nativeAnalysis.hasPlatformApiAccess,
          hasStaticRequireLiteral: nativeAnalysis.hasStaticRequireLiteral,
        }
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
