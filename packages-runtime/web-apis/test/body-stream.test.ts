import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { RequestPolyfill, ResponsePolyfill } from '../src/http'
import { readBodyStream } from '../src/http/body'
import { ReadableStream, ReadableStreamPolyfill, WritableStream, WritableStreamPolyfill } from '../src/streams'

describe('streaming Body ownership', () => {
  it('rejects already disturbed native inputs, including reads through prototype methods', async () => {
    const source = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(new Uint8Array([65]))
      controller.close()
    } })
    const getReader = ReadableStream.prototype.getReader as (this: ReadableStream<Uint8Array>) => ReadableStreamDefaultReader<Uint8Array>
    const reader = getReader.call(source)
    await reader.read()
    reader.releaseLock()
    expect(() => new ResponsePolyfill(source)).toThrow(TypeError)
    const frozen = Object.freeze(new ReadableStream<Uint8Array>({ start(controller) {
      controller.close()
    } }))
    const body = new ResponsePolyfill(frozen)
    await expect(body.text()).resolves.toBe('')
    expect(body.bodyUsed).toBe(true)
  })

  it('tracks ponyfill readers, pipes, iteration and cancellation without relying on native Body state', async () => {
    const create = () => new ResponsePolyfill(new ReadableStreamPolyfill<Uint8Array>({ start(controller) {
      controller.enqueue(new Uint8Array([65]))
      controller.close()
    } }))
    const locked = create()
    const reader = locked.body!.getReader()
    expect(locked.bodyUsed).toBe(false)
    await reader.read()
    expect(locked.bodyUsed).toBe(true)
    reader.releaseLock()
    const piped = create()
    const piping = piped.body!.pipeTo(new WritableStreamPolyfill())
    expect(piped.bodyUsed).toBe(true)
    await piping
    const iterated = create()
    const iterator = iterated.body!.values({ preventCancel: true })
    expect(iterated.bodyUsed).toBe(false)
    await iterator.return?.()
    expect(iterated.bodyUsed).toBe(false)
    await expect(iterated.text()).resolves.toBe('A')
    const cancelled = create()
    await cancelled.body!.cancel()
    expect(cancelled.bodyUsed).toBe(true)
  })

  it('observes ponyfill prototype reads without altering user objects', async () => {
    const stream = new ReadableStreamPolyfill<Uint8Array>({ start(controller) {
      controller.enqueue(new Uint8Array([65]))
      controller.close()
    } })
    const keys = Reflect.ownKeys(stream)
    const response = new ResponsePolyfill(stream)
    expect(Reflect.ownKeys(stream)).toEqual(keys)
    const getReader = ReadableStreamPolyfill.prototype.getReader as (this: ReadableStream<Uint8Array>) => ReadableStreamDefaultReader<Uint8Array>
    const reader = getReader.call(stream)
    expect(response.bodyUsed).toBe(false)
    await reader.read()
    expect(response.bodyUsed).toBe(true)
    reader.releaseLock()
    expect(() => response.clone()).toThrow(TypeError)
    const sealed = new ReadableStreamPolyfill<Uint8Array>({ start(controller) {
      controller.close()
    } })
    // 兼容实现以自身属性保存运行状态，禁止新增属性足以捕获追踪器篡改。
    Object.preventExtensions(sealed)
    const untouched = new ResponsePolyfill(sealed)
    await expect(untouched.text()).resolves.toBe('')
    expect(untouched.bodyUsed).toBe(true)
    const frozen = Object.freeze(new ReadableStreamPolyfill({ start(controller) {
      controller.close()
    } }))
    const frozenBody = new ResponsePolyfill(frozen)
    expect(frozenBody.body).toBe(frozen)
    expect(frozenBody.bodyUsed).toBe(false)
  })

  it('reads cross-realm Uint8Array chunks and releases the consumer lock', async () => {
    const response = new ResponsePolyfill(new ReadableStream({ start(controller) {
      const bytes: unknown = runInNewContext('new Uint8Array([65, 66])')
      controller.enqueue(bytes)
      controller.close()
    } }))
    await expect(response.text()).resolves.toBe('AB')
    expect(response.bodyUsed).toBe(true)
    expect(response.body!.locked).toBe(false)
  })

  it.each([new Error('cancelled'), null])('cancels only the active reader and preserves abort reason %s', async (reason) => {
    const reasons: unknown[] = []
    const source = new ReadableStream<Uint8Array<ArrayBuffer>>({ cancel(reason) {
      reasons.push(reason)
    } })
    const controller = new AbortController()
    const reading = readBodyStream(source, controller.signal)
    expect(source.locked).toBe(true)
    controller.abort(reason)
    await expect(reading).rejects.toBe(reason)
    expect(reasons).toEqual([reason])
    expect(source.locked).toBe(false)
    const idle = new ReadableStream<Uint8Array<ArrayBuffer>>()
    await expect(readBodyStream(idle, controller.signal)).rejects.toBe(reason)
    expect(idle.locked).toBe(false)
    await idle.cancel()
  })

  it('delivers a pending chunk before the producer closes and distinguishes locked from disturbed', async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>
    const source = new ReadableStream<Uint8Array>({ start(value) {
      controller = value
    } })
    const response = new ResponsePolyfill(source)
    expect(response.body).toBe(source)
    const reader = response.body!.getReader()
    expect(response.bodyUsed).toBe(false)
    expect(() => response.clone()).toThrow(TypeError)
    await expect(response.text()).rejects.toBeInstanceOf(TypeError)
    const pending = reader.read()
    expect(response.bodyUsed).toBe(true)
    controller.enqueue(new Uint8Array([65]))
    await expect(pending).resolves.toEqual({ done: false, value: new Uint8Array([65]) })
    controller.close()
    await expect(reader.read()).resolves.toMatchObject({ done: true })
    reader.releaseLock()
    expect(() => response.clone()).toThrow(TypeError)
    await expect(response.bytes()).rejects.toBeInstanceOf(TypeError)
  })

  it('permits cloning after an unread reader releases its lock', async () => {
    const response = new ResponsePolyfill('hello')
    const original = response.body!
    original.getReader().releaseLock()
    const clone = response.clone()
    expect(original.locked).toBe(true)
    expect(response.body).not.toBe(original)
    expect(response.bodyUsed).toBe(false)
    expect(clone.bodyUsed).toBe(false)
    await expect(Promise.all([response.text(), clone.text()])).resolves.toEqual(['hello', 'hello'])
  })

  it.each([
    ['Response', () => new ResponsePolyfill('AB')],
    ['Request', () => new RequestPolyfill('https://example.test', { method: 'POST', body: 'AB' })],
  ] as const)('isolates %s clone bytes in both directions when read directly', async (_name, create) => {
    for (const mutateOriginal of [true, false]) {
      const original = create()
      const clone = original.clone()
      const changed = mutateOriginal ? original : clone
      const preserved = mutateOriginal ? clone : original
      const reader = changed.body!.getReader()
      const first = await reader.read()
      expect(first.done).toBe(false)
      first.value![0] = 90
      await expect(preserved.text()).resolves.toBe('AB')
      reader.releaseLock()
    }
  })

  it('clones producer-owned and empty byte chunks without transferring the producer buffer', async () => {
    const producer = new Uint8Array([65, 66])
    const response = new ResponsePolyfill(new ReadableStream<Uint8Array<ArrayBuffer>>({ start(controller) {
      controller.enqueue(new Uint8Array(0))
      controller.enqueue(producer)
      controller.close()
    } }))
    const clone = response.clone()
    const reader = response.body!.getReader()
    const first = await reader.read()
    expect(producer.byteLength).toBe(2)
    expect(Array.from(producer)).toEqual([65, 66])
    first.value![0] = 90
    await expect(clone.text()).resolves.toBe('AB')
    reader.releaseLock()
  })

  it('preserves byte isolation when the runtime uses the full ponyfill constructor family', async () => {
    vi.stubGlobal('ReadableStream', undefined)
    vi.stubGlobal('WritableStream', undefined)
    vi.stubGlobal('TransformStream', undefined)
    vi.stubGlobal('Response', undefined)
    vi.resetModules()
    try {
      const { ResponsePolyfill: PonyfillResponse } = await import('../src/http')
      for (const mutateOriginal of [true, false]) {
        const original = new PonyfillResponse('AB')
        const clone = original.clone()
        const reader = (mutateOriginal ? original : clone).body!.getReader()
        const value = await reader.read()
        value.value![0] = 90
        await expect((mutateOriginal ? clone : original).text()).resolves.toBe('AB')
        reader.releaseLock()
      }
    }
    finally {
      vi.unstubAllGlobals()
      vi.resetModules()
    }
  })

  it('keeps tee branches independent when one is cancelled and forwards cancellation only after both cancel', async () => {
    const reasons: unknown[] = []
    let controller!: ReadableStreamDefaultController<Uint8Array>
    const response = new ResponsePolyfill(new ReadableStream<Uint8Array>({
      start(value) { controller = value },
      cancel(reason) { reasons.push(reason) },
    }))
    const clone = response.clone()
    const cancel = response.body!.cancel('original')
    expect(response.bodyUsed).toBe(true)
    expect(reasons).toEqual([])
    controller.enqueue(new Uint8Array([65, 66]))
    controller.close()
    await expect(clone.text()).resolves.toBe('AB')
    await cancel
    expect(reasons).toEqual([])

    const second = new ResponsePolyfill(new ReadableStream<Uint8Array>({ cancel(reason) {
      reasons.push(reason)
    } }))
    const secondClone = second.clone()
    await Promise.all([second.body!.cancel('first'), secondClone.body!.cancel('second')])
    expect(reasons).toEqual([['first', 'second']])
  })

  it('propagates producer failures to both branches and rejects invalid byte chunks', async () => {
    const error = new Error('connection lost')
    const response = new ResponsePolyfill(new ReadableStream<Uint8Array>({ start(controller) {
      controller.error(error)
    } }))
    const clone = response.clone()
    await expect(response.text()).rejects.toBe(error)
    await expect(clone.text()).rejects.toBe(error)
    const invalid = new ResponsePolyfill(new ReadableStream({ start(controller) {
      controller.enqueue('text')
      controller.close()
    } }) as never)
    await expect(invalid.arrayBuffer()).rejects.toThrow('Uint8Array')
    expect(invalid.bodyUsed).toBe(true)
  })

  it('transfers stream Request ownership while keeping the new request readable', async () => {
    const request = new RequestPolyfill('https://example.test', { method: 'POST', body: new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(new Uint8Array([65]))
      controller.close()
    } }) })
    const transferred = new RequestPolyfill(request)
    expect(request.bodyUsed).toBe(true)
    expect(request.body!.locked).toBe(true)
    expect(transferred.bodyUsed).toBe(false)
    await expect(transferred.text()).resolves.toBe('A')
    await expect(request.text()).rejects.toBeInstanceOf(TypeError)
  })

  it('marks piping and async iteration as consumption without disturbing an unused iterator', async () => {
    const response = new ResponsePolyfill('pipe')
    const piping = response.body!.pipeTo(new WritableStream())
    expect(response.bodyUsed).toBe(true)
    await piping
    const iterated = new ResponsePolyfill('iterator')
    const iterator = iterated.body![Symbol.asyncIterator]()
    expect(iterated.bodyUsed).toBe(false)
    await iterator.next()
    expect(iterated.bodyUsed).toBe(true)
    await iterator.return?.()
  })

  it('distinguishes absent and zero-length streams and decodes invalid UTF-8 with replacement', async () => {
    const absent = new ResponsePolyfill()
    expect(absent.body).toBeNull()
    await expect(absent.text()).resolves.toBe('')
    expect(absent.bodyUsed).toBe(false)
    const empty = new ResponsePolyfill('')
    await expect(empty.body!.getReader().read()).resolves.toMatchObject({ done: true })
    expect(empty.bodyUsed).toBe(true)
    await expect(new ResponsePolyfill(new Uint8Array([0xFF])).text()).resolves.toBe('\uFFFD')
  })
})
