// @vitest-environment happy-dom

import type { ComponentPublicInstance } from '../src/runtime/component'
import type { TemplateRenderer } from '../src/runtime/template'
import { transformSync } from 'esbuild'
import { html } from 'lit'
import { repeat } from 'lit/directives/repeat.js'
import { afterEach, describe, expect, it } from 'vitest'
import { compileWxml } from '../src/compiler/wxml'
import { RUNTIME_ID } from '../src/plugin/constants'
import { defineComponent } from '../src/runtime/component'
import { registerControlledAttributeCommit } from '../src/runtime/controlledAttributes'
import { bindRuntimeDataset } from '../src/runtime/datasetBinding'
import { bindRuntimeEvent } from '../src/runtime/eventBinding'
import { createTemplate } from '../src/runtime/template'

class ControlledScrollView extends HTMLElement {
  static observedAttributes = ['refresher-triggered']
  commits: unknown[] = []
  release?: () => void

  connectedCallback() {
    this.release = registerControlledAttributeCommit(this, 'refresher-triggered', value => this.commits.push(value))
  }

  disconnectedCallback() {
    this.release?.()
  }
}

customElements.define('weapp-scroll-view', ControlledScrollView)
let sequence = 0

function compile(source: string): TemplateRenderer {
  const result = compileWxml({ id: '/controlled.wxml', source, resolveTemplatePath: () => undefined, resolveWxsPath: () => undefined })
  const module = { exports: {} as { render: TemplateRenderer } }
  const imports: Record<string, unknown> = {
    'lit': { html },
    'lit/directives/repeat.js': { repeat },
    [RUNTIME_ID]: { bindRuntimeEvent, bindRuntimeDataset },
  }
  // eslint-disable-next-line no-new-func -- 运行真实模板编译产物验证显式数据提交契约。
  new Function('require', 'module', 'exports', transformSync(result.code, { format: 'cjs' }).code)(
    (id: string) => imports[id],
    module,
    module.exports,
  )
  return module.exports.render
}

async function mount(mode: 'compiled' | 'legacy', source: string, data: Record<string, unknown>) {
  const tag = `controlled-owner-${++sequence}`
  defineComponent(tag, { template: mode === 'compiled' ? compile(source) : createTemplate(source), component: { data } })
  const owner = document.createElement(tag) as ComponentPublicInstance & { updateComplete: Promise<boolean> }
  document.body.append(owner)
  await owner.updateComplete
  return owner
}

afterEach(() => document.body.replaceChildren())

describe.each(['compiled', 'legacy'] as const)('%s controlled attributes', (mode) => {
  it('delivers an explicit equal false commit while excluding unrelated and sibling patches', async () => {
    const owner = await mount(mode, '<scroll-view refresher-triggered="{{state.triggered}}" />', {
      state: { triggered: false, sibling: 0 },
      noise: 0,
    })
    const target = owner.shadowRoot!.querySelector('weapp-scroll-view') as ControlledScrollView
    expect(target.getAttribute('refresher-triggered')).toBe('false')
    owner.setData({ noise: 1 })
    await owner.updateComplete
    owner.setData({ 'state.sibling': 1 })
    await owner.updateComplete
    expect(target.commits).toEqual([])
    owner.setData({ 'state.triggered': false })
    await owner.updateComplete
    expect(target.commits).toEqual([false])
    expect(owner.shadowRoot!.querySelector('weapp-scroll-view')).toBe(target)
    owner.setData({ state: { triggered: false, sibling: 2 } })
    await owner.updateComplete
    expect(target.commits).toEqual([false, false])
  })

  it('tracks computed keys and expression inputs without treating every render as a commit', async () => {
    const owner = await mount(mode, '<scroll-view refresher-triggered="{{states[active].triggered || forced}}" />', {
      states: [{ triggered: false }, { triggered: false }],
      active: 0,
      forced: false,
      noise: 0,
    })
    const target = owner.shadowRoot!.querySelector('weapp-scroll-view') as ControlledScrollView
    owner.setData({ 'states[1].triggered': false, 'noise': 1 })
    await owner.updateComplete
    expect(target.commits).toEqual([])
    owner.setData({ 'states[0].triggered': false })
    await owner.updateComplete
    owner.setData({ forced: false })
    await owner.updateComplete
    expect(target.commits).toEqual([false, false])
  })

  it('reflects changed values on the same node and commits equal values before the setData callback', async () => {
    const owner = await mount(mode, '<scroll-view refresher-triggered="{{triggered}}" />', { triggered: false })
    const target = owner.shadowRoot!.querySelector('weapp-scroll-view') as ControlledScrollView
    owner.setData({ triggered: true })
    await owner.updateComplete
    expect(owner.shadowRoot!.querySelector('weapp-scroll-view')).toBe(target)
    expect(target.getAttribute('refresher-triggered')).toBe('true')
    expect(target.commits).toEqual([])
    let committed: unknown[] | undefined
    owner.setData({ triggered: true }, () => {
      committed = [...target.commits]
    })
    await owner.updateComplete
    await Promise.resolve()
    expect(committed).toEqual([true])
    owner.setData({ triggered: false })
    await owner.updateComplete
    expect(owner.shadowRoot!.querySelector('weapp-scroll-view')).toBe(target)
    expect(target.getAttribute('refresher-triggered')).toBe('false')
    expect(target.commits).toEqual([true])
  })

  it('resolves object aliases in loops and releases bindings when their owner disconnects', async () => {
    const owner = await mount(mode, '<scroll-view wx:for="{{items}}" refresher-triggered="{{item.triggered}}" />', {
      items: [{ triggered: false }],
      noise: 0,
    })
    const target = owner.shadowRoot!.querySelector('weapp-scroll-view') as ControlledScrollView
    owner.setData({ 'items[0].triggered': false })
    await owner.updateComplete
    expect(target.commits).toEqual([false])
    owner.remove()
    owner.setData({ 'items[0].triggered': false })
    expect(target.commits).toEqual([false])
    document.body.append(owner)
    await owner.updateComplete
    const current = owner.shadowRoot!.querySelector('weapp-scroll-view') as ControlledScrollView
    owner.setData({ 'items[0].triggered': false })
    await owner.updateComplete
    expect(current.commits).toEqual([false, false])
  })

  it.each([
    { values: [false, false], first: 'values[0]', second: 'values[1]' },
    { values: { first: false, second: false }, first: 'values.first', second: 'values.second' },
  ])('tracks primitive loop aliases without matching unrelated identical values: $first', async ({ values, first, second }) => {
    const owner = await mount(mode, '<scroll-view wx:for="{{values}}" refresher-triggered="{{item}}" />', { values, unrelated: false })
    const targets = [...owner.shadowRoot!.querySelectorAll('weapp-scroll-view')] as ControlledScrollView[]
    owner.setData({ unrelated: false, [second]: false })
    await owner.updateComplete
    expect(targets[0]?.commits).toEqual([])
    expect(targets[1]?.commits).toEqual([false])
    owner.setData({ [first]: false })
    await owner.updateComplete
    expect(targets[0]?.commits).toEqual([false])
  })
})

