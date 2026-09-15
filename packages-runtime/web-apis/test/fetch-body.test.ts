import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetch } from '../src/fetch'
import { RequestPolyfill } from '../src/http'
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
  it('consumes Request once and keeps a pre-send clone independently readable', async () => {
    const input = new RequestPolyfill('https://example.test', { method: 'POST', body: 'hello' })
    const clone = input.clone()
    const first = fetch(input)
    expect(input.bodyUsed).toBe(true)
    await expect(fetch(input)).rejects.toBeInstanceOf(TypeError)
    await expect((await first).text()).resolves.toBe('ok')
    await expect(clone.text()).resolves.toBe('hello')
    expect(request).toHaveBeenCalledOnce()
    expect(request.mock.calls[0]![0].data).toBe('hello')
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
})
