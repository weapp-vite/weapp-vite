/**
 * SWC 自定义插件：作用域分析与递归向上寻址
 *
 * 这个模块提供了一个完整的 SWC 插件实现，展示如何在 SWC 中实现
 * 与 Babel 类似的作用域查找功能。
 *
 * 核心能力：递归向上寻址（Recursive Scope Upward Lookup）
 * - 从当前作用域开始
 * - 逐层向上遍历父作用域
 * - 直到找到目标绑定或到达全局作用域
 *
 * ============================================================================
 * Babel 与 SWC 对照
 * ============================================================================
 *
 * Babel：
 * ```ts
 * import traverse from '@babel/traverse'
 *
 * traverse(ast, {
 *   Identifier(path) {
 *     const binding = path.scope.getBinding(path.node.name)
 *     // binding.kind、binding.scope 等
 *   }
 * })
 * ```
 *
 * SWC：
 * ```ts
 * import Visitor from '@swc/core/Visitor'
 *
 * class MyVisitor extends Visitor {
 *   visitIdentifier(node: Identifier): Identifier {
 *     const binding = this.scopeManager.resolve(node.value)
 *     // ...
 *     return super.visitIdentifier(node)
 *   }
 * }
 * ```
 */

export { analyzeScope, resolveBinding } from './analyze'
export { ScopeManager } from './scopeManager'
export type {
  BindingInfo,
  BindingKind,
  ScopeAnalysisResult,
  ScopeType,
} from './types'
export { parseSync } from '@swc/core'
export { default as Visitor } from '@swc/core/Visitor'
