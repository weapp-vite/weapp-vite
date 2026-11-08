import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

it.each([null, undefined, 42])('renders fallback template result %s without requiring Lit DOM capabilities', async (value) => {
  vi.resetModules()
  class Host {
    shadowRoot?: { innerHTML: string }
    attachShadow() {
      this.shadowRoot = { innerHTML: '' }
      return this.shadowRoot
    }
  }
  const registry = new Map<string, CustomElementConstructor>()
  vi.stubGlobal('document', undefined)
  vi.stubGlobal('HTMLElement', Host)
  vi.stubGlobal('customElements', {
    get: (name: string) => registry.get(name),
    define: (name: string, constructor: CustomElementConstructor) => registry.set(name, constructor),
  })
  const { defineComponent } = await import('../src/runtime/component')
  const Constructor = defineComponent('fallback-result', {
    template: (() => value) as never,
    style: '.retained {}',
    component: {},
  })
  const instance = new Constructor() as HTMLElement & { connectedCallback: () => void, disconnectedCallback: () => void }
  instance.connectedCallback()
  expect(instance.shadowRoot!.innerHTML).toBe(`<style></style><style>.retained {}</style>${value ?? ''}`)
  instance.disconnectedCallback()
})

it('retains underscore and uppercase identity in custom event attribute names', async () => {
  const { decodeEventAttributeName, encodeEventAttributeName } = await import('../src/runtime/component/constants')
  expect(decodeEventAttributeName(encodeEventAttributeName('on_Ready'))).toBe('on_Ready')
})

it.each([{}, { createComment: () => ({}) }])('requires all DOM capabilities before enabling Lit: %j', async (document) => {
  vi.resetModules()
  vi.stubGlobal('document', document)
  expect((await import('../src/runtime/component/constants')).supportsLit).toBe(false)
})
