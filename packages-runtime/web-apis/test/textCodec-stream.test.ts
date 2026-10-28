import { describe, expect, it } from 'vitest'
import { hasUsableTextDecoderConstructor, TextDecoderPolyfill, TextEncoderPolyfill } from '../src/textCodec'

describe('incremental UTF-8 decoder', () => {
  it('detects incremental native decoders and rejects partial implementations', () => {
    expect(hasUsableTextDecoderConstructor(TextDecoder)).toBe(true)
    expect(hasUsableTextDecoderConstructor(TextDecoderPolyfill)).toBe(true)
    expect(hasUsableTextDecoderConstructor(undefined)).toBe(false)
    expect(hasUsableTextDecoderConstructor(class PartialDecoder {
      decode() { return 'broken' }
    })).toBe(false)
  })
  it('matches native decoding across every split of UTF-8, BOM and supplementary characters', () => {
    const bytes = new TextEncoder().encode('\uFEFFA中文🙂\uFEFFZ')
    for (let first = 0; first <= bytes.length; first++) {
      for (let second = first; second <= bytes.length; second++) {
        const decoder = new TextDecoderPolyfill()
        const chunks = [bytes.subarray(0, first), bytes.subarray(first, second), bytes.subarray(second)]
        const result = chunks.map(chunk => decoder.decode(chunk, { stream: true })).join('') + decoder.decode()
        expect(result).toBe('A中文🙂\uFEFFZ')
      }
    }
  })

  it.each([
    [0xFF],
    [0xE4],
    [0xE4, 0xB8],
    [0xE4, 65, 0xAD],
    [0xE0, 0x80, 0x80],
    [0xED, 0xA0, 0x80],
    [0xF0, 0x80, 0x80, 0x80],
    [0xF4, 0x90, 0x80, 0x80],
    [0xF0, 0x9F, 65, 0x82],
    [0xC0, 0xAF],
    [0x80, 0xBF],
  ])('matches replacement and flush behavior for malformed bytes %j', (...input) => {
    const bytes = new Uint8Array(input)
    for (let split = 0; split <= bytes.length; split++) {
      const native = new TextDecoder()
      const fallback = new TextDecoderPolyfill()
      expect(fallback.decode(bytes.subarray(0, split), { stream: true })).toBe(native.decode(bytes.subarray(0, split), { stream: true }))
      expect(fallback.decode(bytes.subarray(split))).toBe(native.decode(bytes.subarray(split)))
    }
  })

  it('implements fatal flush, BOM options, label validation and decoding reset', () => {
    const fatal = new TextDecoderPolyfill('UTF8', { fatal: true })
    expect(fatal.decode(new Uint8Array([0xE4]), { stream: true })).toBe('')
    expect(() => fatal.decode()).toThrow(TypeError)
    expect(fatal.decode(new Uint8Array([65]))).toBe('A')
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF, 65])
    const decoder = new TextDecoderPolyfill()
    expect(decoder.decode(bom)).toBe('A')
    expect(decoder.decode(bom)).toBe('A')
    expect(new TextDecoderPolyfill('utf-8', { ignoreBOM: true }).decode(bom)).toBe('\uFEFFA')
    expect(() => new TextDecoderPolyfill('unsupported')).toThrow(RangeError)
    expect(() => decoder.decode({} as never)).toThrow(TypeError)
  })

  it('respects view ranges and replaces unpaired surrogate inputs during encoding', () => {
    const decoder = new TextDecoderPolyfill()
    const bytes = new Uint8Array([0, 65, 66, 0])
    expect(decoder.decode(new DataView(bytes.buffer, 1, 2))).toBe('AB')
    expect(new TextEncoderPolyfill().encode('\uD800A\uDC00🙂')).toEqual(new TextEncoder().encode('\uD800A\uDC00🙂'))
  })
})
