import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetch } from '../src/fetch'
import { RequestPolyfill } from '../src/http'
import { ReadableStream } from '../src/streams'
import { BlobPolyfill, FilePolyfill, FormDataPolyfill } from '../src/web'

const request = vi.hoisted(() => vi.fn())
vi.mock('@wevu/api', () => ({ wpi: { request } }))

beforeEach(() => {
  request.mockReset()
  request.mockImplementation((options) => {
    options.success({ data: new Uint8Array([111, 107]).buffer, statusCode: 200, header: { 'content-type': 'text/plain' } })
    return { abort: vi.fn() }
  })
})

describe('fetch request body ownership', () => {
  it('rejects unbounded external request streams before locking, consuming or starting transport', async () => {
    const input = new RequestPolyfill('https://example.test', { method: 'POST', body: new ReadableStream<Uint8Array>() })
    const clone = input.clone()
    const transfer = new RequestPolyfill(clone)
    await expect(fetch(input)).rejects.toThrow('Streaming request uploads are not supported')
    await expect(fetch(transfer)).rejects.toThrow('Streaming request uploads are not supported')
    expect(input.bodyUsed).toBe(false)
    expect(input.body!.locked).toBe(false)
    expect(request).not.toHaveBeenCalled()
    await Promise.all([input.body!.cancel(), transfer.body!.cancel()])
  })
  it('consumes Request once and keeps a pre-send clone independently readable', async () => {
    const input = new RequestPolyfill('https://example.test', { method: 'POST', body: 'hello' })
    const clone = input.clone()
    const first = fetch(input)
    expect(input.bodyUsed).toBe(true)
    await expect(fetch(input)).rejects.toBeInstanceOf(TypeError)
    await expect((await first).text()).resolves.toBe('ok')
    await expect(clone.text()).resolves.toBe('hello')
    expect(request).toHaveBeenCalledOnce()
    expect(new TextDecoder().decode(request.mock.calls[0]![0].data)).toBe('hello')
  })

  it('consumes native Request input without consuming when init overrides the body', async () => {
    const input = new Request('https://example.test', { method: 'POST', body: 'native' })
    await fetch(input)
    expect(input.bodyUsed).toBe(true)
    await expect(fetch(input)).rejects.toBeInstanceOf(TypeError)
    const replaced = new RequestPolyfill('https://example.test', { method: 'POST', body: 'old' })
    await fetch(replaced, { body: 'new' })
    expect(replaced.bodyUsed).toBe(false)
    await expect(replaced.text()).resolves.toBe('old')
  })

  it('preserves multipart binary uploads through Request and rejects a second send', async () => {
    const form = new FormDataPolyfill()
    form.append('message', '中文')
    form.append('file', new FilePolyfill([new Uint8Array([0, 255, 65])], 'sample.bin', { type: 'application/octet-stream' }))
    const input = new RequestPolyfill('https://example.test', { method: 'POST', body: form })
    const response = await fetch(input)
    const options = request.mock.calls[0]![0]
    expect(options.header['content-type']).toMatch(/^multipart\/form-data; boundary=/)
    const payload = Array.from(new Uint8Array(options.data))
    expect(payload.some((byte, index) => byte === 0 && payload[index + 1] === 255 && payload[index + 2] === 65)).toBe(true)
    expect(await new BlobPolyfill([options.data]).text()).toContain('filename="sample.bin"')
    expect((await response.blob()).type).toBe('text/plain')
    await expect(fetch(input)).rejects.toBeInstanceOf(TypeError)
  })

  it('keeps cloned multipart bytes and declared boundaries consistent and snapshots entries', async () => {
    const form = new FormDataPolyfill()
    form.append('message', 'original')
    const input = new RequestPolyfill('https://example.test', {
      method: 'POST',
      body: form,
      headers: { 'content-type': 'multipart/form-data; boundary="explicit-boundary"' },
    })
    const clone = input.clone()
    form.set('message', 'changed')
    await fetch(input)
    const options = request.mock.calls[0]![0]
    expect(options.header['content-type']).toBe('multipart/form-data; boundary="explicit-boundary"')
    const payload = new TextDecoder().decode(options.data)
    expect(payload).toContain('--explicit-boundary\r\n')
    expect(payload).toContain('original')
    expect(payload).not.toContain('changed')
    await expect(clone.text()).resolves.toBe(payload)
  })
})
