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
})
