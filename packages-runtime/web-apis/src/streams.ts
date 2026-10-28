import { REQUEST_GLOBAL_PLACEHOLDER_KEY } from '@weapp-core/constants'
import {
  ReadableStream as PonyfillReadableStream,
  TransformStream as PonyfillTransformStream,
  WritableStream as PonyfillWritableStream,
} from 'web-streams-polyfill'
import { TextDecoderPolyfill } from './textCodec'

export const ReadableStreamPolyfill = PonyfillReadableStream as unknown as typeof globalThis.ReadableStream
export const WritableStreamPolyfill = PonyfillWritableStream as unknown as typeof globalThis.WritableStream
export const TransformStreamPolyfill = PonyfillTransformStream as unknown as typeof globalThis.TransformStream

function isUsableConstructor(value: unknown) {
  return typeof value === 'function'
    && !(value as unknown as Record<string, unknown>)[REQUEST_GLOBAL_PLACEHOLDER_KEY]
}

function hasUsableNativeStreams() {
  if (![globalThis.ReadableStream, globalThis.WritableStream, globalThis.TransformStream].every(isUsableConstructor)) {
    return false
  }
  try {
    const readable = new globalThis.ReadableStream({ start(controller) {
      controller.close()
    } })
    const writable = new globalThis.WritableStream()
    const transform = new globalThis.TransformStream()
    const bodyUsed = typeof globalThis.Response === 'function' ? Object.getOwnPropertyDescriptor(globalThis.Response.prototype, 'bodyUsed')?.get : undefined
    if (!bodyUsed || !isUsableConstructor(globalThis.Response)) {
      return false
    }
    const response = new globalThis.Response(readable)
    const compatible = typeof readable.getReader === 'function'
      && typeof readable.tee === 'function'
      && typeof readable.pipeThrough === 'function'
      && typeof writable.getWriter === 'function'
      && typeof writable.abort === 'function'
      && transform.readable instanceof globalThis.ReadableStream
      && transform.writable instanceof globalThis.WritableStream
      && response.body === readable
      && bodyUsed.call(response) === false
    if (!compatible) {
      return false
    }
    const reader = readable.getReader()
    void reader.read()
    const disturbed = bodyUsed.call(response) === true
    reader.releaseLock()
    return disturbed
  }
  catch {
    return false
  }
}

export const usesNativeStreams = hasUsableNativeStreams()

/** 三种构造器作为一组选择，防止原生流与兼容流混用时触发品牌检查失败。 */
export const ReadableStream = usesNativeStreams ? globalThis.ReadableStream : ReadableStreamPolyfill
export const WritableStream = usesNativeStreams ? globalThis.WritableStream : WritableStreamPolyfill
export const TransformStream = usesNativeStreams ? globalThis.TransformStream : TransformStreamPolyfill

export class TextDecoderStreamPolyfill {
  readonly readable: globalThis.ReadableStream<string>
  readonly writable: globalThis.WritableStream<BufferSource>
  private readonly decoder: TextDecoderPolyfill

  constructor(label = 'utf-8', options: TextDecoderOptions = {}) {
    this.decoder = new TextDecoderPolyfill(label, options)
    const transform = new TransformStream<BufferSource, string>({
      transform: (chunk, controller) => {
        const text = this.decoder.decode(chunk, { stream: true })
        if (text) {
          controller.enqueue(text)
        }
      },
      flush: (controller) => {
        const text = this.decoder.decode()
        if (text) {
          controller.enqueue(text)
        }
      },
    })
    this.readable = transform.readable
    this.writable = transform.writable
  }

  get encoding() {
    return this.decoder.encoding
  }

  get fatal() {
    return this.decoder.fatal
  }

  get ignoreBOM() {
    return this.decoder.ignoreBOM
  }

  get [Symbol.toStringTag]() {
    return 'TextDecoderStream'
  }
}
