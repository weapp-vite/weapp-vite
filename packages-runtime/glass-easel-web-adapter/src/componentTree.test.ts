import type { GlassEaselWebAdapter } from './index'
import * as glassEasel from 'glass-easel'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createGlassEaselWebAdapter } from './index'

const adapters: GlassEaselWebAdapter[] = []
const containers: HTMLElement[] = []

function createAdapter() {
  const adapter = createGlassEaselWebAdapter()
  adapters.push(adapter)
  return adapter
}

function createContainer() {
  const container = document.createElement('div')
  document.body.append(container)
  containers.push(container)
  return container
}

afterEach(() => {
  for (const adapter of adapters.splice(0)) {
    adapter.dispose()
  }
  for (const container of containers.splice(0)) {
    container.remove()
  }
})

describe('official component tree', () => {
  it('isolates component definitions and event dispatch between adapters', () => {
    const container = createContainer()
    const sentinel = document.createElement('aside')
    container.append(sentinel)
    const first = createAdapter()
    const second = createAdapter()
    for (const [adapter, initial] of [[first, 0], [second, 10]] as const) {
      adapter.registerComponent({
        name: 'counter',
        template: '<button bind:click="increment">{{count}}</button>',
        data: { count: initial },
        methods: {
          increment() { this.setData({ count: this.data.count + 1 }) },
        },
      })
    }
    const a = first.mountComponent('counter', container)
    const b = second.mountComponent('counter', container)
    a.root.querySelector('button')!.click()
    expect(first.getSnapshot(a).props.count).toBe(1)
    expect(second.getSnapshot(b).props.count).toBe(10)
    expect(() => second.updateComponent(a, { count: 99 })).toThrow('not owned')
    expect(() => second.unmountComponent(a)).toThrow('not owned')
    expect(() => second.getSnapshot(a)).toThrow('not owned')
    first.unmountComponent(a)
    expect(container.contains(sentinel)).toBe(true)
    expect(container.contains(b.root)).toBe(true)
    container.append(a.root)
    a.root.querySelector('button')!.click()
    expect(first.getSnapshot(a).props.count).toBe(1)
    b.root.querySelector('button')!.click()
    expect(second.getSnapshot(b).props.count).toBe(11)
  })

  it('updates actual named/default slots and propagates child events through the parent tree', () => {
    const adapter = createAdapter()
    adapter.registerComponent({
      name: 'parent',
      usingComponents: { child: '/child' },
      data: { title: 'Initial', count: 0, last: '' },
      template: '<child label="{{title}}" bind:change="onChange"><b slot="heading">{{title}}</b><button bind:click="increment">{{count}}</button></child>',
      methods: {
        increment() { this.setData({ count: this.data.count + 1 }) },
        onChange(event: { detail: { label: string } }) { this.setData({ last: event.detail.label }) },
      },
    })
    adapter.registerComponent({
      name: 'child',
      options: { multipleSlots: true },
      properties: { label: String },
      template: '<article><header><slot name="heading" /></header><main><slot /></main><button bind:click="emit">{{label}}</button></article>',
      methods: {
        emit() { this.triggerEvent('change', { label: this.data.label }) },
      },
    })
    const container = createContainer()
    const instance = adapter.mountComponent('parent', container)
    expect(container.querySelector('header')!.textContent).toBe('Initial')
    container.querySelector<HTMLButtonElement>('main button')!.click()
    expect(container.querySelector('main')!.textContent).toBe('1')
    adapter.updateComponent(instance, { title: 'Updated' })
    expect(container.querySelector('header')!.textContent).toBe('Updated')
    container.querySelector<HTMLButtonElement>('article > button')!.click()
    expect(adapter.getSnapshot(instance).props.last).toBe('Updated')
  })

  it('preserves keyed node identity while updating content and data paths', () => {
    const adapter = createAdapter()
    adapter.registerComponent({
      name: 'list',
      template: '<li wx:for="{{items}}" wx:key="id">{{item.label}}</li>',
      data: { items: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] },
    })
    const container = createContainer()
    const instance = adapter.mountComponent('list', container)
    const original = [...container.querySelectorAll('li')]
    adapter.updateComponent(instance, { items: [{ id: 'b', label: 'B2' }, { id: 'a', label: 'A2' }] })
    const reordered = [...container.querySelectorAll('li')]
    expect(reordered[0]).toBe(original[1])
    expect(reordered[1]).toBe(original[0])
    adapter.updateComponent(instance, { 'items[0].label': 'B3' })
    const snapshot = adapter.getSnapshot(instance)
    expect(snapshot.props).toEqual({ items: [{ id: 'b', label: 'B3' }, { id: 'a', label: 'A2' }] })
    ;(snapshot.props.items as { label: string }[])[0].label = 'mutated snapshot'
    expect(adapter.getSnapshot(instance).props.items).toEqual([{ id: 'b', label: 'B3' }, { id: 'a', label: 'A2' }])
    expect(reordered[0].textContent).toBe('B3')
  })

  it('records creation and recursively detaches each component exactly once', () => {
    const adapter = createAdapter()
    const trace: string[] = []
    for (const name of ['parent', 'child']) {
      adapter.registerComponent({
        name,
        template: name === 'parent' ? '<child />' : '<span>child</span>',
        usingComponents: name === 'parent' ? { child: '/child' } : {},
        lifetimes: {
          created() { trace.push(`${name}:created`) },
          attached() { trace.push(`${name}:attached`) },
          detached() { trace.push(`${name}:detached`) },
        },
      })
    }
    const instance = adapter.mountComponent('parent', createContainer())
    expect(adapter.getSnapshot(instance).lifecycle).toEqual(['created', 'attached'])
    expect(glassEasel.Element.isAttached(instance.native)).toBe(true)
    adapter.unmountComponent(instance)
    adapter.unmountComponent(instance)
    adapter.dispose()
    adapter.dispose()
    expect(adapter.getSnapshot(instance).lifecycle).toEqual(['created', 'attached', 'detached'])
    expect(glassEasel.Element.isAttached(instance.native)).toBe(false)
    expect(trace).toEqual(['child:created', 'parent:created', 'parent:attached', 'child:attached', 'child:detached', 'parent:detached'])
    expect(() => adapter.mountComponent('parent', createContainer())).toThrow('disposed')
    expect(() => adapter.updateComponent(instance, {})).toThrow('disposed')
    expect(() => adapter.registerComponent({ name: 'other', template: '<div />' })).toThrow('disposed')
  })

  it('keeps legacy slot inputs in the official tree through data updates', () => {
    const adapter = createAdapter()
    adapter.registerComponent({ name: 'slots', options: { multipleSlots: true }, template: '<section><slot name="heading" /><slot /></section>' })
    const container = createContainer()
    const instance = adapter.mountComponent('slots', container, { title: 'Initial' }, { heading: '<b>{{title}}</b>', default: '<i>Content</i>' })
    const content = container.querySelector('i')
    expect(container.querySelector('section')!.textContent).toBe('InitialContent')
    adapter.updateComponent(instance, { title: 'Updated' })
    expect(container.querySelector('section')!.textContent).toBe('UpdatedContent')
    expect(container.querySelector('i')).toBe(content)
    adapter.unmountComponent(instance)
    expect(container.childNodes).toHaveLength(0)
    expect(adapter.getSnapshot(instance).lifecycle).toEqual(['created', 'attached', 'detached'])
  })

  it('passes official properties and observers to the component definition', () => {
    const adapter = createAdapter()
    const observed = vi.fn()
    adapter.registerComponent({
      name: 'observed',
      template: '<span>{{label}}</span>',
      properties: { label: { type: String, value: 'Default' } },
      observers: { label: observed },
    })
    const instance = adapter.mountComponent('observed', createContainer())
    expect(instance.root.textContent).toBe('Default')
    adapter.updateComponent(instance, { label: 'Next' })
    expect(observed).toHaveBeenLastCalledWith('Next')
  })

  it('provides an owned mount root for a virtualHost component', () => {
    const adapter = createAdapter()
    adapter.registerComponent({ name: 'virtual', template: '<b>{{title}}</b>', options: { virtualHost: true } })
    const container = createContainer()
    const instance = adapter.mountComponent('virtual', container, { title: 'Initial' })
    expect(instance.root.parentNode).toBe(container)
    expect(instance.root.textContent).toBe('Initial')
    adapter.updateComponent(instance, { title: 'Updated' })
    expect(instance.root.textContent).toBe('Updated')
    adapter.unmountComponent(instance)
    expect(container.childNodes).toHaveLength(0)
  })

  it('does not recursively release a tree when detached disposes its adapter', () => {
    const adapter = createAdapter()
    const detached = vi.fn()
    adapter.registerComponent({ name: 'parent', template: '<child />', usingComponents: { child: '/child' }, lifetimes: { detached } })
    adapter.registerComponent({
      name: 'child',
      template: '<b />',
      lifetimes: { detached() { adapter.dispose() } },
    })
    const container = createContainer()
    const instance = adapter.mountComponent('parent', container)
    adapter.unmountComponent(instance)
    expect(detached).toHaveBeenCalledOnce()
    expect(adapter.getSnapshot(instance).lifecycle).toEqual(['created', 'attached', 'detached'])
    expect(container.childNodes).toHaveLength(0)
  })

  it('rejects missing component dependencies before allocating a root', () => {
    const adapter = createAdapter()
    adapter.registerComponent({ name: 'parent', template: '<child />', usingComponents: { child: '/missing' } })
    const container = createContainer()
    expect(() => adapter.mountComponent('parent', container)).toThrow('dependency is not registered')
    expect(container.childNodes).toHaveLength(0)
  })

  it('preserves a host-owned placeholder when validation fails', () => {
    const container = createContainer()
    const sentinel = document.createElement('aside')
    container.append(sentinel)
    const adapter = createGlassEaselWebAdapter({ host: { createElement: () => sentinel } })
    adapters.push(adapter)
    adapter.registerComponent({ name: 'card', template: '<b />' })
    expect(() => adapter.mountComponent('card', container)).toThrow('placeholder must be a new element')
    expect(container.children).toHaveLength(1)
    expect(container.firstElementChild).toBe(sentinel)
  })

  it('uses the same normalized paths for registration, dependencies and mounting', () => {
    const adapter = createAdapter()
    adapter.registerComponent({ name: '/components/./child', template: '<b>{{label}}</b>', properties: { label: String } })
    adapter.registerComponent({ name: 'pages/detail/../parent', template: '<child label="Nested" />', usingComponents: { child: '../components/child' } })
    const instance = adapter.mountComponent('/pages/./parent', createContainer())
    expect(instance.root.textContent).toBe('Nested')
    expect(adapter.getSnapshot(instance).name).toBe('pages/parent')
    expect(() => adapter.registerComponent({ name: 'components/child', template: '<div />' })).toThrow('already registered')
    expect(() => adapter.registerComponent({ name: '../escape', template: '<div />' })).toThrow('cannot escape')
  })

  it('copies snapshot containers while retaining callable data values', () => {
    const callback = vi.fn()
    const adapter = createAdapter()
    adapter.registerComponent({ name: 'callable', template: '<b />', data: { nested: { callback } } })
    const instance = adapter.mountComponent('callable', createContainer())
    const snapshot = adapter.getSnapshot(instance)
    expect(snapshot.props.nested).toEqual({ callback })
    expect(snapshot.props.nested).not.toBe(instance.native.data.nested)
    expect(instance.props.nested).toEqual({ callback })
  })
})
