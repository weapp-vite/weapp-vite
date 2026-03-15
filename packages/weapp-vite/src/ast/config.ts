import type { WeappViteConfig } from '../types'
import type { AstEngineName } from './types'

/**
 * 解析 AST 引擎配置。
 */
export function resolveAstEngine(config?: Pick<WeappViteConfig, 'ast'>): AstEngineName {
  return config?.ast?.engine ?? 'babel'
}
