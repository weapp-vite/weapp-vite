// @vitest-environment happy-dom

import type { ComponentPublicInstance, DefineComponentOptions } from '../src/runtime/component'
import { html } from 'lit'
import { afterEach, describe, expect, it } from 'vitest'
import { ensureNativeComponentsDefined } from '../src/runtime'
import { defineComponent } from '../src/runtime/component'
import { registerApp } from '../src/runtime/polyfill/routeRuntime'
import { createTemplate } from '../src/runtime/template'

interface StyleHost extends ComponentPublicInstance {
  updateComplete: Promise<boolean>
}

let sequence = 0

async function mount(options: Partial<DefineComponentOptions> = {}) {
  const tag = `app-style-probe-${++sequence}`
  const definition = {
    template: () => html`<input class="probe">`,
    component: { options: { styleIsolation: 'apply-shared' as const } },
    ...options,
  }
  defineComponent(tag, definition)
  const host = document.createElement(tag) as StyleHost
  document.body.append(host)
  await host.updateComplete
  const input = host.shadowRoot!.querySelector('input')!
  return { tag, host, input, definition }
}

describe('application stylesheet lifetime', () => {
  afterEach(() => {
    document.body.replaceChildren()
    registerApp({}, { id: 'app' })
  })

  it('updates current and future consumers without replacing their rendered state', async () => {
    registerApp({}, { id: 'app', style: '.probe { color: rgb(231, 17, 83); }' })
    const { host, input } = await mount()
    input.value = 'preserved'
    expect(getComputedStyle(input).color).toBe('rgb(231, 17, 83)')

    registerApp({}, { id: 'app', style: '.probe { color: rgb(41, 73, 191); }' })
    await host.updateComplete
    expect(getComputedStyle(input).color).toBe('rgb(41, 73, 191)')
    expect(host.shadowRoot!.querySelector('input')).toBe(input)
    expect(input.value).toBe('preserved')
    const late = await mount()
    expect(getComputedStyle(late.input).color).toBe('rgb(41, 73, 191)')
  })

  it('keeps one legacy listener when stylesheet updates retain the rendered node', async () => {
    ensureNativeComponentsDefined()
    let calls = 0
    const { host } = await mount({
      template: createTemplate('<button id="legacy-style-action" bindtap="go">go</button><input id="legacy-style-input" />'),
      component: {
        options: { styleIsolation: 'apply-shared' },
        methods: { go() { calls++ } },
      },
    })
    const button = host.shadowRoot!.querySelector<HTMLElement>('#legacy-style-action')!
    const inputHost = host.shadowRoot!.querySelector('#legacy-style-input')!
    const input = inputHost.shadowRoot!.querySelector('input')!
    input.value = 'preserved'
    input.setSelectionRange(2, 5)
    for (const style of ['#legacy-style-action { color: red }', '', '#legacy-style-action { color: blue }']) {
      registerApp({}, { id: 'app', style })
      await host.updateComplete
      expect(host.shadowRoot!.querySelector('#legacy-style-action')).toBe(button)
      expect(host.shadowRoot!.querySelector('#legacy-style-input')).toBe(inputHost)
      expect(inputHost.shadowRoot!.querySelector('input')).toBe(input)
      expect(input.value).toBe('preserved')
      expect([input.selectionStart, input.selectionEnd]).toEqual([2, 5])
    }
    button.click()
    expect(calls).toBe(1)
  })

  it('refreshes a reconnected consumer after missing detached updates', async () => {
    registerApp({}, { id: 'app', style: '.probe { color: rgb(231, 17, 83); }' })
    const { host, input } = await mount()
    host.remove()
    registerApp({}, { id: 'app', style: '.probe { color: rgb(41, 73, 191); }' })
    document.body.append(host)
    await host.updateComplete
    expect(getComputedStyle(input).color).toBe('rgb(41, 73, 191)')

    registerApp({}, { id: 'app', style: '.probe { color: rgb(15, 121, 37); }' })
    await host.updateComplete
    expect(getComputedStyle(input).color).toBe('rgb(15, 121, 37)')
  })

  it('respects explicit isolation precedence and changes the subscription on component HMR', async () => {
    registerApp({}, { id: 'app', style: '.probe { color: rgb(231, 17, 83) !important; }' })
    const { tag, host, input, definition } = await mount({ style: '.probe { color: rgb(15, 121, 37); }' })
    expect(getComputedStyle(input).color).toBe('rgb(231, 17, 83)')
    defineComponent(tag, {
      ...definition,
      component: { options: { styleIsolation: 'isolated', addGlobalClass: true } },
    })
    await host.updateComplete
    expect(getComputedStyle(input).color).toBe('rgb(15, 121, 37)')
    registerApp({}, { id: 'app', style: '.probe { color: rgb(41, 73, 191) !important; }' })
    defineComponent(tag, definition)
    await host.updateComplete
    expect(getComputedStyle(input).color).toBe('rgb(41, 73, 191)')
  })
})
