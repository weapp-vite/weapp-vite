/**
 * SWC 作用域插件测试
 *
 * 测试递归向上寻址功能
 */

import { describe, expect, it } from 'vitest'
import { analyzeScope, resolveBinding, ScopeManager } from './swcScopePlugin'

describe('SWC Scope Plugin - ScopeManager', () => {
  describe('resolve', () => {
    it('should resolve binding from current scope', () => {
      const manager = new ScopeManager()

      manager.declare('foo', 'const')

      const binding = manager.resolve('foo')
      expect(binding).toEqual({
        name: 'foo',
        kind: 'const',
        scopeType: 'module',
        level: 0,
        isExternal: false,
      })
    })

    it('should recursively search parent scopes', () => {
      const manager = new ScopeManager()

      // 在模块作用域声明
      manager.declare('outer', 'const')

      // 进入函数作用域
      manager.pushScope('function')

      // 在函数作用域声明
      manager.declare('inner', 'let')

      // 从函数作用域查找 outer（应该在父作用域找到）
      const outerBinding = manager.resolve('outer')
      expect(outerBinding).toEqual({
        name: 'outer',
        kind: 'const',
        scopeType: 'module',
        level: 0,
        isExternal: true, // 因为是从函数作用域查找
      })

      // 从函数作用域查找 inner（应该在当前作用域找到）
      const innerBinding = manager.resolve('inner')
      expect(innerBinding).toEqual({
        name: 'inner',
        kind: 'let',
        scopeType: 'function',
        level: 1,
        isExternal: false,
      })
    })

    it('should handle deep scope nesting', () => {
      const manager = new ScopeManager()

      manager.declare('level0', 'const')
      manager.pushScope('function')
      manager.declare('level1', 'let')
      manager.pushScope('block')
      manager.declare('level2', 'var')
      manager.pushScope('function')
      manager.declare('level3', 'const')

      // 从最内层作用域查找所有变量
      expect(manager.resolve('level3')?.isExternal).toBe(false)
      expect(manager.resolve('level2')?.isExternal).toBe(true)
      expect(manager.resolve('level1')?.isExternal).toBe(true)
      expect(manager.resolve('level0')?.isExternal).toBe(true)
    })

    it('should return null for undefined bindings', () => {
      const manager = new ScopeManager()
      expect(manager.resolve('undefined')).toBeNull()
    })

    it('should handle shadowing', () => {
      const manager = new ScopeManager()

      manager.declare('x', 'const')
      manager.pushScope('function')
      manager.declare('x', 'let')

      // 从内层作用域查找 x（应该找到内层的 x）
      const binding = manager.resolve('x')
      expect(binding).toEqual({
        name: 'x',
        kind: 'let',
        scopeType: 'function',
        level: 1,
        isExternal: false,
      })
    })
  })

  describe('hasBinding', () => {
    it('should return true for existing bindings', () => {
      const manager = new ScopeManager()
      manager.declare('foo', 'const')
      expect(manager.hasBinding('foo')).toBe(true)
    })

    it('should return false for non-existing bindings', () => {
      const manager = new ScopeManager()
      expect(manager.hasBinding('foo')).toBe(false)
    })

    it('should check parent scopes', () => {
      const manager = new ScopeManager()
      manager.declare('foo', 'const')
      manager.pushScope('function')
      expect(manager.hasBinding('foo')).toBe(true)
    })
  })

  describe('pushScope/popScope', () => {
    it('should maintain correct scope levels', () => {
      const manager = new ScopeManager()
      expect(manager.currentLevel).toBe(0)

      manager.pushScope('function')
      expect(manager.currentLevel).toBe(1)
      expect(manager.currentScopeType).toBe('function')

      manager.pushScope('block')
      expect(manager.currentLevel).toBe(2)
      expect(manager.currentScopeType).toBe('block')

      manager.popScope()
      expect(manager.currentLevel).toBe(1)
      expect(manager.currentScopeType).toBe('function')

      manager.popScope()
      expect(manager.currentLevel).toBe(0)
      expect(manager.currentScopeType).toBe('module')
    })

    it('should not pop root scope', () => {
      const manager = new ScopeManager()
      manager.pushScope('function')
      manager.popScope()
      expect(manager.currentLevel).toBe(0)

      // 再次 pop 不应该出错
      manager.popScope()
      expect(manager.currentLevel).toBe(0)
    })
  })
})

