import { REQUEST_GLOBAL_PLACEHOLDER_KEY } from '@weapp-core/constants'
import { afterEach, describe, expect, it, vi } from 'vitest'
import streamsPackage from 'web-streams-polyfill/package.json' with { type: 'json' }
import { ReadableStreamPolyfill, TextDecoderStreamPolyfill, TransformStreamPolyfill, WritableStreamPolyfill } from '../src/streams'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('Web Streams compatibility', () => {
  it('pins the dependency version used by the isolated disturbed-state adapter', () => {
    expect(streamsPackage.version).toBe('4.3.0')
  })
  it('provides compatible readable, writable and transform ponyfills', async () => {
    const values: number[] = []
    await new ReadableStreamPolyfill<number>({ start(controller) {
      controller.enqueue(2)
      controller.enqueue(3)
      controller.close()
    } }).pipeThrough(new TransformStreamPolyfill<number, number>({ transform(value, controller) {
      controller.enqueue(value * 2)
    } })).pipeTo(new WritableStreamPolyfill<number>({ write(value) { values.push(value) } }))
    expect(values).toEqual([4, 6])
  })

  it('selects the whole ponyfill family if one native constructor is missing or a placeholder', async () => {
    vi.stubGlobal('WritableStream', undefined)
    let streams = await import('../src/streams')
    expect(streams.ReadableStream).toBe(streams.ReadableStreamPolyfill)
    expect(streams.TransformStream).toBe(streams.TransformStreamPolyfill)
    vi.resetModules()
    vi.stubGlobal('WritableStream', Object.assign(() => {}, { [REQUEST_GLOBAL_PLACEHOLDER_KEY]: true }))
    streams = await import('../src/streams')
    expect(streams.ReadableStream).toBe(streams.ReadableStreamPolyfill)
    expect(streams.WritableStream).toBe(streams.WritableStreamPolyfill)
  })

  it('runs TextDecoderStream piping with all native Streams absent', async () => {
    vi.stubGlobal('ReadableStream', undefined)
    vi.stubGlobal('WritableStream', undefined)
    vi.stubGlobal('TransformStream', undefined)
    const streams = await import('../src/streams')
    expect(streams.usesNativeStreams).toBe(false)
    const values: string[] = []
    await new streams.ReadableStream<Uint8Array<ArrayBuffer>>({ start(controller) {
      controller.enqueue(new Uint8Array([0xE4]))
      controller.enqueue(new Uint8Array([0xB8, 0xAD]))
      controller.close()
    } }).pipeThrough(new streams.TextDecoderStreamPolyfill()).pipeTo(new streams.WritableStream<string>({ write(value) {
      values.push(value)
    } }))
    expect(values).toEqual(['中'])
  })

  it('rejects nonconstructible or incomplete host constructor groups', async () => {
    vi.stubGlobal('ReadableStream', () => ({}))
    let streams = await import('../src/streams')
    expect(streams.usesNativeStreams).toBe(false)
    vi.resetModules()
    vi.stubGlobal('ReadableStream', class IncompleteStream {})
    streams = await import('../src/streams')
    expect(streams.usesNativeStreams).toBe(false)
  })

  it('selects the ponyfill family when native Body state cannot be observed', async () => {
    vi.stubGlobal('Response', undefined)
    const streams = await import('../src/streams')
    expect(streams.usesNativeStreams).toBe(false)
    expect(streams.ReadableStream).toBe(streams.ReadableStreamPolyfill)
  })

  it('decodes streamed UTF-8 and flushes incomplete sequences through TextDecoderStream', async () => {
    const stream = new TextDecoderStreamPolyfill()
    const chunks: string[] = []
    const reading = stream.readable.pipeTo(new WritableStream<string>({ write(value) {
      chunks.push(value)
    } }))
    const writer = stream.writable.getWriter()
    await writer.write(new Uint8Array([0xEF, 0xBB]))
    await writer.write(new Uint8Array([0xBF, 0xE4, 0xB8]))
    await writer.write(new Uint8Array([0xAD, 0xF0, 0x9F]))
    await writer.write(new Uint8Array([0x99, 0x82, 0xE4]))
    await writer.close()
    await reading
    expect(chunks.join('')).toBe('中🙂\uFFFD')
    expect(stream.encoding).toBe('utf-8')
    expect(stream.fatal).toBe(false)
    expect(stream.ignoreBOM).toBe(false)
  })

  it('propagates fatal decoder errors to readers and writers', async () => {
    const stream = new TextDecoderStreamPolyfill('utf-8', { fatal: true })
    const reading = stream.readable.getReader().read()
    const writing = stream.writable.getWriter().write(new Uint8Array([0xFF]))
    await expect(reading).rejects.toBeInstanceOf(TypeError)
    await expect(writing).rejects.toBeInstanceOf(TypeError)
  })
})
