import { describe, expect, it } from 'vitest'
import { ReadableStreamPolyfill, WritableStreamPolyfill } from '../src/streams'
import { isPonyfillStream, isPonyfillStreamDisturbed } from '../src/streams/ponyfillState'

describe('isolated ponyfill disturbed-state compatibility', () => {
  it('accepts the pinned ponyfill brand and rejects unrelated streams and duck types', () => {
    const ponyfill = new ReadableStreamPolyfill()
    expect(isPonyfillStream(ponyfill)).toBe(true)
    expect(isPonyfillStreamDisturbed(ponyfill)).toBe(false)
    for (const stream of [new globalThis.ReadableStream(), new WritableStreamPolyfill(), { _disturbed: false }]) {
      expect(isPonyfillStream(stream)).toBe(false)
      expect(() => isPonyfillStreamDisturbed(stream as ReadableStream)).toThrow('Expected a web-streams-polyfill ReadableStream')
    }
  })

  it.each([undefined, null, 0, 'false'])('rejects changed state layout %s on a genuine ponyfill', (value) => {
    const stream = new ReadableStreamPolyfill()
    Object.defineProperty(stream, '_disturbed', { value })
    expect(isPonyfillStream(stream)).toBe(true)
    expect(() => isPonyfillStreamDisturbed(stream)).toThrow('Unsupported web-streams-polyfill state layout; expected version 4.5.1')
  })

  it('keeps an unread stream undisturbed while its reader acquires and releases the lock', () => {
    const stream = new ReadableStreamPolyfill()
    const reader = stream.getReader()
    expect(stream.locked).toBe(true)
    expect(isPonyfillStreamDisturbed(stream)).toBe(false)
    reader.releaseLock()
    expect(stream.locked).toBe(false)
    expect(isPonyfillStreamDisturbed(stream)).toBe(false)
  })

  it('observes a pending default read before a chunk arrives and after lock release', async () => {
    let controller!: ReadableStreamDefaultController<string>
    const stream = new ReadableStreamPolyfill<string>({ start(value) {
      controller = value
    } })
    const reader = stream.getReader()
    const reading = reader.read()
    expect(isPonyfillStreamDisturbed(stream)).toBe(true)
    controller.enqueue('chunk')
    controller.close()
    await expect(reading).resolves.toEqual({ done: false, value: 'chunk' })
    reader.releaseLock()
    expect(isPonyfillStreamDisturbed(stream)).toBe(true)
  })

  it('observes cancellation immediately and retains the underlying cancellation reason', async () => {
    const reasons: unknown[] = []
    const stream = new ReadableStreamPolyfill({ cancel(reason) {
      reasons.push(reason)
    } })
    const reason = new Error('cancelled')
    const cancelling = stream.cancel(reason)
    expect(isPonyfillStreamDisturbed(stream)).toBe(true)
    await cancelling
    expect(reasons).toEqual([reason])
  })

  it('observes a pending BYOB read without treating its unread reader as consumption', async () => {
    let controller!: ReadableByteStreamController
    const stream = new ReadableStreamPolyfill({ type: 'bytes', start(value) {
      controller = value
    } })
    const reader = stream.getReader({ mode: 'byob' })
    expect(isPonyfillStreamDisturbed(stream)).toBe(false)
    const reading = reader.read(new Uint8Array(1))
    expect(isPonyfillStreamDisturbed(stream)).toBe(true)
    controller.enqueue(new Uint8Array([65]))
    controller.close()
    await expect(reading).resolves.toEqual({ done: false, value: new Uint8Array([65]) })
    reader.releaseLock()
    expect(isPonyfillStreamDisturbed(stream)).toBe(true)
  })

  it('observes piping and async iteration through the same pinned state protocol', async () => {
    const create = () => new ReadableStreamPolyfill<string>({ start(controller) {
      controller.enqueue('chunk')
      controller.close()
    } })
    const piped = create()
    const piping = piped.pipeTo(new WritableStreamPolyfill())
    expect(isPonyfillStreamDisturbed(piped)).toBe(true)
    await piping
    const iterated = create()
    const iterator = iterated.values({ preventCancel: true })
    expect(isPonyfillStreamDisturbed(iterated)).toBe(false)
    await expect(iterator.next()).resolves.toEqual({ done: false, value: 'chunk' })
    expect(isPonyfillStreamDisturbed(iterated)).toBe(true)
    await iterator.return?.()
  })
})
