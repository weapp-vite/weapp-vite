import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventSourcePolyfill } from '../src/eventsource'
import { EventSourceEvent, EventSourceEventTarget, MessageEventPolyfill } from '../src/eventsource/events'

const fetchMock = vi.hoisted(() => vi.fn())
vi.mock('../src/fetch', () => ({ fetch: fetchMock }))

class MessageTarget extends EventSourceEventTarget {
  onmessage: EventListener | null = null
}

function message(init: EventInit = {}) {
  return new EventSourceEvent('message', init) as unknown as Event
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe('EventSource event listeners', () => {
  it('ignores null callbacks, missing removals and duplicate registrations with the same capture flag', () => {
    const target = new MessageTarget()
    const listener = vi.fn()
    target.addEventListener('message', null)
    target.removeEventListener('message', null)
    target.removeEventListener('missing', listener)
    target.addEventListener('message', listener)
    target.addEventListener('message', listener, { capture: false, once: true })
    target.dispatchEvent(message())
    target.dispatchEvent(message())
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('distinguishes capture registrations and removes only the matching registration', () => {
    const target = new MessageTarget()
    const listener = vi.fn()
    target.addEventListener('message', listener, true)
    target.addEventListener('message', listener, { capture: false })
    target.removeEventListener('message', listener, { capture: true })
    target.dispatchEvent(message())
    expect(listener).toHaveBeenCalledOnce()
    target.removeEventListener('message', listener, false)
    target.dispatchEvent(message())
    expect(listener).toHaveBeenCalledOnce()
  })

  it('ignores already aborted signals and removes active signal registrations when aborted', () => {
    const target = new MessageTarget()
    const aborted = new AbortController()
    const active = new AbortController()
    const ignored = vi.fn()
    const listener = vi.fn()
    aborted.abort()
    target.addEventListener('message', ignored, { signal: aborted.signal })
    target.addEventListener('message', listener, { signal: active.signal, capture: true })
    target.dispatchEvent(message())
    active.abort()
    target.dispatchEvent(message())
    expect(ignored).not.toHaveBeenCalled()
    expect(listener).toHaveBeenCalledOnce()
  })

  it('removes a once capture listener before a nested dispatch', () => {
    const target = new MessageTarget()
    const controller = new AbortController()
    const removeAbort = vi.spyOn(controller.signal, 'removeEventListener')
    const listener = vi.fn(() => target.dispatchEvent(message()))
    target.addEventListener('message', listener, { capture: true, once: true, signal: controller.signal })
    target.dispatchEvent(message())
    expect(listener).toHaveBeenCalledOnce()
    expect(removeAbort).toHaveBeenCalledWith('abort', expect.any(Function))
    controller.abort()
    expect(listener).toHaveBeenCalledOnce()
  })

  it('honors removal during dispatch and defers newly added listeners to the next event', () => {
    const target = new MessageTarget()
    const calls: string[] = []
    const removed = () => calls.push('removed')
    const added = () => calls.push('added')
    target.addEventListener('message', () => {
      calls.push('first')
      target.removeEventListener('message', removed)
      target.addEventListener('message', added)
    }, { once: true })
    target.addEventListener('message', removed)
    target.dispatchEvent(message())
    expect(calls).toEqual(['first'])
    target.dispatchEvent(message())
    expect(calls).toEqual(['first', 'added'])
  })

  it('binds function and object listeners and resets currentTarget after dispatch', () => {
    const target = new MessageTarget()
    const receivers: unknown[] = []
    const payload = message({ cancelable: true })
    target.addEventListener('message', function (this: MessageTarget, event) {
      receivers.push(this)
      expect(event.target).toBe(target)
      expect(event.currentTarget).toBe(target)
      event.preventDefault()
    })
    const object = {
      handleEvent(event: Event) {
        receivers.push(this)
        expect(event).toBe(payload)
      },
    }
    target.addEventListener('message', object)
    expect(target.dispatchEvent(payload)).toBe(false)
    expect(receivers).toEqual([target, object])
    expect(payload.target).toBe(target)
    expect(payload.currentTarget).toBeNull()
    expect(target.dispatchEvent(new EventSourceEvent('other') as unknown as Event)).toBe(true)
  })

  it.each([false, true])('stopImmediatePropagation=%s controls subsequent listeners and the property handler', (immediate) => {
    const target = new MessageTarget()
    const calls: string[] = []
    target.addEventListener('message', (event) => {
      calls.push('first')
      if (immediate) {
        event.stopImmediatePropagation()
      }
      else {
        event.stopPropagation()
      }
    })
    target.addEventListener('message', () => calls.push('second'))
    target.onmessage = () => calls.push('handler')
    const payload = message()
    target.dispatchEvent(payload)
    expect(calls).toEqual(immediate ? ['first'] : ['first', 'second', 'handler'])
    expect(payload.cancelBubble).toBe(true)
    expect(payload.currentTarget).toBeNull()
  })

  it('reports listener and property handler errors without stopping dispatch', () => {
    const reportError = vi.fn()
    vi.stubGlobal('reportError', reportError)
    const target = new MessageTarget()
    const listenerFailure = new Error('listener failed')
    const handlerFailure = new Error('handler failed')
    const next = vi.fn()
    target.addEventListener('message', () => {
      throw listenerFailure
    })
    target.addEventListener('message', next)
    target.onmessage = () => {
      throw handlerFailure
    }
    expect(target.dispatchEvent(message())).toBe(true)
    expect(next).toHaveBeenCalledOnce()
    expect(reportError.mock.calls).toEqual([[listenerFailure], [handlerFailure]])
  })

  it('reports errors in a later task when the host does not provide reportError', () => {
    vi.useFakeTimers()
    vi.stubGlobal('reportError', undefined)
    const target = new MessageTarget()
    const failure = new Error('asynchronous listener failure')
    const next = vi.fn()
    target.addEventListener('message', () => {
      throw failure
    })
    target.addEventListener('message', next)
    expect(target.dispatchEvent(message())).toBe(true)
    expect(next).toHaveBeenCalledOnce()
    expect(() => vi.runOnlyPendingTimers()).toThrow(failure)
  })

  it('provides empty defaults for MessageEvent metadata', () => {
    const payload = new MessageEventPolyfill('message')
    expect(payload.data).toBeUndefined()
    expect(payload.origin).toBe('')
    expect(payload.lastEventId).toBe('')
    expect(payload.source).toBeNull()
    expect(payload.ports).toEqual([])
  })

  it('ignores a request rejection after close without dispatching a transport error', async () => {
    let rejectConnection!: (reason: unknown) => void
    fetchMock.mockImplementation(() => new Promise((_, reject) => {
      rejectConnection = reject
    }))
    const source = new EventSourcePolyfill('https://events.example.test/updates')
    const onError = vi.fn()
    source.onerror = onError
    try {
      await Promise.resolve()
      source.close()
      rejectConnection(new Error('connection failed after close'))
      await Promise.resolve()
      await Promise.resolve()
      expect(source.readyState).toBe(source.CLOSED)
      expect(onError).not.toHaveBeenCalled()
      expect(fetchMock).toHaveBeenCalledOnce()
    }
    finally {
      source.close()
    }
  })
})
