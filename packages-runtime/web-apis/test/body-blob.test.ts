import { describe, expect, it, vi } from 'vitest'
import { HeadersPolyfill, RequestPolyfill, ResponsePolyfill } from '../src/http'
import { BlobPolyfill, FilePolyfill } from '../src/web'

describe('Body and Blob standard contracts', () => {
  it.each([
    ['Request', () => new RequestPolyfill('https://example.test', { method: 'POST', body: 'hello' })],
    ['Response', () => new ResponsePolyfill('hello')],
  ] as const)('%s rejects repeated consumption and cloning after consumption', async (_name, create) => {
    const body = create()
    const clone = body.clone()
    const first = body.text()
    expect(body.bodyUsed).toBe(true)
    await expect(body.arrayBuffer()).rejects.toBeInstanceOf(TypeError)
    await expect(first).resolves.toBe('hello')
    expect(() => body.clone()).toThrow(TypeError)
    await expect(clone.text()).resolves.toBe('hello')
  })

  it('keeps null bodies reusable but consumes zero-length bodies', async () => {
    const absent = new ResponsePolyfill(null)
    await expect(absent.text()).resolves.toBe('')
    expect(absent.bodyUsed).toBe(false)
    await expect(absent.text()).resolves.toBe('')
    for (const value of ['', new ArrayBuffer(0)]) {
      const body = new ResponsePolyfill(value)
      await body.text()
      expect(body.bodyUsed).toBe(true)
      await expect(body.text()).rejects.toBeInstanceOf(TypeError)
    }
  })

  it('preserves response MIME when reading a Blob', async () => {
    const response = new ResponsePolyfill('hello', { headers: { 'content-type': 'text/plain' } })
    expect((await response.blob()).type).toBe('text/plain')
  })

  it('snapshots UTF-8 bytes and the effective view range', async () => {
    const input = new Uint8Array([0, 65, 0])
    const blob = new BlobPolyfill(['中文🙂', input.subarray(1, 2)])
    input[1] = 66
    expect(blob.size).toBe(11)
    await expect(blob.text()).resolves.toBe('中文🙂A')
    expect((await blob.arrayBuffer()).byteLength).toBe(blob.size)
  })

  it('passes Headers callback owner and thisArg', () => {
    const headers = new HeadersPolyfill({ 'x-test': 'yes' })
    const context = {}
    const callback = vi.fn(function (this: unknown, value: string, key: string, owner: unknown) {
      expect(this).toBe(context)
      expect(owner).toBe(headers)
      expect([key, value]).toEqual(['x-test', 'yes'])
    })
    headers.forEach(callback, context)
    expect(callback).toHaveBeenCalledOnce()
  })
})

