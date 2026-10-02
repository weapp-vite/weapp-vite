// @vitest-environment happy-dom

import type { ComponentPublicInstance, DefineComponentOptions } from '../src/runtime/component'
import type { TemplateRenderer } from '../src/runtime/template'
import { transformSync } from 'esbuild'
import { html } from 'lit'
import { repeat } from 'lit/directives/repeat.js'
import { afterEach, describe, expect, it } from 'vitest'
import { compileWxml } from '../src/compiler/wxml'
import { RUNTIME_ID } from '../src/plugin/constants'
import { bindRuntimeEvent, createTemplate, ensureNativeComponentsDefined } from '../src/runtime'
import { defineComponent } from '../src/runtime/component'
import { dispatchMiniProgramEvent } from '../src/runtime/nativeComponents/helpers'

type TestElement = ComponentPublicInstance & { updateComplete: Promise<boolean> }
type TemplateMode = 'compiled' | 'legacy'
let sequence = 0

function template(source: string, mode: TemplateMode, components: Record<string, string> = {}): TemplateRenderer {
  if (mode === 'legacy') {
    return createTemplate(source)
  }
  const { code } = compileWxml({
    id: '/event-channel.wxml',
    source,
    componentTags: components,
    resolveTemplatePath: () => undefined,
    resolveWxsPath: () => undefined,
  })
  const module = { exports: {} as { render: TemplateRenderer } }
  const imports: Record<string, unknown> = {
    'lit': { html },
    'lit/directives/repeat.js': { repeat },
    [RUNTIME_ID]: { bindRuntimeEvent },
  }
  // eslint-disable-next-line no-new-func -- 在 DOM 环境中执行真实编译产物，断言消费行为而非生成源码。
  new Function('require', 'module', 'exports', transformSync(code, { format: 'cjs' }).code)(
    (id: string) => imports[id],
    module,
    module.exports,
  )
  return module.exports.render
}

function register(options: DefineComponentOptions) {
  const tag = `event-channel-${++sequence}`
  defineComponent(tag, options)
  return tag
}

async function mount(tag: string) {
  const element = document.createElement(tag) as TestElement
  document.body.append(element)
  await element.updateComplete
  return element
}

afterEach(() => document.body.replaceChildren())

