import { afterEach, describe, expect, it, vi } from 'vitest'
import { readBodyStream } from '../src/streams/readBody'

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('Body stream cancellation races', () => {
  it('supplies AbortError for a legacy aborted signal without a reason', async () => {
    const stream = new ReadableStream<Uint8Array<ArrayBuffer>>()
    const signal = { aborted: true, reason: undefined } as AbortSignal
    await expect(readBodyStream(stream, signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(stream.locked).toBe(false)
    await stream.cancel()
  })

  it('cancels only once when a host aborts synchronously while installing its listener', async () => {
    class SynchronousAbortSignal extends EventTarget {
      aborted = false
      reason = undefined

      override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean) {
        super.addEventListener(type, listener, options)
        this.aborted = true
        this.dispatchEvent(new Event('abort'))
      }
    }
    const cancel = vi.fn(() => {
      throw new Error('host cancellation failed')
    })
    const stream = new ReadableStream<Uint8Array<ArrayBuffer>>({ cancel })
    await expect(readBodyStream(stream, new SynchronousAbortSignal() as unknown as AbortSignal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(cancel).toHaveBeenCalledOnce()
    expect(stream.locked).toBe(false)
  })

  it('uses the object tag fallback when the host cannot expose the typed-array tag getter', async () => {
    const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype)
    const descriptor = Object.getOwnPropertyDescriptor
    const lookup = vi.spyOn(Object, 'getOwnPropertyDescriptor').mockImplementation((owner, key) => {
      return owner === typedArrayPrototype && key === Symbol.toStringTag ? undefined : descriptor(owner, key)
    })
    const { copyBodyChunk } = await import('../src/streams/readBody')
    lookup.mockRestore()
    const input = new Uint8Array([65, 66])
    const copy = copyBodyChunk(input)
    input[0] = 0
    expect(copy).toEqual(new Uint8Array([65, 66]))
    expect(() => copyBodyChunk(new DataView(new ArrayBuffer(1)))).toThrow('Uint8Array')
  })
})