describe('Body conversion and ownership boundaries', () => {
  it('keeps failed reads consumed, including asynchronous Blob errors', async () => {
    const invalid = new ResponsePolyfill('{')
    await expect(invalid.json()).rejects.toBeInstanceOf(SyntaxError)
    await expect(invalid.text()).rejects.toBeInstanceOf(TypeError)
    const failed = new ResponsePolyfill({ size: 1, arrayBuffer: async () => {
      throw new Error('read failed')
    } })
    await expect(failed.bytes()).rejects.toThrow('read failed')
    expect(failed.bodyUsed).toBe(true)
    expect(() => failed.clone()).toThrow(TypeError)
  })

  it('transfers inherited Request bodies but keeps clone ownership independent', async () => {
    const request = new RequestPolyfill('https://example.test', { method: 'POST', body: 'hello' })
    const clone = request.clone()
    const copy = new RequestPolyfill(request)
    expect(request.bodyUsed).toBe(true)
    expect(clone.bodyUsed).toBe(false)
    expect(copy.bodyUsed).toBe(false)
    expect(() => new RequestPolyfill(request)).toThrow(TypeError)
    await expect(copy.text()).resolves.toBe('hello')
    await expect(clone.text()).resolves.toBe('hello')
    const replaced = new RequestPolyfill(request, { body: 'replacement' })
    await expect(replaced.text()).resolves.toBe('replacement')
  })

  it('implements Request json/blob/bytes and snapshots binary inputs', async () => {
    const request = new RequestPolyfill('https://example.test', { method: 'POST', body: '{"ok":true}', headers: { 'content-type': 'application/json' } })
    const json = request.clone()
    expect((await request.blob()).type).toBe('application/json')
    await expect(json.json()).resolves.toEqual({ ok: true })
    const input = new Uint8Array([65])
    const response = new ResponsePolyfill(input)
    const copy = response.clone()
    input[0] = 66
    const bytes = await response.bytes()
    bytes[0] = 67
    await expect(copy.text()).resolves.toBe('A')
  })

  it('supports ponyfill blob() when the global constructor is absent', async () => {
    vi.stubGlobal('Blob', undefined)
    try {
      const response = new ResponsePolyfill('hello', { headers: { 'content-type': 'TEXT/PLAIN' } })
      const blob = await response.blob()
      expect(blob).toBeInstanceOf(BlobPolyfill)
      expect(blob.type).toBe('text/plain')
      await expect(blob.text()).resolves.toBe('hello')
    }
    finally {
      vi.unstubAllGlobals()
    }
  })

  it('preserves error response metadata when cloned', () => {
    expect(ResponsePolyfill.error().clone()).toMatchObject({ status: 0, type: 'error', ok: false })
  })
})

describe('Blob slicing and byte contracts', () => {
  it.each([
    [0, undefined, 'abcdef'],
    [1, 4, 'bcd'],
    [-3, -1, 'de'],
    [-100, 100, 'abcdef'],
    [4, 1, ''],
    [100, undefined, ''],
    [Number.NaN, 2, 'ab'],
    [1.8, 3.9, 'bc'],
    [-Infinity, Infinity, 'abcdef'],
  ])('slices across segments (%s, %s)', async (start, end, expected) => {
    const blob = new BlobPolyfill(['ab', new BlobPolyfill(['cd']), new Uint8Array([101, 102])], { type: 'TEXT/PLAIN' })
    const slice = blob.slice(start, end, 'APPLICATION/OCTET-STREAM')
    expect(slice.size).toBe(expected.length)
    expect(slice.type).toBe('application/octet-stream')
    await expect(slice.text()).resolves.toBe(expected)
    expect(blob.type).toBe('text/plain')
    expect(blob.slice().type).toBe('')
  })

  it('keeps repeated byte reads independent and normalizes scalar strings and MIME', async () => {
    const blob = new BlobPolyfill(['\uD800', '🙂'])
    expect(blob.size).toBe(7)
    const first = await blob.bytes()
    const second = await blob.bytes()
    first.fill(0)
    expect(second[0]).toBe(0xEF)
    expect(new BlobPolyfill([], { type: 'text/中文' }).type).toBe('')
    expect(new BlobPolyfill([], { type: 'TEXT/PLAIN\n' }).type).toBe('')
  })

  it('slices File and native Blob parts without changing File metadata', async () => {
    const file = new FilePolyfill([new Blob(['abcd'])], 'file.txt', { type: 'TEXT/PLAIN', lastModified: 123 })
    expect(file.name).toBe('file.txt')
    expect(file.lastModified).toBe(123)
    expect(file.size).toBe(4)
    const slice = file.slice(1, -1)
    expect(slice).toBeInstanceOf(BlobPolyfill)
    expect(slice).not.toBeInstanceOf(FilePolyfill)
    await expect(slice.text()).resolves.toBe('bc')
    expect(Object.prototype.toString.call(file)).toBe('[object File]')
  })

  it('preserves asynchronous BlobLike inputs without claiming a known synchronous size', async () => {
    const blob = new BlobPolyfill([{ type: 'text/plain', arrayBuffer: async () => new Uint8Array([65]).buffer }])
    expect(blob.size).toBe(0)
    await expect(blob.text()).resolves.toBe('A')
  })
})
