// @vitest-environment happy-dom

import { html, noChange, nothing, render } from 'lit'
import { PartType } from 'lit/async-directive.js'
import { getDirectiveClass } from 'lit/directive-helpers.js'
import { afterEach, expect, it, vi } from 'vitest'
import { bindControlledAttribute } from '../src/runtime/controlledAttributes'
import { commitControlledBinding, createControlledBinding, recordControlledDataCommit, registerControlledAttributeCommit, releaseControlledBinding } from '../src/runtime/controlledAttributes/state'
import { bindRuntimeDataset } from '../src/runtime/datasetBinding'
import { bindRuntimeEvent } from '../src/runtime/eventBinding'

afterEach(() => document.body.replaceChildren())

it('rejects attribute placement for element directives and leaves direct render inert', () => {
  const listener = vi.fn()
  const reader = () => 1
  const cases = [
    { result: bindRuntimeDataset('data-value', 1), args: ['data-value', 1], output: noChange },
    { result: bindRuntimeEvent('click', listener), args: ['click', listener], output: nothing },
    { result: bindControlledAttribute({}, 'value', reader, {}), args: [{}, 'value', reader, {}], output: noChange },
  ]
  for (const { result, args, output } of cases) {
    const Directive = getDirectiveClass(result)!
    expect(() => new Directive({ type: PartType.ATTRIBUTE, name: 'title', strings: [''], tagName: 'div' })).toThrow(TypeError)
    const instance = new Directive({ type: PartType.ELEMENT })
    expect(instance.render(...args)).toBe(output)
    const lifecycle = instance as unknown as { disconnected: () => void, reconnected: () => void }
    expect(() => {
      lifecycle.disconnected()
      lifecycle.reconnected()
    }).not.toThrow()
  }
})

it('keeps disconnected event bindings inert and reconnects the latest handler once', () => {
  const container = document.createElement('div')
  const first = vi.fn()
  const next = vi.fn()
  const template = (name: string, listener: EventListener) => html`<button ${bindRuntimeEvent(name, listener)}>tap</button>`
  const root = render(template('click', first), container)
  const button = container.querySelector('button')!
  root.setConnected(false)
  render(template('change', next), container)
  button.dispatchEvent(new Event('change'))
  expect(next).not.toHaveBeenCalled()
  root.setConnected(true)
  button.dispatchEvent(new Event('click'))
  expect(first).not.toHaveBeenCalled()
  button.dispatchEvent(new Event('change'))
  expect(next).toHaveBeenCalledOnce()
  render(nothing, container)
  button.dispatchEvent(new Event('change'))
  expect(next).toHaveBeenCalledOnce()
})

it('releases replaced controlled owners and restores the latest reader on reconnection', () => {
  const container = document.createElement('div')
  const first = { instance: { data: { value: 'first' } } }
  const second = { instance: { data: { value: 'second' } } }
  const template = (context: typeof first, name: string) => html`<input ${bindControlledAttribute(context, name, scope => scope.value, context.instance.data)}>`
  const root = render(template(first, 'value'), container)
  const input = container.querySelector('input')!
  expect(input.getAttribute('value')).toBe('first')
  render(template(second, 'title'), container)
  expect(recordControlledDataCommit(first, [['value']])).toBe(false)
  expect(input.getAttribute('title')).toBe('second')
  root.setConnected(false)
  expect(recordControlledDataCommit(second, [['value']])).toBe(false)
  second.instance.data.value = 'restored'
  root.setConnected(true)
  expect(input.getAttribute('title')).toBe('restored')
  expect(recordControlledDataCommit(second, [['value']])).toBe(true)
  render(nothing, container)
  expect(recordControlledDataCommit(second, [['value']])).toBe(false)
})

it('preserves replacement commit callbacks and removes nullish controlled attributes', () => {
  const element = document.createElement('input')
  const context = {}
  const oldCommit = vi.fn()
  const currentCommit = vi.fn()
  const otherCommit = vi.fn()
  const releaseOld = registerControlledAttributeCommit(element, 'value', oldCommit)
  const releaseCurrent = registerControlledAttributeCommit(element, 'value', currentCommit)
  const releaseOther = registerControlledAttributeCommit(element, 'title', otherCommit)
  releaseOld()
  const binding = createControlledBinding(context, element, 'value')
  const scope = { value: 'same' as string | null }
  commitControlledBinding(binding, scope => scope.value, scope)
  recordControlledDataCommit(context, [['value']])
  commitControlledBinding(binding, scope => scope.value, scope)
  expect(oldCommit).not.toHaveBeenCalled()
  expect(currentCommit).toHaveBeenCalledWith('same')
  releaseCurrent()
  releaseCurrent()
  releaseOther()
  scope.value = null
  commitControlledBinding(binding, scope => scope.value, scope)
  expect(element.hasAttribute('value')).toBe(false)
  releaseControlledBinding(binding)
  releaseControlledBinding(binding)
})
