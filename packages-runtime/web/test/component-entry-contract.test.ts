import { afterEach, describe, expect, it, vi } from 'vitest'

describe('component registration entry contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('rejects invalid definitions and updates an existing fallback component', async () => {
    const registry = new Map<string, CustomElementConstructor>()
    vi.stubGlobal('document', undefined)
    vi.stubGlobal('HTMLElement', undefined)
    vi.stubGlobal('customElements', {
      define: (name: string, constructor: CustomElementConstructor) => registry.set(name, constructor),
      get: (name: string) => registry.get(name),
    })
    const { defineComponent } = await import('../src/runtime/component')
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(() => defineComponent('wv-invalid-options', null as any)).toThrow(TypeError)
    expect(() => defineComponent('wv-missing-template', {} as never)).toThrow('需要提供模板渲染函数')

    const constructor = defineComponent('wv-fallback-entry', {
      template: () => '',
      component: {},
    })
    expect(registry.get('wv-fallback-entry')).toBe(constructor)
    expect(defineComponent('wv-fallback-entry', {} as never)).toBe(constructor)
    expect(defineComponent('wv-fallback-entry', {
      template: () => 'updated',
      component: {},
    })).toBe(constructor)

    const WarningConstructor = defineComponent('wv-fallback-warning', {
      template: () => '',
      component: { behaviors: 'invalid' as any },
    })
    expect(warning).toHaveBeenCalled()
    const instance = new WarningConstructor() as any
    instance.connectedCallback()
  })
})
