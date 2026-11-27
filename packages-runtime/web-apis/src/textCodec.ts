import { encodeTextFallback, isArrayBufferLike } from './shared'
import { decodeUtf8 } from './textCodec/utf8'

export { hasUsableTextDecoderConstructor } from './globalPatch'

type TextDecoderInput = AllowSharedBufferSource | undefined

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
