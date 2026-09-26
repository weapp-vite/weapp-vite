import type { WevuBindingManifestV1 } from '../../../../../types/bindingManifest'
import type { InlineExpressionAsset, TransformContext } from '../types'
import { runInNewContext } from 'node:vm'
import * as t from '@weapp-vite/ast/babelTypes'
import { describe, expect, it } from 'vitest'
import { generate, parse, traverse } from '../../../../../utils/babel'
import { injectInlineExpressions } from '../../../transform/transformScript/rewrite/inlineExpressions'
import { compileVueTemplateToWxml } from '../../template'
import { buildScopedSlotComponentScript } from '../scopedSlotScript'
import { buildForItemResolverExpression } from './forItemResolver'
import { registerInlineExpression } from './inline'

interface EvaluatedInlineEntry {
  fn: (
    context: Record<string, unknown>,
    scope: Record<string, unknown>,
    event?: Record<string, unknown>,
  ) => unknown
  scopeResolvers?: Array<(
    context: Record<string, unknown>,
    scope: Record<string, unknown>,
    event: Record<string, unknown>,
  ) => unknown>
}

function getStaticKey(node: t.Expression | t.PrivateName) {
  if (t.isIdentifier(node)) {
    return node.name
  }
  return t.isStringLiteral(node) ? node.value : null
}

function extractInlineMap(source: string, entryId: string) {
  const ast = parse(source, { sourceType: 'module', plugins: ['typescript'] })
  let inlineMap: t.ObjectExpression | undefined
  traverse(ast, {
    ObjectExpression(path) {
      if (path.node.properties.some(property => (
        t.isObjectProperty(property)
        && getStaticKey(property.key) === entryId
        && t.isObjectExpression(property.value)
      ))) {
        inlineMap = path.node
        path.stop()
      }
    },
  })
  if (!inlineMap) {
    throw new Error(`未找到内联表达式 ${entryId}。`)
  }
  const code = generate(inlineMap, { compact: true }).code
  return runInNewContext(`(${code})`) as unknown as Record<string, EvaluatedInlineEntry>
}

function compileInlineAsset(template: string) {
  const compiled = compileVueTemplateToWxml(template, 'src/pages/issue-1009/index.vue')
  expect(compiled.diagnostics).toEqual([])
  const asset = compiled.inlineExpressions?.at(-1)
  if (!asset) {
    throw new Error('未生成内联表达式资源。')
  }
  return { asset, compiled }
}

