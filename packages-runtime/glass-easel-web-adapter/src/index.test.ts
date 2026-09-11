import { describe, expect, it, vi } from 'vitest'
import { createGlassEaselComponentDefinition, createGlassEaselWebAdapter, getGlassEaselRuntimeInfo } from './index'

describe('glass-easel web adapter PoC', () => {
  it('exposes the official glass-easel runtime and compiler probe', () => {
    expect(getGlassEaselRuntimeInfo()).toMatchObject({ hasTemplateCompiler: true })
    expect(createGlassEaselComponentDefinition({ name: 'native-card', template: '<div>{{title}}</div>' })).toBeDefined()
  })

  it('mounts interpolated component and reports lifecycle snapshot', () => {
    const adapter = createGlassEaselWebAdapter()
    const ready = vi.fn()
    adapter.registerComponent({ name: 'hello-card', template: '<span>{{title}}</span>', lifetimes: { ready } })
    const container = document.createElement('div')
    const instance = adapter.mountComponent('hello-card', container, { title: 'Hello' })
    expect(container.innerHTML).toContain('<span>Hello</span>')
    expect(ready).toHaveBeenCalledOnce()
    expect(adapter.getSnapshot(instance)).toMatchObject({ name: 'hello-card', disposed: false })
    adapter.unmountComponent(instance)
    expect(adapter.getSnapshot(instance)).toMatchObject({ disposed: true })
  })
})
