import type { Program } from '@oxc-project/types'
import type { AstEngineName, AstParserLike } from '../../types'
import type { FeatureFlagOptions } from '../featureFlags'
import { parseJsLikeWithEngine } from '../../engine'
import { collectFeatureFlagsWithBabel, collectFeatureFlagsWithOxc, mayContainFeatureFlagHints } from '../featureFlags'
import { hasPlatformApiMemberExpression, mayContainPlatformApiIdentifierByText } from '../platformApi'
import { hasStaticRequireCall, mayContainRequireCallByText } from '../require'

interface JsScriptFactOptions {
  engine?: AstEngineName
  parserLike?: AstParserLike
}

/** 复用既有 JS collector 的预筛选和失败语义，不尝试 native。 */
function collectFeatureFlagsWithJs<TFeature extends string>(
  code: string,
  options: FeatureFlagOptions<TFeature>,
): Set<TFeature> {
  if (!mayContainFeatureFlagHints(code, options.moduleId, options.hookToFeature)) {
    return new Set<TFeature>()
  }
  try {
    return options.astEngine === 'oxc'
      ? collectFeatureFlagsWithOxc(code, options.moduleId, options.hookToFeature)
      : collectFeatureFlagsWithBabel(code, options.moduleId, options.hookToFeature)
  }
  catch {
    return new Set<TFeature>()
  }
}

/** 复用既有文本与 AST predicate，保留默认保守结果和 parserLike。 */
function mayContainScriptFactWithJs(
  code: string,
  options: JsScriptFactOptions | undefined,
  mayContainByText: (code: string) => boolean,
  inspectAst: (ast: Program) => boolean,
): boolean {
  const engine = options?.engine ?? 'babel'
  if (engine !== 'oxc') {
    return true
  }
  if (!mayContainByText(code)) {
    return false
  }
  try {
    const ast = parseJsLikeWithEngine(code, {
      engine,
      filename: 'inline.ts',
      parserLike: options?.parserLike,
    }) as Program
    return inspectAst(ast)
  }
  catch {
    return true
  }
}

/** 完整 fallback 的内部服务；该模块不属于 package entry。 */
export const jsScriptAnalysisService = {
  collectFeatureFlags: collectFeatureFlagsWithJs,
  mayContainPlatformApiAccess(code: string, options?: JsScriptFactOptions) {
    return mayContainScriptFactWithJs(code, options, mayContainPlatformApiIdentifierByText, hasPlatformApiMemberExpression)
  },
  mayContainStaticRequireLiteral(code: string, options?: JsScriptFactOptions) {
    return mayContainScriptFactWithJs(code, options, mayContainRequireCallByText, hasStaticRequireCall)
  },
}
