import type { AstEngineName } from '@weapp-vite/ast'
import type { WeappViteConfig } from '../types'

export { collectComponentPropsFromCode } from './operations/componentProps'
export type { ComponentPropMap } from './operations/componentProps'
export { collectOnPageScrollPerformanceWarnings } from './operations/onPageScroll'
export { mayContainPlatformApiAccess, platformApiIdentifiers } from './operations/platformApi'
export { collectRequireTokens, mayContainStaticRequireLiteral } from './operations/require'
export type { RequireToken } from './operations/require'
export { collectScriptSetupImportsFromCode } from './operations/scriptSetupImports'
export type { ScriptSetupImport } from './operations/scriptSetupImports'
export { collectSetDataPickKeysFromTemplateCode } from './operations/setDataPick'
export { babelAstEngine, oxcAstEngine } from '@weapp-vite/ast'
export { parseJsLikeWithEngine } from '@weapp-vite/ast'
export type { AstEngineName, AstParserLike, WeappAstConfig } from '@weapp-vite/ast'

/**
 * 解析 AST 引擎配置。
 */
export function resolveAstEngine(config?: Pick<WeappViteConfig, 'ast'>): AstEngineName {
  return config?.ast?.engine ?? 'babel'
}
