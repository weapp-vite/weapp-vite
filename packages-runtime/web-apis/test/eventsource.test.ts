import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EventSourcePolyfill } from '../src/eventsource'

const fetchMock = vi.hoisted(() => vi.fn())
vi.mock('../src/fetch', () => ({ fetch: fetchMock }))

const sources: EventSourcePolyfill[] = []

function source() {
  const value = new EventSourcePolyfill('https://events.example.test/updates')
  sources.push(value)
  return value
}

function controlledResponse(contentType = 'text/event-stream; charset=utf-8') {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value
    },
  })
  return { controller, response: new Response(body, { headers: { 'content-type': contentType } }) }
}

function waitForOpen(value: EventSourcePolyfill) {
  return new Promise<void>(resolve => value.addEventListener('open', () => resolve(), { once: true }))
}

function waitForError(value: EventSourcePolyfill) {
  return new Promise<void>(resolve => value.addEventListener('error', () => resolve(), { once: true }))
}

beforeEach(() => {
  vi.useFakeTimers()
  fetchMock.mockReset()
})

afterEach(() => {
  for (const value of sources.splice(0)) {
    value.close()
  }
  vi.useRealTimers()
})

describe('EventSource', () => {
  it('delivers UTF-8 messages before EOF and exposes standard event metadata', async () => {
    const { response, controller } = controlledResponse()
    fetchMock.mockResolvedValue(response)
    const value = source()
    expect(value.readyState).toBe(EventSourcePolyfill.CONNECTING)
    await waitForOpen(value)
    expect(value.readyState).toBe(value.OPEN)
    const received = new Promise<MessageEvent<string>>(resolve => value.addEventListener('delta', event => resolve(event as MessageEvent<string>), { once: true }))
    const bytes = new TextEncoder().encode('id: 42\nevent: delta\ndata: 中文😀\n\n')
    for (const byte of bytes) {
      controller.enqueue(new Uint8Array([byte]))
    }
    const message = await received
    expect(message.data).toBe('中文😀')
    expect(message.lastEventId).toBe('42')
    expect(message.origin).toBe('https://events.example.test')
    expect(message.target).toBe(value)
    expect(fetchMock).toHaveBeenCalledWith(value.url, expect.objectContaining({ headers: { Accept: 'text/event-stream' }, miniProgram: { enableChunked: true } }))
    value.close()
    expect(value.readyState).toBe(value.CLOSED)
    expect(fetchMock.mock.calls[0]![1].signal.aborted).toBe(true)
  })

  it('reconnects using retry and id-only events, then clears an empty event ID', async () => {
    const first = controlledResponse()
    const second = controlledResponse()
    fetchMock.mockResolvedValueOnce(first.response).mockResolvedValueOnce(second.response).mockResolvedValue(new Response(null, { status: 204 }))
    const value = source()
    await waitForOpen(value)
    const disconnected = waitForError(value)
    first.controller.enqueue(new TextEncoder().encode('retry: 7\nid: resume\n\n'))
    first.controller.close()
    await disconnected
    expect(value.readyState).toBe(value.CONNECTING)
    const reopened = waitForOpen(value)
    await vi.advanceTimersByTimeAsync(7)
    await reopened
    expect(fetchMock.mock.calls[1]![1].headers['Last-Event-ID']).toBe('resume')
    const secondDisconnect = waitForError(value)
    second.controller.enqueue(new TextEncoder().encode('id:\n\n'))
    second.controller.close()
    await secondDisconnect
    await vi.advanceTimersByTimeAsync(7)
    expect(fetchMock.mock.calls[2]![1].headers).toEqual({ Accept: 'text/event-stream' })
    expect(value.readyState).toBe(value.CLOSED)
    await vi.advanceTimersByTimeAsync(30000)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it.each([204, 401, 429, 500])('closes permanently on HTTP %i', async (status) => {
    fetchMock.mockResolvedValue(new Response(null, { status }))
    const value = source()
    await waitForError(value)
    expect(value.readyState).toBe(value.CLOSED)
    await vi.advanceTimersByTimeAsync(30000)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('closes on an invalid MIME type and on unsupported streaming metadata', async () => {
    fetchMock.mockResolvedValueOnce(new Response('ordinary text', { headers: { 'content-type': 'text/plain' } }))
    const wrongMime = source()
    await waitForError(wrongMime)
    expect(wrongMime.readyState).toBe(wrongMime.CLOSED)
    const unsupported = new Error('Missing headers status code')
    unsupported.name = 'NotSupportedError'
    fetchMock.mockRejectedValueOnce(unsupported)
    const missingStatus = source()
    await waitForError(missingStatus)
    expect(missingStatus.readyState).toBe(missingStatus.CLOSED)
    await vi.advanceTimersByTimeAsync(30000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries network errors, and close prevents scheduled or pending reconnects', async () => {
    fetchMock.mockRejectedValue(new TypeError('connection reset'))
    const value = source()
    await waitForError(value)
    await vi.advanceTimersByTimeAsync(2999)
    expect(fetchMock).toHaveBeenCalledOnce()
    value.close()
    value.close()
    await vi.advanceTimersByTimeAsync(10000)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('reconnects after an established stream fails and honors close inside onerror', async () => {
    const first = controlledResponse()
    const second = controlledResponse()
    fetchMock.mockResolvedValueOnce(first.response).mockResolvedValueOnce(second.response)
    const value = source()
    await waitForOpen(value)
    const disconnected = waitForError(value)
    first.controller.error(new TypeError('stream interrupted'))
    await disconnected
    const reopened = waitForOpen(value)
    await vi.advanceTimersByTimeAsync(3000)
    await reopened
    const closed = new Promise<void>((resolve) => {
      value.onerror = () => {
        value.close()
        resolve()
      }
    })
    second.controller.error(new TypeError('stream interrupted again'))
    await closed
    await vi.advanceTimersByTimeAsync(30000)
    expect(value.readyState).toBe(value.CLOSED)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not start the deferred request when closed immediately', async () => {
    const value = source()
    value.close()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('cancels an in-progress connection without late open or error events', async () => {
    let resolve!: (response: Response) => void
    fetchMock.mockImplementation(() => new Promise<Response>((done) => {
      resolve = done
    }))
    const value = source()
    const onOpen = vi.fn()
    const onError = vi.fn()
    value.onopen = onOpen
    value.onerror = onError
    await Promise.resolve()
    value.close()
    const cancel = vi.fn()
    resolve(new Response(new ReadableStream({ cancel })))
    await vi.advanceTimersByTimeAsync(0)
    expect(cancel).toHaveBeenCalledOnce()
    expect(onOpen).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('supports once, listener removal, object listeners and close during an event', async () => {
    const { response, controller } = controlledResponse()
    fetchMock.mockResolvedValue(response)
    const value = source()
    const once = vi.fn()
    const removed = vi.fn()
    const object = { handleEvent: vi.fn() }
    value.addEventListener('message', once, { once: true })
    value.addEventListener('message', removed)
    value.removeEventListener('message', removed)
    value.addEventListener('message', object)
    let calls = 0
    const received = new Promise<void>((resolve) => {
      value.onmessage = () => {
        if (++calls === 2) {
          value.close()
          resolve()
        }
      }
    })
    await waitForOpen(value)
    controller.enqueue(new TextEncoder().encode('data: a\n\ndata: b\n\ndata: late\n\n'))
    await received
    expect(once).toHaveBeenCalledOnce()
    expect(removed).not.toHaveBeenCalled()
    expect(object.handleEvent).toHaveBeenCalledTimes(2)
    expect(calls).toBe(2)
  })

  it('rejects credentialed requests before making a network request', () => {
    expect(() => new EventSourcePolyfill('https://example.test', { withCredentials: true })).toThrow(expect.objectContaining({ name: 'NotSupportedError' }))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
