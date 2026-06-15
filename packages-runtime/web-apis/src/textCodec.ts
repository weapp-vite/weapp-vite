import { cloneArrayBuffer, cloneArrayBufferView, decodeTextFallback, encodeTextFallback, isArrayBufferLike } from './shared'

type TextDecoderInput = ArrayBuffer | ArrayBufferView | null | undefined

function normalizeTextDecoderInput(input?: TextDecoderInput) {
  if (input == null) {
    return new ArrayBuffer(0)
  }
  if (isArrayBufferLike(input)) {
    return cloneArrayBuffer(input)
  }
  if (ArrayBuffer.isView(input)) {
    return cloneArrayBufferView(input)
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
