// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest'
import { ensureNativeComponentsDefined } from '../src/runtime'

ensureNativeComponentsDefined()
afterEach(() => document.body.replaceChildren())

describe.each(['input', 'textarea'] as const)('%s value ownership', (tag) => {
  function mount() {
    const host = document.createElement(`weapp-${tag}`)
    host.setAttribute('value', 'initial')
    document.body.append(host)
    const input = host.shadowRoot!.querySelector<HTMLInputElement | HTMLTextAreaElement>(tag)!
    input.value = 'edited'
    input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }))
    return { host, input }
  }

  it('keeps edited value across normal removal and reconnection of the same host', () => {
    const { host, input } = mount()
    host.remove()
    document.body.append(host)
    expect(host.shadowRoot!.querySelector(tag)).toBe(input)
    expect(input.value).toBe('edited')
  })

  it('keeps edited value when unrelated attributes change and applies explicit value updates', () => {
    const { host, input } = mount()
    host.setAttribute('placeholder', 'new placeholder')
    host.setAttribute('maxlength', '20')
    expect(input.value).toBe('edited')
    host.setAttribute('value', 'submitted')
    expect(input.value).toBe('submitted')
    host.removeAttribute('value')
    expect(input.value).toBe('')
  })
})
