// @vitest-environment happy-dom

import type { Ref } from 'wevu'
import type { ComponentPublicInstance } from '../src/runtime/component/types'
import { WEVU_INSTALL_RUNTIME_METHODS_KEY } from '@weapp-core/constants'
import { html } from 'lit'
import { html as staticHtml, unsafeStatic } from 'lit/static-html.js'
import { afterEach, expect, it } from 'vitest'
import { computed, getCurrentInstance, nextTick, shallowRef } from 'wevu'
import { defineComponent } from '../src/runtime/component'
import { resolveComponentPublicInstanceTarget } from '../src/runtime/component/publicInstance'
import { registerWebWevuComponent } from '../src/runtime/wevu'
import { slugify } from '../src/shared/slugify'

type MethodHost = ComponentPublicInstance & {
  back: unknown
  updateComplete: Promise<boolean>
  __weappSync: (methods: Record<string, (event: unknown) => unknown>) => void
  [WEVU_INSTALL_RUNTIME_METHODS_KEY]: (methods: Record<string, (event: unknown) => unknown>) => void
}

const originalCallback = () => 'original prop callback'
const updatedCallback = () => 'updated prop callback'

const variants = [
  { name: 'boolean', type: Boolean, initial: false, updated: true },
  { name: 'string', type: String, initial: 'initial', updated: 'updated' },
  { name: 'number', type: Number, initial: 7, updated: 12 },
  { name: 'object', type: Object, initial: { label: 'initial' }, updated: { label: 'updated' } },
  { name: 'array', type: Array, initial: ['initial'], updated: ['updated', 'second'] },
  { name: 'function', type: Function, initial: originalCallback, updated: updatedCallback },
  { name: 'untyped', type: null, initial: null, updated: 'updated' },
]

afterEach(() => {
  document.body.replaceChildren()
})

it.each(variants)('keeps $name props separate from setup methods and parent writes', async ({ name, type, initial, updated }) => {
  const id = `method-ownership-${name}`
  let publicInstance: object | undefined
  let setupProps: Record<string, unknown> = {}
  registerWebWevuComponent({
    props: { back: { type } },
    setup(props: Record<string, unknown>) {
      publicInstance = getCurrentInstance()
      setupProps = props
      const calls = shallowRef(0)
      return {
        calls,
        back(this: { calls: Ref<number> }) {
          this.calls.value++
          return this.calls.value
        },
      }
    },
  }, {
    kind: 'component',
    id,
    template: (state, context) => html`
      <button @click=${context.event('tap', 'back', state)}>call</button>
      <span>${state.calls}</span>
    `,
  })
  const element = document.createElement(slugify(id, 'wv-component')) as MethodHost
  element.back = initial
  document.body.append(element)
  await nextTick()
  await element.updateComplete

  expect(element.properties.back).toEqual(initial)
  expect(element.back).toEqual(initial)
  expect(setupProps.back).toEqual(initial)
  expect(resolveComponentPublicInstanceTarget(publicInstance)).toBe(element)
  const method = Reflect.get(publicInstance!, 'back') as () => number
  expect(method()).toBe(1)
  expect(Reflect.get(publicInstance!, 'back')).toBe(method)
  element.shadowRoot!.querySelector('button')!.click()
  await nextTick()
  await element.updateComplete
  expect(element.shadowRoot!.querySelector('span')!.textContent).toBe('2')
  expect(element.properties.back).toEqual(initial)

  element.back = updated
  await nextTick()
  await element.updateComplete
  expect(setupProps.back).toEqual(updated)
  expect(element.properties.back).toEqual(updated)
  expect(method()).toBe(3)
  expect(element.back).toEqual(updated)
  if (typeof updated === 'function') {
    expect(updated()).toBe('updated prop callback')
    expect((setupProps.back as () => string)()).toBe('updated prop callback')
  }
})

