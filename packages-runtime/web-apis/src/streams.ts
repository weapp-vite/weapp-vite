import {
  ReadableStream as PonyfillReadableStream,
  TransformStream as PonyfillTransformStream,
  WritableStream as PonyfillWritableStream,
} from 'web-streams-polyfill'
import { nativeStreams } from './streams/native'
import { TextDecoderPolyfill } from './textCodec'

export const ReadableStreamPolyfill = PonyfillReadableStream as unknown as typeof globalThis.ReadableStream
export const WritableStreamPolyfill = PonyfillWritableStream as unknown as typeof globalThis.WritableStream
export const TransformStreamPolyfill = PonyfillTransformStream as unknown as typeof globalThis.TransformStream

export const usesNativeStreams = nativeStreams !== undefined

/** 三种构造器作为一组选择，防止原生流与兼容流混用时触发品牌检查失败。 */
export const ReadableStream = nativeStreams?.ReadableStream ?? ReadableStreamPolyfill
export const WritableStream = nativeStreams?.WritableStream ?? WritableStreamPolyfill
export const TransformStream = nativeStreams?.TransformStream ?? TransformStreamPolyfill

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
