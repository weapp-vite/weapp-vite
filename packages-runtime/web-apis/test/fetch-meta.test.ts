import { describe, expect, it, vi } from 'vitest'
import { abortable } from '../src/fetch/abort'
import { resolveRequestMeta } from '../src/fetch/meta'
import { RequestPolyfill } from '../src/http'
import { getRequestBodyValue } from '../src/http/request'

describe('fetch body preparation', () => {
  it('honors an already aborted signal and still observes a rejected background operation', async () => {
    const controller = new AbortController()
    const reason = new Error('cancelled before preparation')
    controller.abort(reason)
    await expect(abortable(Promise.resolve('ignored'), controller.signal)).rejects.toBe(reason)
    await expect(abortable(Promise.reject(new Error('background failure')), controller.signal)).rejects.toBe(reason)
  })

  it('reads a request-like body stream directly without cloning it', async () => {
    const clone = vi.fn()
    const body = new ReadableStream<Uint8Array<ArrayBuffer>>({ start(controller) {
      controller.enqueue(new Uint8Array([65, 66]))
      controller.close()
    } })
    const input = { url: 'https://example.test/upload', method: 'POST', body, clone }
    const meta = await resolveRequestMeta(input)
    expect(new Uint8Array(meta.body as ArrayBuffer)).toEqual(new Uint8Array([65, 66]))
    expect(body.locked).toBe(false)
    expect(clone).not.toHaveBeenCalled()
  })

  it.each(['arrayBuffer', 'text'] as const)('consumes a request-like %s method before trying clone', async (method) => {
    const value = method === 'text' ? 'payload' : new Uint8Array([65]).buffer
    const read = vi.fn(async () => value)
    const clone = vi.fn()
    const input = { url: 'https://example.test/upload', method: 'POST', [method]: read, clone }
    const meta = await resolveRequestMeta(input)
    expect(meta.body).toEqual(value)
    expect(read).toHaveBeenCalledOnce()
    expect(clone).not.toHaveBeenCalled()
  })

  it('rejects an explicit upload stream before acquiring its reader', async () => {
    const getReader = vi.fn()
    await expect(resolveRequestMeta('https://example.test/upload', { method: 'POST', body: { getReader } }))
      .rejects
      .toThrow('Streaming request uploads are not supported')
    expect(getReader).not.toHaveBeenCalled()
  })

  it('keeps buffered request values readable until a consumer claims them', async () => {
    const input = new Uint8Array([0, 65, 0])
    const request = new RequestPolyfill('https://example.test/upload', { method: 'POST', body: input.subarray(1, 2) })
    const value = getRequestBodyValue(request)
    input.fill(0)
    expect(new Uint8Array(value as ArrayBuffer)).toEqual(new Uint8Array([65]))
    expect(request.bodyUsed).toBe(false)
    expect(getRequestBodyValue()).toBeUndefined()
    await expect(request.text()).resolves.toBe('A')
  })
})
