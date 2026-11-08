import { describe, expect, it, vi } from 'vitest'
import { PageStackRuntime } from '../src/runtime/polyfill/routeRuntime/stack'

describe('route stack forward input validation', () => {
  it('rejects an empty forward restoration and unknown page ids before mounting', () => {
    const mount = vi.fn()
    const stack = new PageStackRuntime(new Map(), mount)
    expect(stack.forward([])).toBe(false)
    expect(stack.forward([{ id: 'pages/unknown', query: {} }])).toBe(false)
    expect(stack.entries).toEqual([])
    expect(mount).not.toHaveBeenCalled()
  })
})
