import { afterEach, describe, expect, it, vi } from 'vitest'

const NativeResponse = globalThis.Response
const nativeBodyUsed = Object.getOwnPropertyDescriptor(NativeResponse.prototype, 'bodyUsed')!.get!

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('native stream family validation', () => {
  it('falls back when Response exposes no bodyUsed getter', async () => {
    vi.stubGlobal('Response', class ResponseWithoutBodyState {})
    vi.resetModules()
    const streams = await import('../src/streams')
    expect(streams.usesNativeStreams).toBe(false)
    expect(streams.ReadableStream).toBe(streams.ReadableStreamPolyfill)
  })

  it('rejects a host Response that does not preserve its input stream', async () => {
    class ResponseWithoutBodyIdentity {
      body = null

      get bodyUsed() { return false }
    }
    vi.stubGlobal('Response', ResponseWithoutBodyIdentity)
    vi.resetModules()
    const streams = await import('../src/streams')
    expect(streams.usesNativeStreams).toBe(false)
  })

  it('rejects a host Response that does not observe reads as body consumption', async () => {
    class ResponseWithoutDisturbance extends NativeResponse {
      override get bodyUsed() { return false }
    }
    vi.stubGlobal('Response', ResponseWithoutDisturbance)
    vi.resetModules()
    const streams = await import('../src/streams')
    expect(streams.usesNativeStreams).toBe(false)
  })

  it('rejects stream-shaped objects outside the selected constructor family without locking them', async () => {
    const { ResponsePolyfill } = await import('../src/http')
    const getReader = vi.fn()
    const body = { getReader, tee: vi.fn(), locked: false }
    expect(() => new ResponsePolyfill(body as never)).toThrow('supported native or ponyfill ReadableStream')
    expect(getReader).not.toHaveBeenCalled()
    expect(body.locked).toBe(false)
  })

  it('treats a native stream as consumed if a later host Response construction fails', async () => {
    let constructions = 0
    class FailingLaterResponse extends NativeResponse {
      constructor(body: BodyInit | null) {
        super(body)
        if (++constructions > 1) {
          throw new Error('host no longer accepts streams')
        }
      }

      override get bodyUsed() { return nativeBodyUsed.call(this) }
    }
    vi.stubGlobal('Response', FailingLaterResponse)
    vi.resetModules()
    const { ResponsePolyfill } = await import('../src/http')
    const stream = new ReadableStream<Uint8Array<ArrayBuffer>>()
    expect(() => new ResponsePolyfill(stream)).toThrow('locked or has already been consumed')
    expect(stream.locked).toBe(false)
    await stream.cancel()
  })
})
