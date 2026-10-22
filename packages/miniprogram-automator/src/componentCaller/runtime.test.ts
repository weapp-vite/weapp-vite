import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCallerHarness } from './testHelpers'

describe('exact component caller runtime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('getCurrentPages', () => [{ __wxWebviewId__: 3 }])
  })
  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function ready(harness: ReturnType<typeof createCallerHarness>) {
    harness.session.arm()
    harness.emit()
    expect(harness.session.disarm()).toMatchObject({ state: 'ready', removed: true, matchingInvocations: 1 })
  }

  it('uses the exact raw caller once after removing only its own callback', () => {
    const harness = createCallerHarness()
    const unrelated = vi.fn()
    harness.listeners.add(unrelated)
    ready(harness)

    expect(harness.session.invoke('mark', ['value'])).toBe('component:value')
    expect(harness.caller.mark).toHaveBeenCalledExactlyOnceWith('value')
    expect(harness.listeners).toEqual(new Set([unrelated]))
    expect(() => harness.session.invoke('mark', ['again'])).toThrow('not ready')
    expect(harness.caller.mark).toHaveBeenCalledOnce()
    expect(harness.session.dispose()).toMatchObject({ state: 'disposed', removed: true })
    harness.session.dispose()
    expect(harness.bridge.removeSubscribeListener).toHaveBeenCalledOnce()
    expect(harness.bridge.subscribe).not.toHaveBeenCalled()
  })

  it.each([
    { method: 'resolveComponentCaller', callbackId: 8, params: { nodeId: 'virtual-node', webviewId: 3 } },
    { method: 'resolveComponentCaller', callbackId: 8, params: [{ nodeId: 'virtual-node', webviewId: 4 }] },
    { method: 'resolveComponentCaller', callbackId: 0, params: [{ nodeId: 'virtual-node', webviewId: 3 }] },
  ])('rejects malformed or mismatched resolver payload before business dispatch', (message) => {
    const harness = createCallerHarness()
    harness.session.arm()
    harness.emit(message)
    expect(() => harness.session.disarm()).toThrow('resolution failed')
    expect(harness.caller.mark).not.toHaveBeenCalled()
    harness.session.dispose()
  })

  it('refuses two same-page resolver messages instead of selecting the first caller', () => {
    const harness = createCallerHarness()
    harness.session.arm()
    harness.emit()
    harness.emit()
    expect(() => harness.session.disarm()).toThrow('resolution failed')
    expect(harness.caller.mark).not.toHaveBeenCalled()
    harness.session.dispose()
  })

  it.each(['page', 'node', 'caller', 'bridge'] as const)('rechecks %s identity in the same invocation', (change) => {
    const harness = createCallerHarness()
    ready(harness)
    if (change === 'page') {
      vi.stubGlobal('getCurrentPages', () => [{ __wxWebviewId__: 4 }])
    }
    else if (change === 'node') {
      harness.replaceNode()
    }
    else if (change === 'caller') {
      harness.replaceCaller()
    }
    else {
      harness.bridge.subscribe = vi.fn()
    }
    expect(() => harness.session.invoke('mark', ['value'])).toThrow(/changed|not ready/)
    expect(harness.caller.mark).not.toHaveBeenCalled()
    harness.session.dispose()
  })

  it.each(['undefined', 'promise', 'throw'] as const)('preserves synchronous %s dispatch semantics without retry', (kind) => {
    const harness = createCallerHarness()
    const promise = Promise.resolve('eventual-value')
    harness.caller.mark.mockImplementation(() => {
      if (kind === 'throw') {
        throw new Error('business failure')
      }
      return kind === 'promise' ? promise : undefined
    })
    ready(harness)
    if (kind === 'throw') {
      expect(() => harness.session.invoke('mark', ['value'])).toThrow('business failure')
    }
    else {
      expect(harness.session.invoke('mark', ['value'])).toBe(kind === 'promise' ? promise : undefined)
    }
    expect(() => harness.session.invoke('mark', ['again'])).toThrow('not ready')
    expect(harness.caller.mark).toHaveBeenCalledOnce()
    harness.session.dispose()
  })

  it('does not reflect on a caller whose descriptor trap is incompatible with the SDK proxy', () => {
    const harness = createCallerHarness()
    harness.exparser.Element.getMethodCaller.mockImplementation(() => new Proxy(harness.caller, {
      getOwnPropertyDescriptor() { throw new Error('SDK descriptor invariant') },
    }))
    const caller = harness.exparser.Element.getMethodCaller()
    harness.exparser.Element.getMethodCaller.mockReturnValue(caller)
    ready(harness)
    expect(harness.session.invoke('mark', ['value'])).toBe('component:value')
    expect(harness.caller.mark).toHaveBeenCalledOnce()
    harness.session.dispose()
  })

  it('cannot dispatch after removal failed, and exact disposal can retry cleanup', () => {
    const harness = createCallerHarness()
    harness.session.arm()
    harness.emit()
    harness.bridge.removeSubscribeListener.mockImplementationOnce(() => {
      throw new Error('remove failed')
    })
    expect(() => harness.session.disarm()).toThrow('remove failed')
    expect(() => harness.session.invoke('mark', ['value'])).toThrow('not ready')
    harness.session.dispose()
    expect(harness.listeners.size).toBe(0)
    expect(harness.caller.mark).not.toHaveBeenCalled()
  })

  it('removes only its own listener after disconnect prevents cleanup RPC', () => {
    const harness = createCallerHarness()
    const unrelated = vi.fn()
    harness.listeners.add(unrelated)
    harness.session.arm()
    const own = harness.bridge.addSubscribeListener.mock.calls[0]![1]
    vi.advanceTimersByTime(10_000)
    expect(harness.listeners).toEqual(new Set([unrelated]))
    expect(harness.session.snapshot().state).toBe('disposed')
    own({}, 3)
    expect(harness.session.snapshot().totalInvocations).toBe(1)
    expect(() => harness.session.invoke('mark', ['value'])).toThrow('not ready')
    expect(harness.caller.mark).not.toHaveBeenCalled()
  })
})
