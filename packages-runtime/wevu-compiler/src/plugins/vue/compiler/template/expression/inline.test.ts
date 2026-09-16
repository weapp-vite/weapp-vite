import type { WevuBindingManifestV1 } from '../../../../../types/bindingManifest'
import type { InlineExpressionAsset } from '../types'
import { runInNewContext } from 'node:vm'
import * as t from '@weapp-vite/ast/babelTypes'
import { describe, expect, it } from 'vitest'
import { generate, parse, traverse } from '../../../../../utils/babel'
import { injectInlineExpressions } from '../../../transform/transformScript/rewrite/inlineExpressions'
import { compileVueTemplateToWxml } from '../../template'
import { buildScopedSlotComponentScript } from '../scopedSlotScript'

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