it.each(['root', 'projected'])('updates %s object and array props through parent setData', async (binding) => {
  const observed: string[] = []
  const forwardedObserved: string[] = []
  const forwardedTag = `wv-forwarded-props-${binding}`
  const forwardedElement = unsafeStatic(forwardedTag)
  defineComponent(forwardedTag, {
    template: state => html`<span>${state.payload.label}:${state.payload.suffix}/${state.item.label}</span>`,
    component: {
      properties: { payload: Object, item: Object, callback: null },
      observers: {
        payload(value: { label: string }) { forwardedObserved.push(`object:${value.label}`) },
        item(value: { label: string }) { forwardedObserved.push(`array:${value.label}`) },
      },
    },
  })
  registerWebWevuComponent({
    props: {
      payload: { type: Object, default: () => ({ nested: { label: 'default', suffix: 'default' } }) },
      items: { type: Array, default: () => [{ label: 'default' }] },
    },
    observers: {
      payload(value: { nested: { label: string } }) { observed.push(`object:${value.nested.label}`) },
      items(value: Array<{ label: string }>) { observed.push(`array:${value[0]!.label}`) },
    },
    setup(props: { payload: { nested: { label: string, suffix: string } }, items: Array<{ label: string }> }) {
      return {
        rendered: computed(() => `${props.payload.nested.label}:${props.payload.nested.suffix}/${props.items[0]!.label}`),
        payload() { return 'payload method' },
        items() { return 'items method' },
      }
    },
  }, {
    kind: 'component',
    id: `nested-method-props-${binding}`,
    template: state => staticHtml`
      <span>${state.rendered}</span>
      <${forwardedElement}
        .payload=${state.payload.nested}
        .item=${state.items[0]}
        .callback=${state.payload.callback}
      ></${forwardedElement}>
    `,
  })
  const childTag = slugify(`nested-method-props-${binding}`, 'wv-component')
  const childElement = unsafeStatic(childTag)
  const parentTag = `wv-nested-prop-parent-${binding}`
  const projected = binding === 'projected'
  const initialPayload = {
    nested: { label: 'object-initial', suffix: 'first' },
    untouched: { label: 'untouched' },
    callback: originalCallback,
  }
  const initialItems = [{ label: 'array-initial' }]
  defineComponent(parentTag, {
    template: state => staticHtml`<${childElement}
      .payload=${projected ? state.payload.wrapper : state.payload}
      .items=${projected ? state.items[0] : state.items}
    ></${childElement}>`,
    component: {
      data: {
        payload: projected ? { wrapper: initialPayload } : initialPayload,
        items: projected ? [initialItems] : initialItems,
        unrelated: { count: 0 },
        count: 0,
      },
    },
  })
  type RenderHost = ComponentPublicInstance & { updateComplete: Promise<boolean> }
  const parent = document.createElement(parentTag) as RenderHost
  document.body.append(parent)
  await parent.updateComplete
  const child = parent.shadowRoot!.querySelector(childTag) as RenderHost
  await nextTick()
  await child.updateComplete
  const forwarded = child.shadowRoot!.querySelector(forwardedTag) as RenderHost
  await forwarded.updateComplete
  expect(child.shadowRoot!.querySelector('span')!.textContent).toBe('object-initial:first/array-initial')
  expect(forwarded.shadowRoot!.querySelector('span')!.textContent).toBe('object-initial:first/array-initial')
  const unrelated = parent.data.unrelated
  const untouched = (projected ? parent.data.payload.wrapper : parent.data.payload).untouched

  await parent.setData({
    [projected ? 'payload.wrapper.nested.label' : 'payload.nested.label']: 'object-updated',
    [projected ? 'payload.wrapper.nested.suffix' : 'payload.nested.suffix']: 'second',
    [projected ? 'items[0][0].label' : 'items[0].label']: 'array-updated',
  })
  await nextTick()
  await child.updateComplete
  await forwarded.updateComplete
  expect(child.shadowRoot!.querySelector('span')!.textContent).toBe('object-updated:second/array-updated')
  expect(forwarded.shadowRoot!.querySelector('span')!.textContent).toBe('object-updated:second/array-updated')
  expect((projected ? parent.data.payload.wrapper : parent.data.payload).untouched).toBe(untouched)

  observed.length = 0
  forwardedObserved.length = 0
  const payload = parent.data.payload
  const items = parent.data.items
  const committedPayload = projected ? payload.wrapper : payload
  const committedItems = projected ? items[0] : items
  committedPayload.nested.label = 'object-in-place'
  committedItems[0].label = 'array-in-place'
  await parent.setData({ payload, items })
  await nextTick()
  await child.updateComplete
  await forwarded.updateComplete
  expect(child.shadowRoot!.querySelector('span')!.textContent).toBe('object-in-place:second/array-in-place')
  expect(observed).toEqual(['object:object-in-place', 'array:array-in-place'])
  expect(forwarded.shadowRoot!.querySelector('span')!.textContent).toBe('object-in-place:second/array-in-place')
  expect(forwardedObserved).toEqual(['object:object-in-place', 'array:array-in-place'])

  observed.length = 0
  forwardedObserved.length = 0
  const currentPayload = parent.data.payload
  const currentItems = parent.data.items
  const projectedPayload = projected ? currentPayload.wrapper : currentPayload
  const projectedItems = projected ? currentItems[0] : currentItems
  projectedPayload.nested.label = 'object-new-wrapper'
  projectedItems[0].label = 'array-new-wrapper'
  await parent.setData({ payload: { ...currentPayload }, items: [...currentItems] })
  await nextTick()
  await child.updateComplete
  await forwarded.updateComplete
  expect(child.shadowRoot!.querySelector('span')!.textContent).toBe('object-new-wrapper:second/array-new-wrapper')
  expect(observed).toEqual(['object:object-new-wrapper', 'array:array-new-wrapper'])
  expect(forwarded.shadowRoot!.querySelector('span')!.textContent).toBe('object-new-wrapper:second/array-new-wrapper')
  expect(forwardedObserved).toEqual(['object:object-new-wrapper', 'array:array-new-wrapper'])
  expect(forwarded.properties.callback).toBe(originalCallback)
  expect((forwarded.properties.callback as () => string)()).toBe('original prop callback')
  expect(parent.data.unrelated).toBe(unrelated)

  observed.length = 0
  forwardedObserved.length = 0
  await parent.setData({ count: 1 })
  await nextTick()
  await child.updateComplete
  await forwarded.updateComplete
  expect(parent.setData({ count: 1 })).toBeUndefined()
  expect(observed).toEqual([])
  expect(forwardedObserved).toEqual([])
})