describe.each<TemplateMode>(['compiled', 'legacy'])('%s component event channels', (mode) => {
  it('separates component click, native tap and native synthetic input on the same host', async () => {
    const calls: Array<[string, unknown]> = []
    const childTag = register({
      template: template('<button bindtap="activate">emit</button><textarea />', mode),
      component: { methods: { activate() { this.triggerEvent('click') } } },
    })
    const parentTag = register({
      template: template(`<${childTag} bind:click="click" bindtap="tap" bindinput="input" />`, mode, { [childTag]: childTag }),
      component: {
        methods: {
          click(event) { calls.push(['click', event.detail]) },
          tap(event) { calls.push(['tap', event.type]) },
          input(event) { calls.push(['input', event.detail]) },
        },
      },
    })
    const parent = await mount(parentTag)
    const child = parent.shadowRoot!.querySelector(childTag) as TestElement
    await child.updateComplete
    child.shadowRoot!.querySelector('weapp-button')!.dispatchEvent(new Event('click', { bubbles: true, composed: true }))
    expect(calls).toEqual([['click', undefined], ['tap', 'tap']])

    child.triggerEvent('tap', { source: 'component' })
    expect(calls).toEqual([['click', undefined], ['tap', 'tap'], ['tap', 'tap']])

    const input = child.shadowRoot!.querySelector('weapp-textarea')!
    input.addEventListener('input', () => child.triggerEvent('input', { value: 'component-value' }))
    dispatchMiniProgramEvent(input, 'input', { value: 'native-value' })
    expect(calls.at(-1)).toEqual(['input', { value: 'component-value' }])
    expect(calls.filter(([name]) => name === 'input')).toHaveLength(1)
  })

  it('does not let filtered catch or capture bindings stop native gestures', async () => {
    const calls: string[] = []
    const childTag = register({
      template: template('<button bindtap="activate">emit</button>', mode),
      component: { methods: { activate() { this.triggerEvent('click') } } },
    })
    const parentTag = register({
      template: template(`<view bindtap="ancestor"><${childTag} capture-catch:click="component" bindtap="gesture" /></view>`, mode, { [childTag]: childTag }),
      component: {
        methods: {
          component() { calls.push('component') },
          gesture() { calls.push('gesture') },
          ancestor() { calls.push('ancestor') },
        },
      },
    })
    const parent = await mount(parentTag)
    const child = parent.shadowRoot!.querySelector(childTag) as TestElement
    await child.updateComplete
    child.shadowRoot!.querySelector('weapp-button')!.dispatchEvent(new Event('click', { bubbles: true, composed: true }))
    expect(calls).toEqual(['component', 'gesture', 'ancestor'])
  })

  it('preserves detail, case, bubbling boundaries and capture order', async () => {
    const calls: Array<[string, unknown]> = []
    const childTag = register({ template: () => html`<span>child</span>` })
    const wrapperTag = register({
      template: template(`<view capture-bind:onReady="capture"><view bind:onReady="bubble"><${childTag} bind:onReady="direct" bind:onready="lower" /></view></view>`, mode, { [childTag]: childTag }),
      component: {
        methods: {
          capture(event) { calls.push(['capture', event.detail]) },
          bubble(event) { calls.push(['bubble', event.detail]) },
          direct(event) { calls.push(['direct', event.detail]) },
          lower() { calls.push(['lower', null]) },
        },
      },
    })
    const parentTag = register({
      template: template(`<${wrapperTag} bind:onReady="outer" />`, mode, { [wrapperTag]: wrapperTag }),
      component: { methods: { outer(event) { calls.push(['outer', event.detail]) } } },
    })
    const parent = await mount(parentTag)
    const wrapper = parent.shadowRoot!.querySelector(wrapperTag) as TestElement
    await wrapper.updateComplete
    const child = wrapper.shadowRoot!.querySelector(childTag) as TestElement
    const detail = { value: 7 }

    child.triggerEvent('onReady', detail, { bubbles: true, composed: false })
    expect(calls).toEqual([['capture', detail], ['direct', detail], ['bubble', detail]])
    calls.length = 0
    child.triggerEvent('onReady', detail, { bubbles: true, composed: true })
    expect(calls).toEqual([['capture', detail], ['direct', detail], ['bubble', detail], ['outer', detail]])
    calls.length = 0
    child.triggerEvent('onReady', detail)
    expect(calls).toEqual([['capture', detail], ['direct', detail]])
  })

  it.each(['catch', 'capture-catch'])('preserves %s for accepted component events', async (prefix) => {
    const calls: string[] = []
    const childTag = register({ template: () => html`<span>child</span>` })
    const parentTag = register({
      template: template(`<view bind:signal="outer"><view ${prefix}:signal="stop"><${childTag} bind:signal="direct" /></view></view>`, mode, { [childTag]: childTag }),
      component: {
        methods: {
          outer() { calls.push('outer') },
          stop() { calls.push('stop') },
          direct() { calls.push('direct') },
        },
      },
    })
    const parent = await mount(parentTag)
    const child = parent.shadowRoot!.querySelector(childTag) as TestElement
    child.triggerEvent('signal', {}, { bubbles: true, composed: true })
    expect(calls).toEqual(prefix === 'catch' ? ['direct', 'stop'] : ['stop'])
  })
})

it('retains legacy long-gesture aliases without treating component contextmenu as a gesture', async () => {
  const calls: string[] = []
  const childTag = register({ template: () => html`<span>child</span>` })
  const parentTag = register({
    template: createTemplate(`<${childTag} bindlongpress="press" bindlongtap="tap" bindcontextmenu="context" />`),
    component: {
      methods: {
        press() { calls.push('press') },
        tap() { calls.push('tap') },
        context() { calls.push('context') },
      },
    },
  })
  const parent = await mount(parentTag)
  const child = parent.shadowRoot!.querySelector(childTag) as TestElement
  child.dispatchEvent(new Event('contextmenu'))
  expect(calls).toEqual(['press', 'tap'])
  child.triggerEvent('contextmenu')
  expect(calls).toEqual(['press', 'tap', 'context'])
  child.triggerEvent('longpress')
  expect(calls).toEqual(['press', 'tap', 'context', 'press'])
})

it('classifies a legacy host after registration upgrades an already-bound element', async () => {
  const calls: string[] = []
  const childTag = `event-channel-${++sequence}`
  const parentTag = register({
    template: createTemplate(`<${childTag} bindclick="click" bindtap="tap" />`),
    component: {
      methods: {
        click() { calls.push('component') },
        tap() { calls.push('gesture') },
      },
    },
  })
  const parent = await mount(parentTag)
  defineComponent(childTag, {
    template: createTemplate('<button bindtap="activate">emit</button>'),
    component: { methods: { activate() { this.triggerEvent('click') } } },
  })
  const child = parent.shadowRoot!.querySelector(childTag) as TestElement
  await child.updateComplete
  child.shadowRoot!.querySelector('weapp-button')!.dispatchEvent(new Event('click', { bubbles: true, composed: true }))
  expect(calls).toEqual(['component', 'gesture'])
})

