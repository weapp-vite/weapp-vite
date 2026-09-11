import { describe, expect, it, vi } from 'vitest'
import { createGlassEaselComponentDefinition, createGlassEaselWebAdapter, getGlassEaselRuntimeInfo } from './index'

describe('glass-easel web adapter PoC', () => {
  it('exposes the official glass-easel runtime and compiler probe', () => {
    expect(getGlassEaselRuntimeInfo()).toMatchObject({ hasTemplateCompiler: true })
    expect(createGlassEaselComponentDefinition({ name: 'native-card', template: '<div>{{title}}</div>' })).toBeDefined()
  })

  it('mounts interpolated component and reports lifecycle snapshot', () => {
    const adapter = createGlassEaselWebAdapter()
    adapter.registerComponent({ name: 'hello-card', template: '<span>{{title}}</span>' })
    const container = document.createElement('div')
    const instance = adapter.mountComponent('hello-card', container, { title: 'Hello' })
    expect(container.innerHTML).toContain('<span>Hello</span>')
    expect(adapter.getSnapshot(instance)).toMatchObject({ name: 'hello-card', disposed: false })
    adapter.unmountComponent(instance)
    expect(adapter.getSnapshot(instance)).toMatchObject({ disposed: true })
  })

  it('updates props through the glass-easel component instance', () => {
    const adapter = createGlassEaselWebAdapter()
    adapter.registerComponent({ name: 'counter-card', template: '<div>{{count}}</div>' })
    const container = document.createElement('div')
    const instance = adapter.mountComponent('counter-card', container, { count: 1 })
    adapter.updateComponent(instance, { count: 2 })
    expect(adapter.getSnapshot(instance)).toMatchObject({ props: { count: 2 } })
    expect(container.textContent).toContain('2')
  })

  it('renders a glass-easel list and updates its data tree', () => {
    const adapter = createGlassEaselWebAdapter()
    adapter.registerComponent({ name: 'list-card', template: '<div wx:for="{{items}}" wx:key="*this">{{item}}</div>' })
    const container = document.createElement('div')
    const instance = adapter.mountComponent('list-card', container, { items: ['a', 'b'] })
    expect(container.textContent).toContain('a')
    expect(container.textContent).toContain('b')
    adapter.updateComponent(instance, { items: ['c'] })
    expect(container.textContent).toContain('c')
    expect(container.textContent).not.toContain('a')
  })

  it('compiles slot templates through the official compiler', () => {
    const definition = createGlassEaselComponentDefinition({ name: 'slot-card', template: '<div><slot /></div>' })
    expect(definition).toBeDefined()
  })

  it('bridges triggered events to the host', () => {
    const dispatchEvent = vi.fn()
    const adapter = createGlassEaselWebAdapter({ host: { dispatchEvent } })
    adapter.registerComponent({ name: 'event-card', template: '<div />' })
    const instance = adapter.mountComponent('event-card', document.createElement('div'))
    adapter.triggerEvent(instance, 'change', { value: 3 })
    expect(dispatchEvent).toHaveBeenCalledOnce()
    expect(dispatchEvent.mock.calls[0][0].type).toBe('change')
    expect(dispatchEvent.mock.calls[0][0].detail).toEqual({ value: 3 })
  })

  it('runs the official attached lifecycle during mount', () => {
    const attached = vi.fn()
    const adapter = createGlassEaselWebAdapter()
    adapter.registerComponent({ name: 'lifecycle-card', template: '<div />', lifetimes: { attached } })
    adapter.mountComponent('lifecycle-card', document.createElement('div'))
    expect(attached).toHaveBeenCalledOnce()
  })

  it('runs detached lifecycle exactly once during unmount', () => {
    const detached = vi.fn()
    const adapter = createGlassEaselWebAdapter()
    adapter.registerComponent({ name: 'detach-card', template: '<div />', lifetimes: { detached } })
    const instance = adapter.mountComponent('detach-card', document.createElement('div'))
    adapter.unmountComponent(instance)
    adapter.unmountComponent(instance)
    expect(detached).toHaveBeenCalledOnce()
  })
})
