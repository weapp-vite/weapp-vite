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

  it('prefers changedTouches, including an empty array, in dispatchEvent', async () => {
    const send = vi.fn(async () => ({}))
    const element = new Element({ send } as any, { elementId: 'touch-node', pageId: 7, tagName: 'view' }, new Map())
    await element.dispatchEvent({ eventName: 'touchend', changedTouches: [], changeTouches: [{ identifier: 1 }] })
    expect(send).toHaveBeenCalledWith('Element.dispatchEvent', { elementId: 'touch-node', pageId: 7, eventName: 'touchend', changedTouches: [] })
  })
})
