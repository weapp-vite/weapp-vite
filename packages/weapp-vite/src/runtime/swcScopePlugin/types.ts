/**
 * 绑定类型
 */
export type BindingKind = 'var' | 'let' | 'const' | 'param' | 'import' | 'function'

/**
 * 作用域类型
 */
export type ScopeType = 'module' | 'function' | 'block' | 'catch'

/**
 * 变量绑定信息
 */
export interface BindingInfo {
  /** 变量名 */
  name: string
  /** 绑定类型 */
  kind: BindingKind
  /** 作用域类型 */
  scopeType: ScopeType
  /** 作用域层级（0 = 全局/模块） */
  level: number
  /** 是否来自外部作用域 */
  isExternal: boolean
}

/**
 * 作用域分析结果
 */
export interface ScopeAnalysisResult {
  /** 所有外部引用 */
  externalRefs: Map<string, BindingInfo>
  /** 所有本地绑定 */
  localBindings: Map<string, BindingInfo>
  /** 所有导入 */
  imports: Map<string, string> // 本地名 -> 来源
}
