import { decodeTextFallback, encodeTextFallback } from './shared'

type TextDecoderInput = ArrayBuffer | ArrayBufferView | null | undefined

function normalizeTextDecoderInput(input?: TextDecoderInput) {
  if (input == null) {
    return new ArrayBuffer(0)
  }
  if (input instanceof ArrayBuffer) {
    return input.slice(0)
  }
  if (ArrayBuffer.isView(input)) {
    const copied = new Uint8Array(input.byteLength)
    copied.set(new Uint8Array(input.buffer, input.byteOffset, input.byteLength))
    return copied.buffer
  }
  return new ArrayBuffer(0)
}

export class TextEncoderPolyfill {
  readonly encoding = 'utf-8'

  encode(input = '') {
    return new Uint8Array(encodeTextFallback(String(input)))
  }
}

export class TextDecoderPolyfill {
  readonly encoding = 'utf-8'
  readonly fatal = false
  readonly ignoreBOM = false

  decode(input?: TextDecoderInput) {
    return decodeTextFallback(normalizeTextDecoderInput(input))
  }
}