it('propagates primitive template aliases through nested scopes and object spreads', async () => {
  const owner = await mount('compiled', `
    <template name="inner"><scroll-view refresher-triggered="{{active}}" /></template>
    <template name="outer"><template is="inner" data="{{active: renamed, noise: noise}}" /></template>
    <template is="outer" data="{{...state, renamed: triggered}}" />
  `, { state: { noise: false }, triggered: false, unrelated: false })
  const target = owner.shadowRoot!.querySelector('weapp-scroll-view') as ControlledScrollView
  owner.setData({ 'state.noise': false, 'unrelated': false })
  await owner.updateComplete
  expect(target.commits).toEqual([])
  owner.setData({ triggered: false })
  await owner.updateComplete
  expect(target.commits).toEqual([false])
})

it('propagates primitive values selected from template data objects', async () => {
  const owner = await mount('compiled', `
    <template name="inner"><scroll-view refresher-triggered="{{triggered}}" /></template>
    <template is="inner" data="{{state}}" />
  `, { state: { triggered: false, noise: false }, triggered: false })
  const target = owner.shadowRoot!.querySelector('weapp-scroll-view') as ControlledScrollView
  owner.setData({ 'state.noise': false, 'triggered': false })
  await owner.updateComplete
  expect(target.commits).toEqual([])
  owner.setData({ 'state.triggered': false })
  await owner.updateComplete
  expect(target.commits).toEqual([false])
})

it('retains per-property sources for nested constructed template objects', async () => {
  const owner = await mount('compiled', `
    <template name="inner"><scroll-view refresher-triggered="{{box.active}}" /></template>
    <template is="inner" data="{{box: {active: triggered, noise: noise} }}" />
  `, { triggered: false, noise: false })
  const target = owner.shadowRoot!.querySelector('weapp-scroll-view') as ControlledScrollView
  owner.setData({ noise: false })
  await owner.updateComplete
  expect(target.commits).toEqual([])
  owner.setData({ triggered: false })
  await owner.updateComplete
  expect(target.commits).toEqual([false])
})

it('tracks only the selected template data branch and updates its source after a branch change', async () => {
  const owner = await mount('compiled', `
    <template name="inner"><scroll-view refresher-triggered="{{active}}" /></template>
    <template is="inner" data="{{choose ? {active: left, noise: noise} : {active: right, noise: noise} }}" />
  `, { choose: true, left: false, right: false, noise: false })
  const target = owner.shadowRoot!.querySelector('weapp-scroll-view') as ControlledScrollView
  owner.setData({ noise: false, right: false })
  await owner.updateComplete
  expect(target.commits).toEqual([])
  owner.setData({ left: false })
  await owner.updateComplete
  expect(target.commits).toEqual([false])
  owner.setData({ choose: false })
  await owner.updateComplete
  expect(target.commits).toEqual([false, false])
  owner.setData({ left: false })
  await owner.updateComplete
  expect(target.commits).toEqual([false, false])
  owner.setData({ right: false })
  await owner.updateComplete
  expect(target.commits).toEqual([false, false, false])
})
