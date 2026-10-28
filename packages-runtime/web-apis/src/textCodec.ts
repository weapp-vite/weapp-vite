import { REQUEST_GLOBAL_PLACEHOLDER_KEY } from '@weapp-core/constants'
import { encodeTextFallback, isArrayBufferLike } from './shared'
import { decodeUtf8 } from './textCodec/utf8'

type TextDecoderInput = AllowSharedBufferSource | undefined

/** 仅检测独立实例的增量 UTF-8 行为，不能把占位函数或单次解码器当作完整能力。 */
export function hasUsableTextDecoderConstructor(value: unknown): value is typeof globalThis.TextDecoder {
  if (typeof value !== 'function' || (value as unknown as Record<string, unknown>)[REQUEST_GLOBAL_PLACEHOLDER_KEY]) {
    return false
  }
  try {
    const decoder = new (value as typeof globalThis.TextDecoder)()
    return decoder.decode(new Uint8Array([0xE4]), { stream: true }) === ''
      && decoder.decode(new Uint8Array([0xB8, 0xAD, 0xF0, 0x9F]), { stream: true }) === '中'
      && decoder.decode(new Uint8Array([0x99, 0x82])) === '🙂'
      && decoder.decode(new Uint8Array([0xFF])) === '\uFFFD'
  }
  catch {
    return false
  }
}

function normalizeTextDecoderInput(input?: TextDecoderInput) {
  if (input === undefined) {
    return new Uint8Array(0)
  }
  if (isArrayBufferLike(input) || Object.prototype.toString.call(input) === '[object SharedArrayBuffer]') {
    return new Uint8Array(input as ArrayBufferLike)
  }
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
  }
  throw new TypeError('TextDecoder input must be an ArrayBuffer or ArrayBufferView')
}

export class TextEncoderPolyfill {
  readonly encoding = 'utf-8'

  encode(input = '') {
    const scalar = String(input).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g, value => value.length === 2 ? value : '\uFFFD')
    return new Uint8Array(encodeTextFallback(scalar))
  }
}

export class TextDecoderPolyfill {
  readonly encoding = 'utf-8'
  readonly fatal: boolean
  readonly ignoreBOM: boolean
  private pending = new Uint8Array(0)
  private streaming = false
  private bomSeen = false

  constructor(label = 'utf-8', options: TextDecoderOptions = {}) {
    const normalized = String(label).trim().toLowerCase()
    if (!['unicode-1-1-utf-8', 'unicode11utf8', 'unicode20utf8', 'utf-8', 'utf8', 'x-unicode20utf8'].includes(normalized)) {
      throw new RangeError(`Unsupported encoding: ${label}`)
    }
    this.fatal = Boolean(options.fatal)
    this.ignoreBOM = Boolean(options.ignoreBOM)
  }

  decode(input?: TextDecoderInput, options: TextDecodeOptions = {}) {
    const bytes = normalizeTextDecoderInput(input)
    if (!this.streaming) {
      this.pending = new Uint8Array(0)
      this.bomSeen = false
    }
    this.streaming = Boolean(options.stream)
    const combined = new Uint8Array(this.pending.byteLength + bytes.byteLength)
    combined.set(this.pending)
    combined.set(bytes, this.pending.byteLength)
    try {
      const result = decodeUtf8(combined, this.streaming, this.fatal)
      this.pending = result.pending
      let text = result.text
      if (!this.bomSeen && text.length > 0) {
        this.bomSeen = true
        if (!this.ignoreBOM && text.charCodeAt(0) === 0xFEFF) {
          text = text.slice(1)
        }
      }
      return text
    }
    catch (error) {
      this.pending = new Uint8Array(0)
      this.streaming = false
      throw error
    }
  }

  get [Symbol.toStringTag]() {
    return 'TextDecoder'
  }
}
