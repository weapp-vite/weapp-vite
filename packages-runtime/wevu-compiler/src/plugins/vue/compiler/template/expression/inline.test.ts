import type { InlineExpressionAsset, TransformContext } from '../types'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { registerInlineExpression } from './inline'

function runInlineExpression(
  expression: string,
  bindings: Record<string, string>,
  ctx: Record<string, unknown>,
  scope: Record<string, unknown> = {},
  scopeNames: string[] = [],
) {
  const inlineExpressions: InlineExpressionAsset[] = []
  // 此处只构造内联表达式转换所需的最小上下文。
  const compilerContext = {
    diagnostics: [],
    filename: 'src/issue-1010.vue',
    rewriteScopedSlot: false,
    scopeStack: scopeNames.length ? [scopeNames] : [],
    slotPropStack: [],
    forStack: [],
    inlineExpressions,
    inlineExpressionSeed: 0,
    scriptSetupBindings: bindings,
  } as unknown as TransformContext
  const registration = registerInlineExpression(expression, compilerContext)
  expect(registration).not.toBeNull()
  const generated = inlineExpressions[0]?.expression
  expect(generated).toBeTypeOf('string')
  const handler = runInNewContext(`'use strict';((ctx,scope,$event)=>(${generated}))`) as (
    ctx: Record<string, unknown>,
    scope: Record<string, unknown>,
    event: unknown,
  ) => unknown
  return handler(ctx, scope, undefined)
}

describe('inline expression assignment patterns', () => {
  it('writes the reported object shorthand target into component state', () => {
    const ctx = {
      count: 1,
      next: { count: 2 },
    }

    runInlineExpression('({ count } = next)', {
      count: 'setup-let',
      next: 'setup-const',
    }, ctx)

    expect(ctx).toEqual({
      count: 2,
      next: { count: 2 },
    })
  })

  it('writes aliases, defaults, nested targets and object rest without mutating the source', () => {
    const next = {
      count: 2,
      source: 3,
      missing: undefined,
      nested: [4, 5],
      extra: 6,
    }
    const ctx = {
      count: 0,
      aliasCount: 0,
      defaultCount: 0,
      defaultValue: 7,
      nestedCount: 0,
      refCount: { value: 0 },
      rest: {},
      next,
    }

    runInlineExpression(
      '({ count, source: aliasCount, missing: defaultCount = defaultValue, nested: [nestedCount, refCount], ...rest } = next)',
      {
        count: 'setup-let',
        aliasCount: 'setup-let',
        defaultCount: 'setup-let',
        defaultValue: 'setup-const',
        nestedCount: 'setup-let',
        refCount: 'setup-ref',
        rest: 'setup-let',
        next: 'setup-const',
      },
      ctx,
    )

    expect(ctx.count).toBe(2)
    expect(ctx.aliasCount).toBe(3)
    expect(ctx.defaultCount).toBe(7)
    expect(ctx.nestedCount).toBe(4)
    expect(ctx.refCount.value).toBe(5)
    expect(ctx.rest).toEqual({ extra: 6 })
    expect(ctx.next).toBe(next)
    expect(next).toEqual({
      count: 2,
      source: 3,
      missing: undefined,
      nested: [4, 5],
      extra: 6,
    })
  })

  it('writes array defaults and ref rest targets while preserving holes', () => {
    const ctx = {
      count: 0,
      defaultCount: 0,
      defaultValue: 8,
      refCount: { value: 0 },
      restRef: { value: [] },
      next: [2, undefined, 5, 'ignored', 9, 10],
    }

    runInlineExpression('[count, defaultCount = defaultValue, refCount, , ...restRef] = next', {
      count: 'setup-let',
      defaultCount: 'setup-let',
      defaultValue: 'setup-const',
      refCount: 'setup-ref',
      restRef: 'setup-ref',
      next: 'setup-const',
    }, ctx)

    expect(ctx.count).toBe(2)
    expect(ctx.defaultCount).toBe(8)
    expect(ctx.refCount.value).toBe(5)
    expect(ctx.restRef.value).toEqual([9, 10])
  })

  it('writes template-scope targets without leaking into component state', () => {
    const ctx = {
      count: 1,
      next: { count: 2 },
    }
    const scope = { count: 0 }

    runInlineExpression(
      '({ count } = next)',
      {
        count: 'setup-let',
        next: 'setup-const',
      },
      ctx,
      scope,
      ['count'],
    )

    expect(scope.count).toBe(2)
    expect(ctx.count).toBe(1)
  })

  it('keeps assignment-pattern targets bound to lexical shadows', () => {
    const ctx = {
      count: 1,
      next: { count: 2 },
    }

    const result = runInlineExpression(
      '((count) => (({ count } = next), count))(0)',
      {
        count: 'setup-let',
        next: 'setup-const',
      },
      ctx,
    )

    expect(result).toBe(2)
    expect(ctx.count).toBe(1)
  })

  it('preserves computed-key, default and rest evaluation order', () => {
    const order: string[] = []
    const next = {}
    Object.defineProperties(next, {
      target: {
        enumerable: true,
        get() {
          order.push('source')
          return undefined
        },
      },
      extra: {
        enumerable: true,
        get() {
          order.push('rest')
          return 9
        },
      },
    })
    const ctx = {
      count: 0,
      rest: {},
      next,
      readKey() {
        order.push('key')
        return 'target'
      },
      readDefault() {
        order.push('default')
        return 7
      },
    }

    runInlineExpression('({ [readKey()]: count = readDefault(), ...rest } = next)', {
      count: 'setup-let',
      rest: 'setup-let',
      next: 'setup-const',
      readKey: 'setup-const',
      readDefault: 'setup-const',
    }, ctx)

    expect(ctx.count).toBe(7)
    expect(ctx.rest).toEqual({ extra: 9 })
    expect(ctx.next).toBe(next)
    expect(order).toEqual(['key', 'source', 'default', 'rest'])
  })

  it('keeps direct setup let and ref writes unchanged', () => {
    const ctx = {
      count: 1,
      refCount: { value: 1 },
    }

    runInlineExpression('count = count + 1', { count: 'setup-let' }, ctx)
    runInlineExpression('refCount += 1', { refCount: 'setup-ref' }, ctx)

    expect(ctx.count).toBe(2)
    expect(ctx.refCount.value).toBe(2)
  })
})