it('isolates committed aliases from later path updates within one batch', async () => {
  const tag = 'wv-committed-alias-isolation'
  defineComponent(tag, {
    template: state => html`<span>${state.a.x}/${state.b.x}/${state.branches.left.x}/${state.branches.right.x}/${Object.getOwnPropertyDescriptor(state.record, '__proto__')?.value.x}</span>`,
    component: {
      data: {
        a: { x: 0 },
        b: { x: 0 },
        branches: { left: { x: 0 }, right: { x: 0 } },
        record: { ['__proto__']: { x: 0 } },
      },
    },
  })
  const parent = document.createElement(tag) as ComponentPublicInstance & { updateComplete: Promise<boolean> }
  document.body.append(parent)
  await parent.updateComplete

  const source = { x: 1 }
  const shared = { x: 1 }
  await parent.setData({
    'a': source,
    'a.x': 2,
    'b': source,
    'branches': { left: shared, right: shared },
    'branches.left.x': 2,
    'record': { ['__proto__']: { x: 1 } },
  })

  expect(parent.shadowRoot!.querySelector('span')!.textContent).toBe('2/1/2/1/1')
  expect(source.x).toBe(1)
  expect(shared.x).toBe(1)
  expect(Object.getPrototypeOf(parent.data.record)).toBe(Object.prototype)
  expect(Object.getOwnPropertyDescriptor(parent.data.record, '__proto__')?.value).toEqual({ x: 1 })
})