describe('SWC Scope Plugin - analyzeScope', () => {
  it('should detect external references in function', () => {
    const code = `
      import { foo } from 'external'
      const globalVar = 'hello'

      function example(param: string) {
        const localVar = 'world'
        return param + localVar + globalVar + foo
      }
    `

    const result = analyzeScope(code)

    // 检查导入
    expect(result.imports.get('foo')).toBe('external')

    // 检查外部引用
    const fooRef = result.externalRefs.get('foo')
    expect(fooRef?.kind).toBe('import')
    expect(fooRef?.isExternal).toBe(true)

    const globalVarRef = result.externalRefs.get('globalVar')
    expect(globalVarRef?.kind).toBe('const')
    expect(globalVarRef?.isExternal).toBe(true)
  })

  it('should handle nested functions', () => {
    const code = `
      const a = 1

      function outer() {
        const b = 2

        function inner() {
          const c = 3
          return a + b + c
        }

        return inner()
      }
    `

    const result = analyzeScope(code)

    // 在 inner 函数中，a 和 b 都是外部引用
    const aRef = result.externalRefs.get('a')
    expect(aRef).toBeDefined()
    expect(aRef?.isExternal).toBe(true)
    expect(aRef?.scopeType).toBe('module')

    const bRef = result.externalRefs.get('b')
    expect(bRef).toBeDefined()
    expect(bRef?.isExternal).toBe(true)
    expect(bRef?.scopeType).toBe('function')
  })

  it('should handle shadowing', () => {
    const code = `
      const x = 'outer'

      function example() {
        const x = 'inner'
        return x
      }
    `

    const result = analyzeScope(code)

    // 函数内的 x 引用应该指向内层声明，不是外部引用
    // 所以 externalRefs 中不应该有 x
    expect(result.externalRefs.has('x')).toBe(false)
  })

  it('should detect closure variables', () => {
    const code = `
      function createCounter() {
        let count = 0

        return function() {
          count++
          return count
        }
      }
    `

    const result = analyzeScope(code)

    // count 是外部引用（闭包）
    const countRef = result.externalRefs.get('count')
    expect(countRef).toBeDefined()
    expect(countRef?.isExternal).toBe(true)
    expect(countRef?.kind).toBe('let')
  })

  it('should handle arrow functions', () => {
    const code = `
      const multiplier = 2

      const multiply = (x: number) => x * multiplier
    `

    const result = analyzeScope(code)

    const multiplierRef = result.externalRefs.get('multiplier')
    expect(multiplierRef).toBeDefined()
    expect(multiplierRef?.kind).toBe('const')
  })

  it('should handle block scopes', () => {
    const code = `
      let x = 1

      {
        let y = 2
        console.log(x + y)
      }
    `

    const result = analyzeScope(code)

    const xRef = result.externalRefs.get('x')
    expect(xRef).toBeDefined()
    expect(xRef?.isExternal).toBe(true)
  })

  it('should handle function parameters', () => {
    const code = `
      function outer(x: number) {
        return function inner() {
          return x + 1
        }
      }
    `

    const result = analyzeScope(code)

    const xRef = result.externalRefs.get('x')
    expect(xRef).toBeDefined()
    expect(xRef?.kind).toBe('param')
  })

  it('should handle catch clause scopes', () => {
    const code = `
      try {
        throw new Error('测试')
      } catch (err) {
        console.log(err)
      }
    `

    const result = analyzeScope(code)

    // err 应该在 catch 作用域中被声明
    const errBinding = result.localBindings.get('err')
    expect(errBinding).toBeDefined()
    expect(errBinding?.scopeType).toBe('catch')
  })

  it('should track all imports', () => {
    const code = `
      import { foo, bar } from './module'
      import baz from 'baz-module'
      import * as ns from 'namespace'
    `

    const result = analyzeScope(code)

    expect(result.imports.get('foo')).toBe('./module')
    expect(result.imports.get('bar')).toBe('./module')
    expect(result.imports.get('baz')).toBe('baz-module')
    expect(result.imports.get('ns')).toBe('namespace')
  })

  it('should handle destructuring patterns', () => {
    const code = `
      const { a, b } = obj
      const [c, d] = arr
      function foo({ x, y: z }: any) {
        return x + z
      }
    `

    const result = analyzeScope(code)

    // 检查解构的变量都被正确声明
    expect(result.localBindings.has('a')).toBe(true)
    expect(result.localBindings.has('b')).toBe(true)
    expect(result.localBindings.has('c')).toBe(true)
    expect(result.localBindings.has('d')).toBe(true)
    expect(result.localBindings.has('x')).toBe(true)
    expect(result.localBindings.has('z')).toBe(true)
  })

  it('should handle rest parameters', () => {
    const code = `
      function foo(...args: string[]) {
        return args
      }
    `

    const result = analyzeScope(code)

    expect(result.localBindings.has('args')).toBe(true)
    expect(result.localBindings.get('args')?.kind).toBe('param')
  })

  it('should handle nested object destructuring', () => {
    const code = `
      const { a: { b, c }, d } = obj
    `

    const result = analyzeScope(code)

    expect(result.localBindings.has('b')).toBe(true)
    expect(result.localBindings.has('c')).toBe(true)
    expect(result.localBindings.has('d')).toBe(true)
  })
})

describe('SWC Scope Plugin - resolveBinding', () => {
  it('should resolve binding from code', () => {
    const code = `
      const foo = 'bar'
      function example() {
        return foo
      }
    `

    const binding = resolveBinding(code, 'foo')
    expect(binding).toBeDefined()
    expect(binding?.name).toBe('foo')
    expect(binding?.kind).toBe('const')
  })

  it('should return null for undefined binding', () => {
    const code = `const foo = 'bar'`
    const binding = resolveBinding(code, 'undefined')
    expect(binding).toBeNull()
  })
})
