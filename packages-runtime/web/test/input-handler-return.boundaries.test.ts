// @vitest-environment happy-dom

import type { ComponentPublicInstance } from '../src/runtime/component'
import { html } from 'lit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from '../src/runtime/component'
import { ensureNativeComponentsDefined } from '../src/runtime/nativeComponents'

interface RuntimeHost extends ComponentPublicInstance {
  updateComplete: Promise<boolean>
}

async function mountInputHandler(tagName: string, handler: (event: unknown) => unknown) {
  ensureNativeComponentsDefined()
  defineComponent(tagName, {
    template: (scope, ctx) => html`
      <weapp-input
        id="boundary-input"
        @input=${ctx.event('input', 'transform', scope)}
      ></weapp-input>
    `,
    component: {
      methods: { transform: handler },
    },
  })
  const host = document.createElement(tagName) as RuntimeHost
  document.body.append(host)
  await host.updateComplete
  const componentInput = host.shadowRoot?.querySelector('weapp-input')
  const input = componentInput?.shadowRoot?.querySelector('input')
  if (!(input instanceof HTMLInputElement)) {
    throw new TypeError('Expected a rendered native input')
  }
  return { host, input }
}

function dispatchInput(input: HTMLInputElement, value: string) {
  input.value = value
  input.setSelectionRange(value.length, value.length)
  input.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    composed: true,
    data: value,
    inputType: 'insertText',
  }))
}

describe('native input handler return boundaries', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('accepts an empty string and ignores non-string or Promise results', async () => {
    let nextResult: unknown = ''
    const handler = vi.fn(() => nextResult)
    const { input } = await mountInputHandler('wv-issue-967-return-boundaries', handler)

    dispatchInput(input, 'clear me')
    expect(input.value).toBe('')

    nextResult = 1
    dispatchInput(input, 'number stays')
    expect(input.value).toBe('number stays')

    nextResult = Promise.resolve('async replacement')
    dispatchInput(input, 'promise stays')
    expect(input.value).toBe('promise stays')
    await Promise.resolve()
    expect(input.value).toBe('promise stays')
    expect(handler).toHaveBeenCalledTimes(3)
  })

  it('does not reinterpret unrelated input events or textarea handlers', async () => {
    ensureNativeComponentsDefined()
    const handler = vi.fn(() => 'rewritten')
    defineComponent('wv-issue-967-return-exclusions', {
      template: (scope, ctx) => html`
        <weapp-input
          id="manual-custom-event"
          @input=${ctx.event('input', 'transform', scope)}
        ></weapp-input>
        <weapp-textarea
          id="excluded-textarea"
          @input=${ctx.event('input', 'transform', scope)}
        ></weapp-textarea>
        <input
          id="html-input"
          @input=${ctx.event('input', 'transform', scope)}
        >
        <div
          id="custom-input-event"
          @input=${ctx.event('input', 'transform', scope)}
        ></div>
      `,
      component: {
        methods: { transform: handler },
      },
    })
    const host = document.createElement('wv-issue-967-return-exclusions') as RuntimeHost
    document.body.append(host)
    await host.updateComplete

    const componentInput = host.shadowRoot?.querySelector('#manual-custom-event')
    const realInput = componentInput?.shadowRoot?.querySelector('input')
    const componentTextarea = host.shadowRoot?.querySelector('#excluded-textarea')
    const realTextarea = componentTextarea?.shadowRoot?.querySelector('textarea')
    const htmlInput = host.shadowRoot?.querySelector('#html-input')
    const customTarget = host.shadowRoot?.querySelector('#custom-input-event')
    if (
      !(componentInput instanceof HTMLElement)
      || !(realInput instanceof HTMLInputElement)
      || !(realTextarea instanceof HTMLTextAreaElement)
      || !(htmlInput instanceof HTMLInputElement)
      || !(customTarget instanceof HTMLDivElement)
    ) {
      throw new TypeError('Expected all input event exclusion controls')
    }

    realInput.value = 'manual stays'
    const manualDetail = Object.freeze({ value: 'manual custom event' })
    componentInput.dispatchEvent(new CustomEvent('input', {
      bubbles: true,
      composed: true,
      detail: manualDetail,
    }))
    expect(realInput.value).toBe('manual stays')
    expect(manualDetail).toEqual({ value: 'manual custom event' })

    dispatchInput(htmlInput, 'html stays')
    expect(htmlInput.value).toBe('html stays')

    realTextarea.value = 'textarea stays'
    realTextarea.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      composed: true,
      data: 'textarea stays',
      inputType: 'insertText',
    }))
    expect(realTextarea.value).toBe('textarea stays')

    const customDetail = Object.freeze({ value: 'custom stays' })
    customTarget.dispatchEvent(new CustomEvent('input', {
      bubbles: true,
      composed: true,
      detail: customDetail,
    }))
    expect(customDetail).toEqual({ value: 'custom stays' })
    expect(handler).toHaveBeenCalledTimes(4)
  })
})
