import type Connection from './Connection'
import { describe, expect, it, vi } from 'vitest'
import Element from './Element'

describe('element dispatch event protocol', () => {
  it('delivers public input details through the host eventData field', async () => {
    const received = vi.fn()
    const send = vi.fn(async (_method: string, params: Record<string, unknown>) => {
      // 固定基础库的通用事件协议从 eventData 读取处理器可见的 detail。
      received(params.eventName, params.eventData ?? {})
      return {}
    })
    const element = new Element({ send } as unknown as Connection, { elementId: 'input-node', pageId: 7, tagName: 'input' }, new Map())

    await element.dispatchEvent({ eventName: 'input', detail: { value: 'boundary-input' } })

    expect(received).toHaveBeenCalledExactlyOnceWith('input', { value: 'boundary-input' })
    expect(send).toHaveBeenCalledExactlyOnceWith('Element.dispatchEvent', {
      elementId: 'input-node',
      pageId: 7,
      eventName: 'input',
      eventData: { value: 'boundary-input' },
    })
  })

  it.each([{}, { value: '', count: 0, selected: false, nested: { items: ['first', null] } }])('preserves event details and caller options without mutation (%j)', async (detail) => {
    const send = vi.fn(async () => ({}))
    const element = new Element({ send } as unknown as Connection, { elementId: 'custom-node', pageId: 7, tagName: 'view' }, new Map())
    const options = Object.freeze({ eventName: 'custom', $: '#child', detail: Object.freeze(detail) })

    await element.dispatchEvent(options)

    expect(send).toHaveBeenCalledExactlyOnceWith('Element.dispatchEvent', {
      elementId: 'custom-node',
      pageId: 7,
      eventName: 'custom',
      $: '#child',
      eventData: detail,
    })
    expect(options).toEqual({ eventName: 'custom', $: '#child', detail })
  })

  it('omits eventData when no detail is provided', async () => {
    const send = vi.fn(async () => ({}))
    const element = new Element({ send } as unknown as Connection, { elementId: 'custom-node', pageId: 7, tagName: 'view' }, new Map())

    await element.dispatchEvent({ eventName: 'custom' })

    expect(send).toHaveBeenCalledExactlyOnceWith('Element.dispatchEvent', {
      elementId: 'custom-node',
      pageId: 7,
      eventName: 'custom',
    })
  })

  it('preserves a host event failure without retrying another protocol', async () => {
    const failure = new Error('host event dispatch failed')
    const send = vi.fn(async () => {
      throw failure
    })
    const element = new Element({ send } as unknown as Connection, { elementId: 'input-node', pageId: 7, tagName: 'input' }, new Map())

    await expect(element.dispatchEvent({ eventName: 'input', detail: { value: 'boundary-input' } })).rejects.toBe(failure)

    expect(send).toHaveBeenCalledOnce()
  })
})
