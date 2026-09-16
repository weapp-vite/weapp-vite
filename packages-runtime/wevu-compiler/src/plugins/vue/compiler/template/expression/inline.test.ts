import type { TransformContext } from '../types'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { compileVueTemplateToWxml } from '../../template'
import { buildForItemResolverExpression } from './forItemResolver'

describe('template inline expression this ownership', () => {
  it('preserves native dynamic this while rewriting template-owned this', () => {
    const expression = `[
      [1].map(function () { return this.value }, { value: 7 })[0],
      (function () { return this.value }).call({ value: 8 }),
      (function () { return this.value }).apply({ value: 9 }),
      (function () { return this.value }).bind({ value: 10 })(),
      ({ value: 11, read() { return this.value } }).read(),
      new class { value = 12; read() { return this.value } }().read(),
      (function () { return (() => this.value)() }).call({ value: 13 }),
      this.value,
      (() => this.value)(),
      componentMethod(),
      this.componentMethod(),
      new (class extends this.Base {})().value,
      ({ value: 15, [this.methodKey]() { return this.value } })[this.methodKey](),
      new class { value = 16; [this.methodKey]() { return this.value } }()[this.methodKey](),
      new class { value = 17; read = () => this.value }().read(),
    ]`
    const compiled = compileVueTemplateToWxml(
      `<button @tap="${expression}" />`,
      '/project/src/pages/issue-1012/index.vue',
    )
    const inlineExpression = compiled.inlineExpressions?.[0]?.expression

    expect(compiled.diagnostics).toEqual([])
    expect(inlineExpression).toBeTruthy()

    const context = {
      Base: class { value = 14 },
      componentMethod() {
        return this.value
      },
      methodKey: 'read',
      value: 99,
    }
    const observed = runInNewContext(`(${inlineExpression})`, { ctx: context })

    expect(observed).toEqual([7, 8, 9, 10, 11, 12, 13, 99, 99, 99, 99, 14, 15, 16, 17])
  })

  it('keeps dynamic this in loop scope resolvers while lexical arrows inherit ctx', () => {
    // 解析器在此路径只读取 forStack，避免构造与所有权场景无关的完整编译上下文。
    const resolverContext = {
      forStack: [{
        item: 'handler',
        listExp: '[function () { return this }, () => this]',
      }],
    } as unknown as TransformContext
    const resolverSource = buildForItemResolverExpression(
      'handler',
      resolverContext,
      {},
      [{ binding: 'index', key: '__wv_i0' }],
    )

    expect(resolverSource).toBeTruthy()

    const resolver = runInNewContext(`(${resolverSource})`) as (
      ctx: Record<string, unknown>,
      scope: Record<string, number>,
    ) => () => Record<string, number>
    const context = { value: 99 }
    const dynamicHandler = resolver(context, { __wv_i0: 0 })
    const lexicalHandler = resolver(context, { __wv_i0: 1 })

    expect(dynamicHandler.call({ value: 7 }).value).toBe(7)
    expect(lexicalHandler().value).toBe(99)
  })
})

interface InlineContext {
  count: { value: number }
  rows?: number[]
}

function compileInlineHandler(expression: string) {
  const result = compileVueTemplateToWxml(
    `<view @tap="${expression}" />`,
    '/project/src/pages/inline-scope.vue',
    {
      scriptSetupBindings: {
        count: 'setup-ref',
        rows: 'setup-const',
      },
    },
  )

  expect(result.diagnostics).toEqual([])
  expect(result.inlineExpressions).toHaveLength(1)
  const compiledExpression = result.inlineExpressions![0]!.expression
  return runInNewContext(`((ctx, scope, $event) => (${compiledExpression}))`) as (
    ctx: InlineContext,
    scope: Record<string, unknown>,
    event?: unknown,
  ) => unknown
}

describe('inline expression lexical setup binding writes', () => {
  it('keeps a callback parameter write local when it shadows a setup ref', () => {
    const handler = compileInlineHandler('rows.map(count => count++)')
    const context = { count: { value: 1 }, rows: [2] }

    expect(handler(context, {})).toEqual([2])
    expect(context.count.value).toBe(1)
  })

  it('keeps parameter, block, and closure assignments and updates on their lexical bindings', () => {
    const handler = compileInlineHandler(`[
      ((count) => { count = 4; count += 2; return count++ })(1),
      (() => { let count = 3; count = 5; count *= 2; return ++count })(),
      ((count) => () => { count -= 1; return count-- })(4)(),
    ]`)
    const context = { count: { value: 1 } }

    expect(handler(context, {})).toEqual([6, 11, 3])
    expect(context.count.value).toBe(1)
  })

  it('preserves ordinary, compound, and update writes to the genuine setup ref', () => {
    const handler = compileInlineHandler('(count = 2, count += 3, count++, ++count)')
    const context = { count: { value: 1 } }

    expect(handler(context, {})).toBe(7)
    expect(context.count.value).toBe(7)
  })
})
