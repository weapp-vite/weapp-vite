/**
 * AST 引擎名称。
 */
export type AstEngineName = 'babel' | 'oxc'

/**
 * AST 相关配置。
 */
export interface WeappAstConfig {
  /**
   * AST 引擎。
   * - `babel`: 默认兼容模式
   * - `oxc`: 优先使用 Oxc 做解析/分析
   */
  engine?: AstEngineName
}

/**
 * 兼容 Rolldown/Vite `this.parse` 形状的解析器。
 */
export interface AstParserLike {
  parse?: (input: string, options?: unknown) => unknown
}
