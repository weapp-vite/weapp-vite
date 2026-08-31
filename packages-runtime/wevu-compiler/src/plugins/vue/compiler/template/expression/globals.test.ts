import { describe, expect, it } from 'vitest'
import { registerInlineExpression } from './inline'
import { normalizeJsExpressionWithContext } from './js'
import { generateExpression } from './parse'
import { shouldFallbackToRuntimeBinding } from './runtimeBinding'
import { normalizeWxmlExpressionWithContext } from './scopedSlot'

function createContext() {
  return {
    diagnostics: [],
    filename: '/project/src/globals.vue',
    rewriteScopedSlot: false,
    scopeStack: [],
    slotPropStack: [],
    forStack: [],
    inlineExpressions: [],
    inlineExpressionSeed: 0,
  } as any
}

describe('template expression globals', () => {
  it('keeps supported mini-program runtime globals in js expressions', () => {
    const context = createContext()
    const result = normalizeJsExpressionWithContext('tt.getStorageSync("demo") + my.getSystemInfoSync().brand', context)

    expect(result && generateExpression(result)).toBe('tt.getStorageSync("demo")+my.getSystemInfoSync().brand')
  })

  it('keeps supported mini-program runtime globals in inline expressions', () => {
    const context = createContext()
    const result = registerInlineExpression('swan.getEnv() && xhs.getStorageSync("demo")', context)

    expect(result).toEqual({
      id: 'i0',
      scopeBindings: [],
      indexBindings: [],
    })
    expect(context.inlineExpressions).toEqual([
      {
        id: 'i0',
        expression: 'swan.getEnv()&&xhs.getStorageSync("demo")',
        scopeKeys: [],
      },
    ])
  })

  it('registers slot function invocations as inline expressions', () => {
    const context = createContext()
    const result = registerInlineExpression('(() => toggleModal(\'confirm\'))(...$event)', context)

    expect(result).toEqual({
      id: 'i0',
      scopeBindings: [],
      indexBindings: [],
    })
    expect(context.inlineExpressions).toEqual([
      {
        id: 'i0',
        expression: '(()=>ctx.toggleModal(\'confirm\'))(...$event)',
        scopeKeys: [],
      },
    ])
  })

  it('does not preserve wechat-centric pseudo globals in inline expressions', () => {
    const context = createContext()
    const result = registerInlineExpression('MiniProgramNative.foo + WechatMiniprogram.bar + count', context)

    expect(result).toEqual({
      id: 'i0',
      scopeBindings: [],
      indexBindings: [],
    })
    expect(context.inlineExpressions).toEqual([
      {
        id: 'i0',
        expression: 'ctx.MiniProgramNative.foo+ctx.WechatMiniprogram.bar+ctx.count',
        scopeKeys: [],
      },
    ])
  })

  it('prefers props data over state data in template expressions', () => {
    const context = createContext()
    const result = normalizeJsExpressionWithContext('data.userId + data.profile.name', context)
    const code = result && generateExpression(result)

    expect(code).toContain('__wevuUnref(')
    expect(code).toContain('this.__wevuProps.data')
    expect(code).toContain('this.data')
  })

  it('prefers props data over state data for direct data access', () => {
    const context = createContext()
    const result = normalizeJsExpressionWithContext('data', context)
    const code = result && generateExpression(result)

    expect(code).toContain('__wevuUnref(')
    expect(code).toContain('this.__wevuProps.data')
    expect(code).toContain('this.data')
  })

  it('prefers props over same-named native instance fields when state does not own the key', () => {
    const context = createContext()
    const result = normalizeJsExpressionWithContext('options', context)
    const code = result && generateExpression(result)

    expect(code).toContain('this.__wevuProps.options')
    expect(code).not.toContain('"options" in this')
    expect(code).toContain('this.$state')
    expect(code).toContain('Object.prototype.hasOwnProperty.call(this.$state,\'options\')')
  })

  it('reads props-derived keys directly from props', () => {
    const context = {
      ...createContext(),
      propsDerivedKeys: ['options'],
    }
    const result = normalizeJsExpressionWithContext('options', context)
    const code = result && generateExpression(result)

    expect(code).toContain('this.__wevuProps.options')
    expect(code).not.toContain('this.$state')
  })

  it('unrefs nested member results for runtime binding expressions', () => {
    const context = createContext()
    const result = normalizeJsExpressionWithContext('JSON.stringify(query.data, null, 2)', context, {
      runtimePropAccess: 'helper',
      unrefMemberAccess: true,
    })
    const code = result && generateExpression(result)

    expect(code).toContain('JSON.stringify(')
    expect(code).toContain('__wevuUnref(__wevuUnref(__wevuResolvePropValue(this,\'query\',this.query)).data)')
  })

  it('uses runtime bindings for operators unsupported by WXML', () => {
    expect(shouldFallbackToRuntimeBinding('typeof content === \'object\'')).toBe(true)
    expect(shouldFallbackToRuntimeBinding('content === \'text\'')).toBe(false)
  })

  it('keeps BigInt operations in JS runtime bindings', () => {
    expect(shouldFallbackToRuntimeBinding('5n / 2n')).toBe(true)
    expect(shouldFallbackToRuntimeBinding('1_000_000_000_000_000_000_000n')).toBe(false)
  })

  it('only preserves configured direct template calls', () => {
    const safeCalls = new Set(['t'])

    expect(shouldFallbackToRuntimeBinding('t(\'common.title\')', safeCalls)).toBe(false)
    expect(shouldFallbackToRuntimeBinding('other(\'common.title\')', safeCalls)).toBe(true)
    expect(shouldFallbackToRuntimeBinding('t(other())', safeCalls)).toBe(true)
    expect(shouldFallbackToRuntimeBinding('messages?.t(\'common.title\')', safeCalls)).toBe(true)
  })

  it('preserves vue slot metadata in scoped-slot expressions', () => {
    const context = createContext()
    context.rewriteScopedSlot = true
    expect(normalizeWxmlExpressionWithContext('$slots.content', context)).toBe('vueSlots&&vueSlots.content')
  })
})
