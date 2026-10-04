import type { ElementNode, TemplateChildNode } from '@vue/compiler-core'
import type { TemplateCompileOptions, TemplateCompileResult } from './template'
import { runInNewContext } from 'node:vm'
import { baseParse, NodeTypes } from '@vue/compiler-core'
import { WEVU_NATIVE_DECLARATION_ADDRESS_PROP, WEVU_NATIVE_DECLARATION_EVENT, WEVU_NATIVE_DECLARATION_METHOD, WEVU_NATIVE_SLOT_PARENT_DATASET_ATTR, WEVU_SLOT_PROPS_DATA_KEY } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { computed, unref } from '../../../../../wevu/src/reactivity'
import { normalizeClass, normalizeStyle, resolvePropValue } from '../../../../../wevu/src/runtime/template'
import { buildClassStyleComputedCode } from '../transform/classStyleComputed'
import { compileVueTemplateToWxml, getMiniProgramTemplatePlatform } from './template'

interface RenderedElement {
  tag: string
  attrs: Record<string, any>
  text: string
}

function compile(source: string, options?: TemplateCompileOptions) {
  const result = compileVueTemplateToWxml(source, 'native-declaration.vue', {
    platform: getMiniProgramTemplatePlatform('weapp'),
    scopedSlotsRequireProps: true,
    wevuComponentTags: ['Provider', 'Inner', 'Leaf'],
    ...options,
  })
  expect(result.diagnostics).toEqual([])
  return result
}

function attributes(node: ElementNode) {
  return Object.fromEntries(node.props.map((prop) => {
    if (prop.type !== NodeTypes.ATTRIBUTE) {
      throw new Error('Expected native attributes in emitted template')
    }
    return [prop.name, prop.value?.content ?? '']
  }))
}

// 执行真实生成的计算属性与原生属性表达式；不模拟组件生命周期或 provides。
function evaluate(result: TemplateCompileResult, state: Record<string, unknown>): RenderedElement[] {
  const runtimeContext = { ...state, $state: state, __wevuProps: {} }
  const code = buildClassStyleComputedCode(result.classStyleBindings ?? [], {
    unrefName: '__wevuUnref',
    normalizeClassName: '__wevuNormalizeClass',
    normalizeStyleName: '__wevuNormalizeStyle',
  })
  const getters = code
    ? runInNewContext(`(${code})`, {
      __wevuUnref: unref,
      __wevuResolvePropValue: resolvePropValue,
      __wevuNormalizeClass: normalizeClass,
      __wevuNormalizeStyle: normalizeStyle,
      console,
    }) as Record<string, (this: object) => unknown>
    : {}
  for (const [name, getter] of Object.entries(getters)) {
    const value = computed(() => getter.call(runtimeContext))
    Object.defineProperty(runtimeContext, name, { enumerable: true, get: () => value.value })
  }
  const rootScope = { ...runtimeContext }
  const rendered: RenderedElement[] = []
  const valueOf = (value: string, scope: Record<string, unknown>) => {
    const match = /^\{\{([\s\S]*)\}\}$/.exec(value)
    return match ? runInNewContext(`(${match[1]})`, scope) : value
  }
  const visit = (nodes: TemplateChildNode[], scope: Record<string, unknown>) => {
    let branchTaken = false
    for (const node of nodes) {
      if (node.type !== NodeTypes.ELEMENT) {
        continue
      }
      const attrs = attributes(node)
      const instances: Record<string, unknown>[] = []
      if (attrs['wx:for']) {
        const list = valueOf(attrs['wx:for'], scope) as unknown[] | Record<string, unknown>
        for (const [coordinate, item] of Object.entries(list)) {
          instances.push({
            ...scope,
            [attrs['wx:for-item'] || 'item']: item,
            [attrs['wx:for-index'] || 'index']: Array.isArray(list) ? Number(coordinate) : coordinate,
          })
        }
      }
      else {
        instances.push(scope)
      }
      for (const instance of instances) {
        if ('wx:if' in attrs) {
          branchTaken = Boolean(valueOf(attrs['wx:if'], instance))
          if (!branchTaken) {
            continue
          }
        }
        else if ('wx:elif' in attrs || 'wx:else' in attrs) {
          if (branchTaken || ('wx:elif' in attrs && !valueOf(attrs['wx:elif'], instance))) {
            continue
          }
          branchTaken = true
        }
        else {
          branchTaken = false
        }
        const values = Object.fromEntries(Object.entries(attrs).map(([key, value]) => [key, valueOf(value, instance)]))
        const text = node.children.map((child) => {
          if (child.type === NodeTypes.TEXT) {
            return child.content
          }
          if (child.type === NodeTypes.INTERPOLATION && child.content.type === NodeTypes.SIMPLE_EXPRESSION) {
            return String(valueOf(`{{${child.content.content}}}`, instance))
          }
          return ''
        }).join('')
        rendered.push({ tag: node.tag, attrs: values, text })
        visit(node.children, instance)
      }
    }
  }
  visit(baseParse(result.code).children, rootScope)
  return rendered
}

