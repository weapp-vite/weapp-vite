import { describe, expect, it, vi } from 'vitest'
import Element from './Element'

describe('touch event protocol compatibility', () => {
  it.each(['touchstart', 'touchmove', 'touchend'] as const)('normalizes the legacy alias for %s without mutating caller options', async (method) => {
    const send = vi.fn(async () => ({}))
    const element = new Element({ send } as any, { elementId: 'touch-node', pageId: 7, tagName: 'view' }, new Map())
    const touch = { identifier: 1, pageX: 12, pageY: 34 }
    const options = { touches: [touch], changeTouches: [touch] }
    await element[method](options)
    expect(send).toHaveBeenCalledWith(`Element.${method}`, { elementId: 'touch-node', pageId: 7, touches: [touch], changedTouches: [touch] })
    expect(options).toEqual({ touches: [touch], changeTouches: [touch] })
  })

  it('preserves changedTouches for touch dispatches, including an empty array', async () => {
    const send = vi.fn(async () => ({}))
    const element = new Element({ send } as any, { elementId: 'touch-node', pageId: 7, tagName: 'view' }, new Map())
    await element.dispatchEvent({ eventName: 'touchend', changedTouches: [], changeTouches: [{ identifier: 1 }] })
    expect(send).toHaveBeenCalledWith('Element.touchend', { elementId: 'touch-node', pageId: 7, changedTouches: [] })
  })

  it('keeps generic dispatchEvent for selector and detail semantics', async () => {
    const send = vi.fn(async () => ({}))
    const element = new Element({ send } as any, { elementId: 'touch-node', pageId: 7, tagName: 'view' }, new Map())
    await element.dispatchEvent({ eventName: 'touchstart', $: '#child', touches: [], changedTouches: [], detail: { source: 'test' } })
    expect(send).toHaveBeenCalledWith('Element.dispatchEvent', {
      elementId: 'touch-node',
      pageId: 7,
      eventName: 'touchstart',
      $: '#child',
      touches: [],
      changedTouches: [],
      detail: { source: 'test' },
    })
  })
})
