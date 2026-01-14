import type { Program } from '@swc/types'
import type { BindingInfo, ScopeAnalysisResult } from './types'
import { parseSync } from '@swc/core'
import { ScopeCollector } from './collector'

/**
 * 分析代码的作用域
 *
 * @param code - 源代码
 * @returns 作用域分析结果
 *
 * @example
 * ```ts
 * const result = analyzeScope(`
 *   import { foo } from 'bar'
 *   function example() {
 *     return foo  // foo 是外部引用
 *   }
 * `)
 *
 * console.log(result.externalRefs.get('foo'))
 * // { name: 'foo', kind: 'import', isExternal: true, ... }
 * ```
 */
export function analyzeScope(code: string): ScopeAnalysisResult {
  const collector = new ScopeCollector()

  const ast = parseSync(code, {
    syntax: 'typescript',
    target: 'es2020',
  })

  if (!ast) {
    return {
      externalRefs: new Map(),
      localBindings: new Map(),
      imports: new Map(),
    }
  }

  // 执行遍历 - SWC 需要调用 visitProgram
  const program = ast as unknown as Program
  collector.visitProgram(program)

  return collector.getResults()
}

/**
 * 查找变量定义来源
 *
 * 这个函数展示了如何在 SWC 中实现和 Babel 的 path.scope.getBinding()
 * 相同的功能。
 */
export function resolveBinding(
  code: string,
  identifierName: string,
): BindingInfo | null {
  const result = analyzeScope(code)

  // 先查本地绑定
  if (result.localBindings.has(identifierName)) {
    return result.localBindings.get(identifierName)!
  }

  // 再查外部引用
  if (result.externalRefs.has(identifierName)) {
    return result.externalRefs.get(identifierName)!
  }

  return null
}