function declarations(elements: RenderedElement[]) {
  return elements.filter(element => WEVU_NATIVE_DECLARATION_ADDRESS_PROP in element.attrs)
}

function address(element: RenderedElement): readonly [string, string] {
  return element.attrs[WEVU_NATIVE_DECLARATION_ADDRESS_PROP]
}

function byLabel(elements: RenderedElement[]) {
  const result: Record<string, readonly [string, string]> = {}
  for (const element of declarations(elements)) {
    result[element.attrs.label] = address(element)
  }
  return result
}

describe('native declaration occurrence identity', () => {
  it.each(['field', 'complex'] as const)('keeps shadowed keyed loops isolated and stable on moves: %s', (keyKind) => {
    const key = keyKind === 'field' ? 'item.id' : 'keyOf(item)'
    const result = compile(`<Provider v-for="(item, i) in groups" :key="${key}" :label="item.label">
      <Inner v-for="(item, i) in item.rows" :key="${key}" :label="item.label" :position="i">
        <Leaf :label="item.label + '-leaf'" /><slot />
      </Inner>
    </Provider>`)
    const groups = [
      { id: 'a/:', label: 'a', rows: [{ id: 'x', label: 'a-x' }, { id: 'y', label: 'a-y' }] },
      { id: 'b', label: 'b', rows: [{ id: 'x', label: 'b-x' }, { id: 'y', label: 'b-y' }] },
    ]
    let keyCalls = 0
    const keyOf = (item: { id: string }) => {
      keyCalls += 1
      return item.id
    }
    const beforeElements = evaluate(result, { groups, keyOf })
    const before = byLabel(beforeElements)
    expect(new Set(Object.values(before).map(value => value[0])).size).toBe(10)
    expect(before.a[1]).toBe('')
    expect(before.b[1]).toBe('')
    for (const group of groups) {
      for (const row of group.rows) {
        expect(before[row.label][1]).toBe(before[group.label][0])
        expect(before[`${row.label}-leaf`][1]).toBe(before[row.label][0])
      }
    }
    expect(beforeElements.filter(element => element.tag === 'inner').map(element => element.attrs.position)).toEqual([0, 1, 0, 1])
    expect(beforeElements.filter(element => element.tag === 'slot').map(element => element.attrs[WEVU_NATIVE_SLOT_PARENT_DATASET_ATTR]))
      .toEqual(['a-x', 'a-y', 'b-x', 'b-y'].map(label => before[label][0]))
    expect(keyCalls).toBe(keyKind === 'complex' ? 6 : 0)
    keyCalls = 0
    const moved = groups.toReversed().map(group => ({ ...group, rows: group.rows.toReversed() }))
    expect(byLabel(evaluate(result, { groups: moved, keyOf }))).toEqual(before)
    expect(keyCalls).toBe(keyKind === 'complex' ? 6 : 0)
  })

  it('uses tuple boundaries rather than delimiter-concatenated nested keys', () => {
    const result = compile('<Provider v-for="item in groups" :key="item.id"><Leaf v-for="item in item.rows" :key="item.id" :label="item.label" /></Provider>')
    const output = byLabel(evaluate(result, { groups: [
      { id: 'a/b', rows: [{ id: 'c', label: 'first' }] },
      { id: 'a', rows: [{ id: 'b/c', label: 'second' }] },
    ] }))
    expect(output.first[0]).not.toBe(output.second[0])
    expect(output.first[1]).not.toBe(output.second[1])
  })

  it('reads native wx:key fields and native coordinates without cross-wiring shadowed aliases', () => {
    const result = compile(`<Provider wx:for="{{groups}}" wx:key="id" :label="item.label">
      <Inner wx:for="{{item.rows}}" wx:key="id" :label="item.label">
        <Leaf :label="item.label + '-leaf'" />
      </Inner>
    </Provider>`)
    const groups = [
      { id: 'a', label: 'a', rows: [{ id: 'x', label: 'a-x' }] },
      { id: 'b', label: 'b', rows: [{ id: 'x', label: 'b-x' }] },
    ]
    const before = byLabel(evaluate(result, { groups }))
    expect(before['a-x'][1]).toBe(before.a[0])
    expect(before['b-x'][1]).toBe(before.b[0])
    expect(before['a-x-leaf'][1]).toBe(before['a-x'][0])
    expect(before['b-x-leaf'][1]).toBe(before['b-x'][0])
    expect(before['a-x'][0]).not.toBe(before['b-x'][0])
    expect(byLabel(evaluate(result, { groups: groups.toReversed() }))).toEqual(before)
  })

  it.each(['native', 'vue'] as const)('preserves raw attributes throughout renamed %s loop bodies', (kind) => {
    const loop = (source: string) => kind === 'native'
      ? `wx:for="{{${source}}}" wx:key="id"`
      : `v-for="(item, index) in ${source}" :key="item.id + '!'"`
    const result = compile(`<Provider ${loop('groups')} label="{{item.label}}">
      <Inner ${loop('item.rows')} label="{{item.label}}">
        <Leaf wx:if="{{item.enabled}}" label="{{item.label + '-leaf'}}" />
        <native-leaf label="{{item.label}}" id="{{item.id}}" class="{{item.label}}" style="{{item.style}}" bindtap="{{item.handler}}" data-index="{{index}}" />
        <text>{{ item.label }}</text><slot name="{{item.label}}" />
      </Inner>
    </Provider>`)
    const groups = ['a', 'b'].map(id => ({
      id,
      label: id,
      enabled: false,
      rows: ['x', 'y'].map(row => ({
        id: row,
        label: `${id}-${row}`,
        enabled: true,
        style: `color:${row === 'x' ? 'red' : 'blue'}`,
        handler: `tap${row}`,
      })),
    }))
    const elements = evaluate(result, { groups })
    const values = byLabel(elements)
    expect(new Set(Object.values(values).map(value => value[0])).size).toBe(10)
    for (const group of groups) {
      for (const row of group.rows) {
        expect(values[row.label][1]).toBe(values[group.label][0])
        expect(values[`${row.label}-leaf`][1]).toBe(values[row.label][0])
      }
    }
    const nativeLeaves = elements.filter(element => element.tag === 'native-leaf')
    expect(nativeLeaves.map(element => element.attrs)).toEqual(groups.flatMap(group => group.rows.map((row, index) => ({
      'label': row.label,
      'id': row.id,
      'class': row.label,
      'style': row.style,
      'bindtap': row.handler,
      'data-index': index,
    }))))
    expect(elements.filter(element => element.tag === 'text').map(element => element.text)).toEqual(['a-x', 'a-y', 'b-x', 'b-y'])
    expect(elements.filter(element => element.tag === 'slot').map(element => element.attrs.name)).toEqual(['a-x', 'a-y', 'b-x', 'b-y'])
    const moved = groups.toReversed().map(group => ({ ...group, rows: group.rows.toReversed() }))
    expect(byLabel(evaluate(result, { groups: moved }))).toEqual(values)
  })

  it.each([
    { alias: 'JSON', key: 'field' },
    { alias: 'String', key: 'field' },
    { alias: 'JSON', key: 'complex' },
    { alias: 'String', key: 'complex' },
  ])('keeps address intrinsics separate from authored $alias with $key keys', ({ alias, key }) => {
    const keyExp = key === 'field' ? `${alias}.id` : `keyOf(${alias})`
    const result = compile(`<Provider v-for="${alias} in rows" :key="${keyExp}" :label="${alias}.label" :title="((${alias}) => ${alias}.label)(${alias})">
      <Leaf :label="${alias}.label + '-leaf'" />
    </Provider>`)
    const rows = [{ id: 'a', label: 'a' }, { id: 'b', label: 'b' }]
    const keyOf = (row: typeof rows[number]) => row.id
    const elements = evaluate(result, { rows, keyOf })
    const values = byLabel(elements)
    expect(values.a[0]).not.toBe(values.b[0])
    expect(values['a-leaf'][1]).toBe(values.a[0])
    expect(values['b-leaf'][1]).toBe(values.b[0])
    expect(elements.filter(element => element.tag === 'provider').map(element => element.attrs.title)).toEqual(['a', 'b'])
    expect(byLabel(evaluate(result, { rows: rows.toReversed(), keyOf }))).toEqual(values)
  })

  it.each(['native', 'vue'] as const)('keeps %s source aliases outside the inner loop and restores live event objects', (kind) => {
    const outerLoop = kind === 'native'
      ? 'wx:for="{{groups}}" wx:for-item="JSON" wx:for-index="String" wx:key="id"'
      : 'v-for="(JSON, String) in groups" :key="JSON.id"'
    const innerLoop = kind === 'native'
      ? 'v-for="(entry, position) in JSON.rows" :key="entry.id + \'!\'"'
      : 'wx:for="{{JSON.rows}}" wx:for-item="entry" wx:for-index="position" wx:key="id"'
    const result = compile(`<Provider ${outerLoop} :label="JSON.label">
      <Inner ${innerLoop} :label="entry.label" @tap="select(entry, JSON, String, position)">
        <Leaf label="{{entry.label + '-leaf'}}" />
      </Inner>
    </Provider>`)
    const groups = ['a', 'b'].map(id => ({
      id,
      label: id,
      rows: ['x', 'y'].map(row => ({ id: row, label: `${id}-${row}` })),
    }))
    const asset = result.inlineExpressions![0]
    const before = byLabel(evaluate(result, { groups }))
    for (const orderedGroups of [groups, groups.toReversed().map(group => ({ ...group, rows: group.rows.toReversed() }))]) {
      const state = { groups: orderedGroups }
      const elements = evaluate(result, state)
      expect(byLabel(elements)).toEqual(before)
      const inner = elements.find(element => element.tag === 'inner' && element.attrs.label === 'b-y')!
      const scope = Object.fromEntries(asset.scopeKeys.map((key, index) => [key, inner.attrs[`data-wv-s${index}`]]))
      const indexes = Object.fromEntries(asset.indexBindings!.map((binding, index) => [binding.key, inner.attrs[`data-wv-i${index}`]]))
      for (const resolver of asset.scopeResolvers!) {
        scope[resolver.key] = runInNewContext(`(${resolver.expression})`)(state, indexes)
      }
      const selected: unknown[] = []
      const { context, scope: scopeName, event } = asset.parameterNames
      runInNewContext(`((${context},${scopeName},${event}) => ${asset.expression})`)({ select: (...args: unknown[]) => selected.push(...args) }, scope, {})
      const groupIndex = orderedGroups.findIndex(group => group.id === 'b')
      const group = orderedGroups[groupIndex]
      const rowIndex = group.rows.findIndex(row => row.id === 'y')
      expect(selected).toEqual([group.rows[rowIndex], group, groupIndex, rowIndex])
      expect(selected[0]).toBe(group.rows[rowIndex])
      expect(selected[1]).toBe(group)
      expect(before['b-y'][1]).toBe(before.b[0])
      expect(before['b-y-leaf'][1]).toBe(before['b-y'][0])
    }
  })

  it.each(['array', 'object'] as const)('uses native coordinates for unkeyed %s loops', (kind) => {
    const result = compile('<Provider v-for="(item, i) in items" :label="item.label"><Leaf :label="item.label + \'-leaf\'" /></Provider>')
    const first = { label: 'first' }
    const second = { label: 'second' }
    const before = byLabel(evaluate(result, { items: kind === 'array' ? [first, second] : { a: first, b: second } }))
    const after = byLabel(evaluate(result, { items: kind === 'array' ? [second, first] : { a: second, b: first } }))
    expect(after.first[0]).toBe(before.second[0])
    expect(after.second[0]).toBe(before.first[0])
    expect(after['first-leaf'][1]).toBe(after.first[0])
    expect(after['second-leaf'][1]).toBe(after.second[0])
  })

  it('keeps static source sites through conditional clones and does not instrument native third parties', () => {
    const result = compile('<Provider label="host"><Leaf v-if="show" label="first" /><Leaf v-else label="second" /><native-leaf /><slot /></Provider>')
    const first = evaluate(result, { show: true })
    const second = evaluate(result, { show: false })
    const original = byLabel(first)
    const replacement = byLabel(second)
    expect(original.first[0]).not.toBe(replacement.second[0])
    expect(original.first[1]).toBe(original.host[0])
    expect(replacement.second[1]).toBe(original.host[0])
    expect(byLabel(evaluate(result, { show: true }))).toEqual(original)
    expect(result.classStyleBindings).toBeUndefined()
    expect(first.find(element => element.tag === 'native-leaf')?.attrs[WEVU_NATIVE_DECLARATION_ADDRESS_PROP]).toBeUndefined()
    for (const element of declarations(first)) {
      expect(element.attrs[`bind:${WEVU_NATIVE_DECLARATION_EVENT}`]).toBe(WEVU_NATIVE_DECLARATION_METHOD)
    }
  })

  it('retains a loop declared on a conditional clone', () => {
    const result = compile('<Leaf v-if="show" v-for="item in items" :key="item.id" :label="item.id" />')
    const items = [{ id: 'a' }, { id: 'b' }]
    expect(declarations(evaluate(result, { show: false, items }))).toEqual([])
    const visible = byLabel(evaluate(result, { show: true, items }))
    expect(visible.a[0]).not.toBe(visible.b[0])
    expect(byLabel(evaluate(result, { show: true, items: items.toReversed() }))).toEqual(visible)
  })

  it('resets declaration ownership when extracting a scoped template from shadowed loops', () => {
    const result = compile(`<Provider v-for="(item, i) in groups" :key="item.id">
      <Inner v-for="(item, i) in item.rows" :key="item.id" v-slot="{ value }">
        <Leaf label="scoped" /><slot /><text>{{ value }}</text>
      </Inner>
    </Provider>`)
    const asset = result.scopedSlotComponents?.[0]
    if (!asset) {
      throw new Error('Expected an extracted scoped template')
    }
    const elements = evaluate({ ...result, code: asset.template, classStyleBindings: undefined }, {
      [WEVU_SLOT_PROPS_DATA_KEY]: { value: 'scoped-value' },
    })
    expect(address(declarations(elements)[0])[1]).toBe('')
    expect(elements.find(element => element.tag === 'slot')?.attrs[WEVU_NATIVE_SLOT_PARENT_DATASET_ATTR]).toBe('')
    expect(elements.find(element => element.tag === 'text')?.text).toBe('scoped-value')
    const transportOutputs = new Set(result.classStyleBindings?.map(binding => binding.name))
    for (const binding of asset.bindingManifest.bindings) {
      for (const dependency of binding.dependencies ?? []) {
        expect(transportOutputs.has(dependency.path?.split('.')[1] ?? '')).toBe(false)
      }
    }
  })

  it.each([
    { scopedSlotsRequireProps: false },
    { platform: getMiniProgramTemplatePlatform('alipay') },
    { platform: { ...getMiniProgramTemplatePlatform('weapp'), nativeSlotContext: false } },
  ])('leaves other compilation modes outside the native declaration protocol: %j', (options) => {
    const result = compile('<Provider><Leaf /></Provider>', options)
    const host = baseParse(result.code).children.find((node): node is ElementNode => node.type === NodeTypes.ELEMENT)!
    expect(attributes(host)[WEVU_NATIVE_DECLARATION_ADDRESS_PROP]).toBeUndefined()
  })

  it('uses primitive native self keys and preserves the native index-named key field', () => {
    const primitives = compile('<Leaf v-for="item in items" :key="item" :label="item" />')
    const before = byLabel(evaluate(primitives, { items: ['a/b', 'a', 2] }))
    expect(byLabel(evaluate(primitives, { items: [2, 'a', 'a/b'] }))).toEqual(before)
    const fields = compile('<Leaf v-for="(item, i) in items" :key="i" :label="item.label" />')
    const items = [{ i: 'first-key', label: 'first' }, { i: 'second-key', label: 'second' }]
    const original = byLabel(evaluate(fields, { items }))
    expect(byLabel(evaluate(fields, { items: items.toReversed() }))).toEqual(original)
  })

  it('preserves all ancestor indexes through three projected shadowed loop levels', () => {
    const result = compile(`<Provider v-for="(item, i) in groups" :key="item.id + '!'" :label="item.id">
      <Inner v-for="(item, i) in item.rows" :key="item.id + '!'" :label="item.label">
        <Leaf v-for="(item, i) in item.rows" :key="item.id + '!'" :label="item.label" />
      </Inner>
    </Provider>`)
    const groups = ['a', 'b'].map(id => ({ id, rows: ['x', 'y'].map(row => ({
      id: row,
      label: `${id}-${row}`,
      rows: [{ id: 'z', label: `${id}-${row}-z` }],
    })) }))
    const before = byLabel(evaluate(result, { groups }))
    expect(before['b-y-z'][1]).toBe(before['b-y'][0])
    expect(before['b-y'][1]).toBe(before.b[0])
    expect(before['a-x-z'][0]).not.toBe(before['b-x-z'][0])
    expect(byLabel(evaluate(result, { groups: groups.toReversed().map(group => ({ ...group, rows: group.rows.toReversed() })) }))).toEqual(before)
  })

  it.each(['item.id', 'item.id + \'!\''])('preserves inline event values and live scope resolution with key %s', (key) => {
    const result = compile(`<Provider v-for="(item, i) in groups" :key="${key}"><Leaf v-for="(item, i) in item.rows" :key="${key}" @tap="select(item, i)" /></Provider>`)
    const row = { id: 'selected' }
    const state = { groups: [{ id: 'a', rows: [{ id: 'first' }, row] }] }
    const leaf = declarations(evaluate(result, state)).at(-1)!
    const asset = result.inlineExpressions![0]
    const scope = Object.fromEntries(asset.scopeKeys.map((key, index) => [key, leaf.attrs[`data-wv-s${index}`]]))
    const indexes = Object.fromEntries(asset.indexBindings!.map((binding, index) => [binding.key, leaf.attrs[`data-wv-i${index}`]]))
    for (const resolver of asset.scopeResolvers!) {
      scope[resolver.key] = runInNewContext(`(${resolver.expression})`)(state, indexes)
    }
    const selected: unknown[] = []
    const { context, scope: scopeName, event } = asset.parameterNames
    runInNewContext(`((${context},${scopeName},${event}) => ${asset.expression})`)({ select: (...args: unknown[]) => selected.push(...args) }, scope, {})
    expect(selected).toEqual([row, 1])
    expect(selected[0]).toBe(row)
  })
})
