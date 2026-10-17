import type { Scope } from '@weapp-vite/ast/babelTraverse'
import type { Node } from '@weapp-vite/ast/babelTypes'
import type { Value } from './values'
import * as t from '@weapp-vite/ast/babelTypes'
import { describe, expect, it } from 'vitest'
import { prepareScriptScopes } from './scopes'
import { analyzeScript } from './script'

function sharedDag(depth: number) {
  return ['const a0 = { value: 0 }', ...Array.from({ length: depth }, (_, index) => `const a${index + 1} = { left: a${index}, right: a${index} }`)].join(';\n')
}

describe('native context shared data proof work', () => {
  it.each([10, 30, 60])('bounds repeated object proofs at DAG depth %s by distinct AST provenance', (depth) => {
    const { values, scriptScope } = prepareScriptScopes(sharedDag(depth), false, undefined, undefined, () => undefined)
    let resolutions = 0
    // 对真实 AST 的值解析计数；共享 resolve 身份不会改变生产证明的来源或作用域。
    const countedResolve = (node: Node, scope: Scope): Value | undefined => {
      resolutions++
      const value = values.resolve(node, scope)
      return value?.kind === 'local' ? { ...value, resolve: countedResolve } : value
    }
    const root = countedResolve(t.identifier(`a${depth}`), scriptScope)
    expect(values.safeData(root)).toBe(true)
    expect(resolutions).toBeLessThanOrEqual(3 * depth + 4)
  })

  it.each([30, 60])('classifies a real %s-level shared DAG without unfolding its paths', async (depth) => {
    const source = `import { ref } from 'wevu'; export default { setup() { ${sharedDag(depth)}; ref(a${depth}); return {} } }`
    expect((await analyzeScript(source, true)).required).toBe(false)
  })
})
