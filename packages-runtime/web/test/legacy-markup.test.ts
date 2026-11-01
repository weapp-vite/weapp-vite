// @vitest-environment happy-dom

import type { ComponentPublicInstance } from '../src/runtime/component'
import { afterEach, describe, expect, it } from 'vitest'
import { createTemplate, defineComponent, ensureNativeComponentsDefined } from '../src/runtime'

type TestElement = ComponentPublicInstance & { updateComplete: Promise<boolean> }
let sequence = 0

ensureNativeComponentsDefined()
afterEach(() => document.body.replaceChildren())

async function mount(source: string, data: Record<string, unknown>, methods = {}) {
  const tag = `legacy-markup-${++sequence}`
  defineComponent(tag, { template: createTemplate(source), component: { data, methods } })
  const owner = document.createElement(tag) as TestElement
  document.body.append(owner)
  await owner.updateComplete
  return owner
}

describe('legacy markup ownership', () => {
  it('updates empty text, source attributes, classes, styles and handlers inside native-owned content', async () => {
    const calls: string[] = []
    const owner = await mount('<button id="action" class="{{klass}}" style="{{style}}" data-note="{{note}}" bindtap="{{handler}}">{{label}}</button><slot name="{{slot}}" />', {
      klass: 'first',
      style: 'color:red',
      note: 'old',
      handler: 'first',
      label: '',
      slot: 'one',
    }, {
      first() { calls.push('first') },
      second() { calls.push('second') },
    })
    const host = owner.shadowRoot!.querySelector<HTMLElement>('#action')!
    const button = host.querySelector('button')!
    const slot = owner.shadowRoot!.querySelector('slot')!
    button.click()
    owner.setData({ klass: 'second', style: 'color:blue', note: 'new', handler: 'second', label: '<ready>&', slot: 'two' })
    await owner.updateComplete
    expect(owner.shadowRoot!.querySelector('#action')).toBe(host)
    expect(host.querySelector('button')).toBe(button)
    expect(button.textContent).toBe('<ready>&')
    expect([...host.classList]).toEqual(expect.arrayContaining(['second', 'weapp-btn--default']))
    expect(host.classList.contains('first')).toBe(false)
    expect(host.style.color).toBe('blue')
    expect(host.dataset.note).toBe('new')
    expect(owner.shadowRoot!.querySelector('slot')).toBe(slot)
    expect(slot.name).toBe('two')
    button.click()
    owner.setData({ label: '', style: '', note: '' })
    await owner.updateComplete
    expect(host.querySelector('button')).toBe(button)
    expect(button.textContent).toBe('')
    expect(host.hasAttribute('style')).toBe(false)
    expect(calls).toEqual(['first', 'second'])
  })

  it('reorders keyed elements even when their rendered HTML is identical', async () => {
    const owner = await mount('<view wx:for="{{items}}" wx:key="id">{{item.label}}</view>', {
      items: [{ id: 'a', label: 'same' }, { id: 'b', label: 'same' }],
    })
    const original = [...owner.shadowRoot!.querySelectorAll('weapp-view')]
    owner.setData({ items: [{ id: 'b', label: 'same' }, { id: 'a', label: 'same' }] })
    await owner.updateComplete
    expect([...owner.shadowRoot!.querySelectorAll('weapp-view')]).toEqual([original[1], original[0]])
    owner.setData({ items: [{ id: 'a', label: 'updated' }, { id: 'c', label: 'inserted' }] })
    await owner.updateComplete
    const current = [...owner.shadowRoot!.querySelectorAll('weapp-view')]
    expect(current[0]).toBe(original[0])
    expect(current[0]!.textContent).toBe('updated')
    expect(current[1]!.textContent).toBe('inserted')
    expect(original[1]!.isConnected).toBe(false)
  })

  it('moves keyed block fragments together and keeps their native contents and dataset bindings', async () => {
    const calls: unknown[] = []
    const owner = await mount('<block wx:for="{{items}}" wx:key="id"><text>{{item.label}}</text><button data-id="{{item.id}}" bindtap="tap">{{item.label}}</button></block>', {
      items: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    }, { tap(event: { currentTarget: { dataset: { id: unknown } } }) { calls.push(event.currentTarget.dataset.id) } })
    const buttons = [...owner.shadowRoot!.querySelectorAll('weapp-button')]
    const texts = [...owner.shadowRoot!.querySelectorAll('weapp-text')]
    const native = buttons[1]!.querySelector('button')!
    owner.setData({ items: [{ id: 'b', label: 'updated B' }, { id: 'a', label: 'A' }] })
    await owner.updateComplete
    expect([...owner.shadowRoot!.querySelectorAll('weapp-button')]).toEqual([buttons[1], buttons[0]])
    expect([...owner.shadowRoot!.querySelectorAll('weapp-text')]).toEqual([texts[1], texts[0]])
    expect(buttons[1]!.querySelector('button')).toBe(native)
    expect(native.textContent).toBe('updated B')
    native.click()
    expect(calls).toEqual(['b'])
  })

  it('keeps nested keyed fragments ordered while deleting and inserting complete groups', async () => {
    const owner = await mount('<block wx:for="{{groups}}" wx:for-item="group" wx:key="id"><text>{{group.id}}</text><block wx:for="{{group.items}}" wx:key="*this"><view>{{item}}</view><text>tail</text></block></block>', {
      groups: [{ id: 'a', items: ['a1', 'a2'] }, { id: 'b', items: ['b1'] }],
    })
    const original = [...owner.shadowRoot!.querySelectorAll('weapp-view')]
    owner.setData({ groups: [{ id: 'b', items: ['b1', 'b2'] }, { id: 'a', items: ['a2'] }] })
    await owner.updateComplete
    const current = [...owner.shadowRoot!.querySelectorAll('weapp-view')]
    expect(current.map(node => node.textContent)).toEqual(['b1', 'b2', 'a2'])
    expect(current[0]).toBe(original[2])
    expect(current[2]).toBe(original[1])
    expect(original[0]!.isConnected).toBe(false)
    expect(owner.shadowRoot!.textContent).toContain('bb1tailb2tailaa2tail')
  })

  it('removes and restores conditional fragments without replacing unaffected siblings or duplicating listeners', async () => {
    let calls = 0
    const owner = await mount('<block wx:if="{{visible}}"><view id="first" bindtap="tap">{{label}}</view><view id="second">tail</view></block><text id="stable">{{label}}</text>', {
      visible: true,
      label: 'before',
    }, { tap() { calls++ } })
    const first = owner.shadowRoot!.querySelector('#first')!
    const second = owner.shadowRoot!.querySelector('#second')!
    const stable = owner.shadowRoot!.querySelector('#stable')!
    owner.setData({ label: 'after' })
    await owner.updateComplete
    expect(owner.shadowRoot!.querySelector('#first')).toBe(first)
    expect(owner.shadowRoot!.querySelector('#second')).toBe(second)
    owner.setData({ visible: false })
    await owner.updateComplete
    expect(first.isConnected).toBe(false)
    expect(second.isConnected).toBe(false)
    expect(owner.shadowRoot!.querySelector('#stable')).toBe(stable)
    owner.setData({ visible: true })
    await owner.updateComplete
    owner.shadowRoot!.querySelector('#first')!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
    expect(calls).toBe(1)
    expect(owner.shadowRoot!.querySelector('#stable')).toBe(stable)
  })

  it.each([
    ['movable-view', 'x="20" out-of-bounds="true"', 'transform', ''],
    ['swiper', '', '--weapp-swiper-display-count', ''],
    ['picker-view', '', '--weapp-picker-view-item-height', '<picker-view-column><view>A</view></picker-view-column>'],
  ])('preserves %s native-owned styles while updating or removing source declarations', async (tag, attributes, property, children) => {
    const owner = await mount(`<${tag} id="native" ${attributes} style="{{style}}">${children}</${tag}>`, { style: 'color:red' })
    const native = owner.shadowRoot!.querySelector<HTMLElement>('#native')!
    const initial = native.style.getPropertyValue(property!)
    expect(initial).not.toBe('')
    owner.setData({ style: 'color:blue' })
    await owner.updateComplete
    expect(owner.shadowRoot!.querySelector('#native')).toBe(native)
    expect(native.style.color).toBe('blue')
    expect(native.style.getPropertyValue(property!)).toBe(initial)
    owner.setData({ style: '' })
    await owner.updateComplete
    expect(native.style.color).toBe('')
    expect(native.style.getPropertyValue(property!)).toBe(initial)
  })

  it('keeps independent loops with overlapping keys in their own template scopes', async () => {
    const owner = await mount('<input wx:for="{{left}}" wx:key="id" placeholder="left" /><input wx:for="{{right}}" wx:key="id" placeholder="right" />', {
      left: [{ id: 1 }],
      right: [{ id: 1 }],
    })
    const right = owner.shadowRoot!.querySelector('weapp-input[placeholder="right"]')!
    const input = right.shadowRoot!.querySelector('input')!
    input.value = 'right state'
    owner.setData({ left: [] })
    await owner.updateComplete
    expect(owner.shadowRoot!.querySelector('weapp-input[placeholder="right"]')).toBe(right)
    expect(input.value).toBe('right state')
  })

  it('retains a later input when a preceding conditional input disappears', async () => {
    const owner = await mount('<input wx:if="{{show}}" placeholder="left" /><input placeholder="right" />', { show: true })
    const right = owner.shadowRoot!.querySelector('weapp-input[placeholder="right"]')!
    const input = right.shadowRoot!.querySelector('input')!
    input.value = 'right state'
    owner.setData({ show: false })
    await owner.updateComplete
    expect(owner.shadowRoot!.querySelector('weapp-input[placeholder="right"]')).toBe(right)
    expect(input.value).toBe('right state')
  })

  it('replaces distinct conditional branches while treating a dynamic id as an ordinary attribute', async () => {
    const owner = await mount('<input wx:if="{{show}}" placeholder="left" /><input wx:else placeholder="right" /><input id="{{name}}" />', { show: true, name: 'before' })
    const left = owner.shadowRoot!.querySelector('weapp-input[placeholder="left"]')!
    left.shadowRoot!.querySelector('input')!.value = 'left state'
    const named = owner.shadowRoot!.querySelector('#before')!
    owner.setData({ show: false, name: 'after' })
    await owner.updateComplete
    const right = owner.shadowRoot!.querySelector('weapp-input[placeholder="right"]')!
    expect(right).not.toBe(left)
    expect(right.shadowRoot!.querySelector('input')!.value).toBe('')
    expect(owner.shadowRoot!.querySelector('#after')).toBe(named)
  })

  it('binds updated handlers before a controlled commit synchronously emits native events', async () => {
    const calls: string[] = []
    const owner = await mount('<scroll-view scroll-y="true" refresher-enabled="true" refresher-triggered="{{triggered}}" bindrefresherpulling="{{handler}}" />', {
      triggered: false,
      handler: 'old',
    }, {
      old() { calls.push('old') },
      next() { calls.push('next') },
    })
    owner.setData({ triggered: true, handler: 'next' })
    await owner.updateComplete
    expect(calls).toEqual(['next'])
  })

  it('keeps native input values through a real keyed reorder', async () => {
    const owner = await mount('<input wx:for="{{items}}" wx:key="id" data-id="{{item.id}}" />', {
      items: [{ id: 'a' }, { id: 'b' }],
    })
    const original = [...owner.shadowRoot!.querySelectorAll('weapp-input')]
    const inputs = original.map(host => host.shadowRoot!.querySelector('input')!)
    inputs[0]!.value = 'edited a'
    inputs[1]!.value = 'edited b'
    owner.setData({ items: [{ id: 'b' }, { id: 'a' }] })
    await owner.updateComplete
    expect([...owner.shadowRoot!.querySelectorAll('weapp-input')]).toEqual([original[1], original[0]])
    expect(original[0]!.shadowRoot!.querySelector('input')).toBe(inputs[0])
    expect(original[1]!.shadowRoot!.querySelector('input')).toBe(inputs[1])
    expect(inputs.map(input => input.value)).toEqual(['edited a', 'edited b'])
  })

  it('does not reconnect an unaffected child when deleting a preceding conditional sibling', async () => {
    const transitions: string[] = []
    const childTag = `legacy-child-lifecycle-${++sequence}`
    defineComponent(childTag, {
      template: createTemplate('<view />'),
      component: {
        properties: { name: { type: String } },
        lifetimes: {
          attached() { transitions.push(`attached:${this.properties.name}`) },
          detached() { transitions.push(`detached:${this.properties.name}`) },
        },
      },
    })
    const owner = await mount(`<${childTag} wx:if="{{show}}" name="left" /><${childTag} name="right" />`, { show: true })
    owner.setData({ show: false })
    await owner.updateComplete
    expect(transitions).toEqual(['attached:left', 'attached:right', 'detached:left'])
  })

  it('keeps arbitrary string renderers on the existing replacement path without inferring template identity', async () => {
    const tag = `legacy-raw-${++sequence}`
    defineComponent(tag, { template: data => `<span>${data.label}</span>`, component: { data: { label: 'before' } } })
    const owner = document.createElement(tag) as TestElement
    document.body.append(owner)
    await owner.updateComplete
    owner.setData({ label: 'after' })
    await owner.updateComplete
    expect(owner.shadowRoot!.querySelector('span')!.textContent).toBe('after')
  })
})
