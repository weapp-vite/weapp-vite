import { describe, expect, it } from 'vitest'
import { registerInlineExpression } from './inline'
import { normalizeJsExpressionWithContext } from './js'
import { generateExpression } from './parse'

function createContext() {
  return {
    warnings: [] as string[],
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
})
