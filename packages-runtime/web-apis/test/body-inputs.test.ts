import { describe, expect, it, vi } from 'vitest'
import { RequestPolyfill, ResponsePolyfill } from '../src/http'
import { URLSearchParamsPolyfill } from '../src/url'

describe('Body input normalization', () => {
  it.each([() => new URLSearchParams('message=hello+world'), () => new URLSearchParamsPolyfill('message=hello+world')])('serializes search parameters and supplies their MIME type', async (create) => {
    const body = new ResponsePolyfill(create() as unknown as ConstructorParameters<typeof ResponsePolyfill>[0])
    expect(body.headers.get('content-type')).toBe('application/x-www-form-urlencoded;charset=UTF-8')
    await expect(body.text()).resolves.toBe('message=hello+world')
  })

  it('preserves surrogate pairs and replaces lone surrogates when normalizing arbitrary bodies', async () => {
    const body = new ResponsePolyfill({ toString: () => '\uD800A🙂\uDC00' } as unknown as ConstructorParameters<typeof ResponsePolyfill>[0])
    expect(body.headers.get('content-type')).toBe('text/plain;charset=UTF-8')
    await expect(body.text()).resolves.toBe('\uFFFDA🙂\uFFFD')
  })

  it('reads a caller-owned BlobLike that becomes a stream before its first pull', async () => {
    const source = new ReadableStream<Uint8Array<ArrayBuffer>>({ start(controller) {
      controller.enqueue(new Uint8Array([65, 66]))
      controller.close()
    } })
    const readBlob = vi.fn(async () => new Uint8Array([88]).buffer)
    const input = { size: 1, arrayBuffer: readBlob }
    const response = new ResponsePolyfill(input)
    await Promise.resolve()
    expect(readBlob).not.toHaveBeenCalled()
    Reflect.deleteProperty(input, 'arrayBuffer')
    Object.assign(input, { getReader: source.getReader.bind(source), tee: source.tee.bind(source) })
    Object.defineProperty(input, 'locked', { get: () => source.locked })

    await expect(response.text()).resolves.toBe('AB')
    expect(response.bodyUsed).toBe(true)
    expect(source.locked).toBe(false)
    expect(readBlob).not.toHaveBeenCalled()
  })

  it('transfers a cloned buffered request without turning it into an unsupported streaming upload', async () => {
    const original = new RequestPolyfill('https://example.test/upload', { method: 'POST', body: 'payload' })
    const clone = original.clone()
    const transferred = new RequestPolyfill(original)
    expect(original.bodyUsed).toBe(true)
    await expect(Promise.all([transferred.text(), clone.text()])).resolves.toEqual(['payload', 'payload'])
  })

  it.each([null, 'payload'])('inherits an untouched buffered body %j directly', async (body) => {
    const original = new RequestPolyfill('https://example.test/upload', { method: 'POST', body })
    const inherited = new RequestPolyfill(original)
    expect(original.bodyUsed).toBe(body !== null)
    expect(inherited.bodyUsed).toBe(false)
    await expect(inherited.text()).resolves.toBe(body ?? '')
    expect(inherited.bodyUsed).toBe(body !== null)
  })

  it('forwards producer errors and cancellation through inherited request streams', async () => {
    const failure = new Error('producer failed')
    const broken = new RequestPolyfill('https://example.test/upload', {
      method: 'POST',
      body: new ReadableStream<Uint8Array<ArrayBuffer>>({ start(controller) { controller.error(failure) } }),
    })
    const transferred = new RequestPolyfill(broken)
    await expect(transferred.text()).rejects.toBe(failure)
    expect(broken.bodyUsed).toBe(true)

    const reasons: unknown[] = []
    const original = new RequestPolyfill('https://example.test/upload', {
      method: 'POST',
      body: new ReadableStream<Uint8Array<ArrayBuffer>>({ cancel(reason) { reasons.push(reason) } }),
    })
    await new RequestPolyfill(original).body!.cancel('consumer stopped')
    expect(reasons).toEqual(['consumer stopped'])
  })
})