function emitComponentEntry(asset: InlineExpressionAsset) {
  const component = t.objectExpression([])
  expect(injectInlineExpressions(component, [asset])).toBe(true)
  const source = generate(component).code
  return extractInlineMap(`(${source})`, asset.id)[asset.id]
}

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
      'src/pages/issue-1012/index.vue',
    )
    const asset = compiled.inlineExpressions?.[0]

    expect(compiled.diagnostics).toEqual([])
    if (!asset) {
      throw new Error('未生成 this 所有权内联表达式资源。')
    }

    const context = {
      Base: class { value = 14 },
      componentMethod() {
        return this.value
      },
      methodKey: 'read',
      value: 99,
    }
    const observed = emitComponentEntry(asset).fn(context, {})

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
  registerInlineExpression(expression, compilerContext)
  const asset = inlineExpressions[0]
  if (!asset) {
    throw new Error('未生成解构赋值内联表达式资源。')
  }
  return emitComponentEntry(asset).fn(ctx, scope)
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

  it('writes component refs and template locals outside callback parameter scopes', () => {
    const ctx = {
      count: { value: 1 },
      total: 2,
      next: { count: 7, source: 8 },
    }
    const scope = { total: 0 }

    const result = runInlineExpression(
      '((ctx, scope) => (({ count, source: total } = next), [ctx, scope]))(11, 12)',
      {
        count: 'setup-ref',
        total: 'setup-let',
        next: 'setup-const',
      },
      ctx,
      scope,
      ['total'],
    )

    expect(result).toEqual([11, 12])
    expect(ctx.count.value).toBe(7)
    expect(ctx.total).toBe(2)
    expect(scope.total).toBe(8)
  })

  it('preserves computed-key, default and rest evaluation order', () => {
    const order: string[] = []
    // 避开旧版 V8 在普通对象 rest 解构中重复读取已排除 getter 的行为。
    const next = Object.create(null) as Record<string, unknown>
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

function emitScopedSlotEntry(asset: InlineExpressionAsset, bindingManifest: WevuBindingManifestV1) {
  const source = buildScopedSlotComponentScript({
    bindingManifest,
    classStyleBindings: [],
    inlineExpressions: [asset],
    layoutHosts: [],
    runtimeBindingManifest: 'diagnostic',
    templateRefs: [],
  })
  return extractInlineMap(source, asset.id)[asset.id]
}

function expectResolverResult(
  template: string,
  context: Record<string, unknown>,
) {
  const { asset } = compileInlineAsset(template)
  const entry = emitComponentEntry(asset)
  const resolver = entry.scopeResolvers?.[0]
  expect(resolver).toBeTypeOf('function')
  expect(resolver?.(context, { __wv_i0: 0, __wv_i1: 0 }, { type: 'tap' })).toMatchObject({ name: 'I' })
}

describe('inline expression identifier hygiene', () => {
  it('keeps generated context references outside callback parameter scopes in both emitters', () => {
    const { asset, compiled } = compileInlineAsset(
      '<view @tap="rows.map(ctx => prefix + ctx.name)" />',
    )
    const context = { prefix: 'P', rows: [{ name: 'A' }] }

    expect(emitComponentEntry(asset).fn(context, {}, { type: 'tap' })).toEqual(['PA'])
    expect(emitScopedSlotEntry(asset, compiled.bindingManifest).fn(context, {}, { type: 'tap' })).toEqual(['PA'])
  })

  it('keeps direct and destructuring event writes on the handler parameter', () => {
    const { asset, compiled } = compileInlineAsset(
      '<view @tap="[$event = nextEvent, ({ value: $event } = payload), (($event) => ($event = nextEvent))($event), $event]" />',
    )
    const nextEvent = { type: 'next' }
    const finalEvent = { type: 'final' }
    const payload = { value: finalEvent }
    const context = { nextEvent, payload, $event: { type: 'component' } }

    for (const entry of [
      emitComponentEntry(asset),
      emitScopedSlotEntry(asset, compiled.bindingManifest),
    ]) {
      expect(entry.fn(context, {}, { type: 'tap' })).toEqual([
        nextEvent,
        payload,
        nextEvent,
        finalEvent,
      ])
      expect(context.$event).toEqual({ type: 'component' })
    }
  })

  it('keeps loop scope references outside callback parameter scopes', () => {
    const { asset } = compileInlineAsset(
      '<view v-for="item in items" :key="item.name" @tap="rows.map(scope => item.name + scope.name)" />',
    )

    expect(emitComponentEntry(asset).fn(
      { items: [{ name: 'I' }], rows: [{ name: 'A' }] },
      { item: { name: 'I' }, __wv_i0: 0 },
      { type: 'tap' },
    )).toEqual(['IA'])
  })

  it('preserves component ctx and scope bindings, nested callbacks, event access, and a no-conflict control', () => {
    const cases = [
      {
        template: '<view @tap="ctx + scope" />',
        context: { ctx: 'C', scope: 'S' },
        expected: 'CS',
      },
      {
        template: '<view @tap="rows.map(ctx => rows.map(scope => prefix + ctx.name + scope.name).join(\'\')).join(\'\')" />',
        context: { prefix: 'P', rows: [{ name: 'A' }] },
        expected: 'PAA',
      },
      {
        template: '<view @tap="rows.map(_ctx => rows.map(_scope => prefix + _ctx.name + _scope.name).join(\'\')).join(\'\')" />',
        context: { prefix: 'P', rows: [{ name: 'A' }] },
        expected: 'PAA',
      },
      {
        template: '<view @tap="rows.map(_event => prefix + _event.name + \'-\' + $event.type).join(\'\')" />',
        context: { prefix: 'P', rows: [{ name: 'A' }] },
        expected: 'PA-tap',
      },
      {
        template: '<view @tap="rows.map(row => prefix + row.name).join(\'\')" />',
        context: { prefix: 'P', rows: [{ name: 'A' }] },
        expected: 'PA',
      },
    ]

    for (const testCase of cases) {
      const { asset } = compileInlineAsset(testCase.template)
      expect(emitComponentEntry(asset).fn(testCase.context, {}, { type: 'tap' })).toBe(testCase.expected)
    }
  })

  it('keeps component ctx and scope bindings distinct inside nested loop resolvers', () => {
    expectResolverResult(
      '<view v-for="(group, groupIndex) in ctx" :key="groupIndex"><view v-for="(item, itemIndex) in group.entries" :key="itemIndex" @tap="item.name" /></view>',
      { ctx: [{ entries: [{ name: 'I' }] }] },
    )
    expectResolverResult(
      '<view v-for="(group, groupIndex) in scope" :key="groupIndex"><view v-for="(item, itemIndex) in group.entries" :key="itemIndex" @tap="item.name" /></view>',
      { scope: [{ entries: [{ name: 'I' }] }] },
    )
  })
})

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
  const asset = result.inlineExpressions?.[0]
  if (!asset) {
    throw new Error('未生成内联表达式资源。')
  }
  return emitComponentEntry(asset).fn
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
