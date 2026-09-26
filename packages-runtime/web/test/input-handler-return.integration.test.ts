// @vitest-environment happy-dom

import type { ComponentPublicInstance } from '../src/runtime/component'
import type { TemplateRenderer } from '../src/runtime/template'
import { html } from 'lit'
import { afterEach, describe, expect, it } from 'vitest'
import { registerComponent, registerPage } from '../src/runtime/polyfill/routeRuntime'
import { createTemplate } from '../src/runtime/template'
import { slugify } from '../src/shared/slugify'

interface RuntimeHost extends ComponentPublicInstance {
  updateComplete: Promise<boolean>
}

interface InputHandlerEvent {
  detail: {
    value: string
  }
}

function getRealInput(host: RuntimeHost) {
  const componentInput = host.shadowRoot?.querySelector('weapp-input')
  const input = componentInput?.shadowRoot?.querySelector('input')
  if (!(input instanceof HTMLInputElement)) {
    throw new TypeError('Expected a rendered native input')
  }
  return input
}

async function mountScenario(owner: 'page' | 'component', renderer: 'compiled' | 'legacy') {
  const id = `issue-967/${owner}-${renderer}/index`
  const template: TemplateRenderer = renderer === 'compiled'
    ? (scope, ctx) => html`
        <weapp-input
          id="return-input"
          @input=${ctx.event('input', 'transform', scope)}
        ></weapp-input>
        <weapp-view>${scope.calls}</weapp-view>
      `
    : createTemplate(`
        <input id="return-input" bindinput="transform" />
        <view>{{calls}}</view>
      `)
  const seenValues: string[] = []
  function transform(this: ComponentPublicInstance, event: unknown) {
    const inputEvent = event as InputHandlerEvent
    seenValues.push(inputEvent.detail.value)
    if (renderer === 'compiled') {
      this.setData({
        calls: Number(this.data.calls) + 1,
        lastInput: inputEvent.detail.value,
      })
    }
    return inputEvent.detail.value === 'clear' ? '' : `${inputEvent.detail.value}1`
  }
  if (owner === 'page') {
    registerPage({
      data: { calls: 0, lastInput: '' },
      transform,
    }, { id, template })
  }
  else {
    registerComponent({
      data: { calls: 0, lastInput: '' },
      methods: { transform },
    }, { id, template })
  }
  const tagName = slugify(id, owner === 'page' ? 'wv-page' : 'wv-component')
  const host = document.createElement(tagName) as RuntimeHost
  document.body.append(host)
  await host.updateComplete
  return { host, seenValues }
}

describe('native input handler return integration', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it.each(['page', 'component'] as const)('applies the %s compiled handler string after unrelated data updates', async (owner) => {
    const { host, seenValues } = await mountScenario(owner, 'compiled')
    const input = getRealInput(host)
    input.value = 'a'
    input.setSelectionRange(1, 1)

    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      composed: true,
      data: 'a',
      inputType: 'insertText',
    }))

    expect(seenValues).toEqual(['a'])
    expect(host.data).toMatchObject({ calls: 1, lastInput: 'a' })
    await host.updateComplete
    expect(host.shadowRoot?.querySelector('weapp-view')?.textContent).toBe('1')
    expect(getRealInput(host).value).toBe('a1')
  })

  it.each(['page', 'component'] as const)('applies the %s legacy handler strings synchronously', async (owner) => {
    const { host, seenValues } = await mountScenario(owner, 'legacy')
    const input = getRealInput(host)
    input.value = 'a'
    input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }))
    expect(input.value).toBe('a1')

    input.value = 'clear'
    input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }))
    expect(input.value).toBe('')
    expect(seenValues).toEqual(['a', 'clear'])
    expect(host.data).toMatchObject({ calls: 0, lastInput: '' })
  })
})
