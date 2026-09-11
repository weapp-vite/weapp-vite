import { describe, expect, it } from 'vitest'
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
})