it('replaces and removes legacy input methods on retained nodes without losing receiver or result handling', async () => {
  ensureNativeComponentsDefined()
  const calls: string[] = []
  const render = createTemplate('<input bindinput="transform" />')
  const tag = register({
    template: render,
    component: {
      data: { prefix: 'owner' },
      methods: {
        transform(event) {
          calls.push(`initial:${event.detail.value}`)
          return `${this.data.prefix}:initial:${event.detail.value}`
        },
      },
    },
  })
  const host = await mount(tag)
  const inputHost = host.shadowRoot!.querySelector('weapp-input')!
  const input = inputHost.shadowRoot!.querySelector('input')!
  let externalCalls = 0
  inputHost.addEventListener('input', () => externalCalls++)
  input.value = 'a'
  input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }))
  expect(input.value).toBe('owner:initial:a')

  defineComponent(tag, {
    template: render,
    component: {
      methods: {
        transform(event) {
          calls.push(`replacement:${event.detail.value}`)
          return `${this.data.prefix}:replacement:${event.detail.value}`
        },
      },
    },
  })
  await host.updateComplete
  expect(host.shadowRoot!.querySelector('weapp-input')).toBe(inputHost)
  expect(inputHost.shadowRoot!.querySelector('input')).toBe(input)
  input.value = 'b'
  input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }))
  expect(input.value).toBe('owner:replacement:b')
  expect(calls).toEqual(['initial:a', 'replacement:b'])

  defineComponent(tag, { template: render, component: { methods: {} } })
  await host.updateComplete
  expect(host.shadowRoot!.querySelector('weapp-input')).toBe(inputHost)
  expect(inputHost.shadowRoot!.querySelector('input')).toBe(input)
  input.value = 'c'
  input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }))
  expect(input.value).toBe('c')
  expect(calls).toEqual(['initial:a', 'replacement:b'])
  expect(externalCalls).toBe(3)
})

it('reconciles legacy handler, alias, capture and catch changes and removes both owned subscriptions', async () => {
  const calls: string[] = []
  const childTag = register({ template: () => html`<button>native</button>` })
  const parentTag = register({
    template: createTemplate(`<view id="outer"><${childTag} capture-catch:tap="first" /></view>`),
    component: {
      methods: {
        first() { calls.push('first') },
        second() { calls.push('second') },
      },
    },
  })
  const parent = await mount(parentTag)
  const child = parent.shadowRoot!.querySelector(childTag) as TestElement
  await child.updateComplete
  const button = child.shadowRoot!.querySelector('button')!
  const outer = parent.shadowRoot!.querySelector('#outer')!
  button.addEventListener('click', () => calls.push('button'))
  for (const eventName of ['click', 'contextmenu', 'tap']) {
    outer.addEventListener(eventName, () => calls.push(`outer:${eventName}`))
  }
  button.dispatchEvent(new Event('click', { bubbles: true, composed: true }))
  expect(calls).toEqual(['first'])

  child.setAttribute('data-mp-on-tap', 'second')
  child.setAttribute('data-mp-on-flags-tap', 'native:contextmenu')
  parent.setData({ revision: 1 })
  await parent.updateComplete
  expect(parent.shadowRoot!.querySelector(childTag)).toBe(child)
  calls.length = 0
  button.dispatchEvent(new Event('click', { bubbles: true, composed: true }))
  child.dispatchEvent(new Event('contextmenu', { bubbles: true, composed: true }))
  child.triggerEvent('tap', {}, { bubbles: true, composed: true })
  expect(calls).toEqual(['button', 'outer:click', 'second', 'outer:contextmenu', 'second', 'outer:tap'])

  child.removeAttribute('data-mp-on-tap')
  parent.setData({ revision: 2 })
  await parent.updateComplete
  expect(parent.shadowRoot!.querySelector(childTag)).toBe(child)
  calls.length = 0
  child.dispatchEvent(new Event('contextmenu', { bubbles: true, composed: true }))
  child.triggerEvent('tap', {}, { bubbles: true, composed: true })
  expect(calls).toEqual(['outer:contextmenu', 'outer:tap'])
})