it('replaces and removes installed methods across host updates without touching props', async () => {
  const tag = 'wv-method-ownership-hot-update'
  let publicInstance!: ComponentPublicInstance
  defineComponent(tag, {
    template: (state, context) => html`
      <button @click=${context.event('tap', 'back', state)}>call</button>
      <span>${state.calls}</span>
    `,
    component: {
      properties: { back: { type: Boolean, value: false } },
      data: { calls: 0 },
      lifetimes: {
        created() {
          // eslint-disable-next-line ts/no-this-alias -- 记录真实生命周期接收者以验证公开实例的方法解析。
          publicInstance = this
        },
      },
    },
  })
  const element = document.createElement(tag) as MethodHost
  document.body.append(element)
  await element.updateComplete
  element[WEVU_INSTALL_RUNTIME_METHODS_KEY]({ back: () => element.setData({ calls: 1 }) })
  await element.updateComplete
  element.shadowRoot!.querySelector('button')!.click()
  await element.updateComplete
  expect(element.shadowRoot!.querySelector('span')!.textContent).toBe('1')
  expect(element.back).toBe(false)

  element.__weappSync({})
  await element.updateComplete
  const setupMethod = Reflect.get(publicInstance, 'back') as () => unknown
  await setupMethod()
  expect(element.data.calls).toBe(1)

  element[WEVU_INSTALL_RUNTIME_METHODS_KEY]({ back: () => element.setData({ calls: 2 }) })
  await element.updateComplete
  element.shadowRoot!.querySelector('button')!.click()
  await element.updateComplete
  expect(element.shadowRoot!.querySelector('span')!.textContent).toBe('2')
  expect(Reflect.get(publicInstance, 'back')).not.toBe(setupMethod)

  element.__weappSync({
    back(this: ComponentPublicInstance) { return this.setData({ calls: 3 }) },
  })
  await element.updateComplete
  element.shadowRoot!.querySelector('button')!.click()
  await element.updateComplete
  expect(element.shadowRoot!.querySelector('span')!.textContent).toBe('3')

  element.__weappSync({})
  element[WEVU_INSTALL_RUNTIME_METHODS_KEY]({})
  await element.updateComplete
  expect(Reflect.get(publicInstance, 'back')).toBe(false)
  expect(element.properties.back).toBe(false)
  element.back = true
  expect(element.properties.back).toBe(true)
})

it.each(['static', 'runtime'])('respects explicit overrides of ordinary %s methods', async (source) => {
  const tag = `wv-method-override-${source}`
  let publicInstance!: ComponentPublicInstance & { calculate: () => string }
  defineComponent(tag, {
    template: state => html`<span>${state.prefix}</span>`,
    component: {
      data: { prefix: 'owner' },
      methods: source === 'static' ? { calculate() { return `${this.data.prefix}:original` } } : {},
      lifetimes: {
        created() {
          publicInstance = this as typeof publicInstance
        },
      },
    },
  })
  const host = document.createElement(tag) as MethodHost
  document.body.append(host)
  await host.updateComplete
  if (source === 'runtime') {
    host[WEVU_INSTALL_RUNTIME_METHODS_KEY]({ calculate: () => `${host.data.prefix}:original` })
    await host.updateComplete
  }
  expect(publicInstance.calculate()).toBe('owner:original')

  publicInstance.calculate = function () {
    return `${this.data.prefix}:replacement`
  }
  expect(publicInstance.calculate()).toBe('owner:replacement')

  Object.defineProperty(publicInstance, 'calculate', {
    configurable: true,
    get() {
      return () => `${this.localName}:accessor`
    },
  })
  expect(publicInstance.calculate()).toBe(`${tag}:accessor`)

  Object.defineProperty(publicInstance, 'calculate', {
    configurable: false,
    writable: false,
    value: () => 'locked',
  })
  expect(publicInstance.calculate()).toBe('locked')
})
