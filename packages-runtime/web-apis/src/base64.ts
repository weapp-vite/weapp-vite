const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const BASE64_LOOKUP = new Uint8Array(256)
const BASE64_INVALID_INPUT_RE = /[^A-Za-z\d+/=]/u

for (let index = 0; index < BASE64_LOOKUP.length; index++) {
  BASE64_LOOKUP[index] = 255
}

for (let index = 0; index < BASE64_CHARS.length; index++) {
  BASE64_LOOKUP[BASE64_CHARS.charCodeAt(index)] = index
}

function toLatin1Byte(value: string, index: number) {
  const codePoint = value.charCodeAt(index)
  if (codePoint > 0xFF) {
    throw new TypeError(`Failed to execute 'btoa': character outside Latin1 range at index ${index}`)
  }
  return codePoint
}

export function btoaPolyfill(input = '') {
  const source = String(input)
  let output = ''

  for (let index = 0; index < source.length; index += 3) {
    const byte0 = toLatin1Byte(source, index)
    const byte1 = index + 1 < source.length ? toLatin1Byte(source, index + 1) : Number.NaN
    const byte2 = index + 2 < source.length ? toLatin1Byte(source, index + 2) : Number.NaN

    const triplet = (byte0 << 16) | ((Number.isNaN(byte1) ? 0 : byte1) << 8) | (Number.isNaN(byte2) ? 0 : byte2)

    output += BASE64_CHARS[(triplet >> 18) & 0x3F]
    output += BASE64_CHARS[(triplet >> 12) & 0x3F]
    output += Number.isNaN(byte1) ? '=' : BASE64_CHARS[(triplet >> 6) & 0x3F]
    output += Number.isNaN(byte2) ? '=' : BASE64_CHARS[triplet & 0x3F]
  }

  return output
}

export function atobPolyfill(input = '') {
  const source = String(input).replace(/[\t\n\f\r ]+/g, '')

  if (source.length % 4 === 1 || BASE64_INVALID_INPUT_RE.test(source)) {
    throw new TypeError('Failed to execute \'atob\': the input is not correctly encoded')
  }

  let output = ''

  for (let index = 0; index < source.length; index += 4) {
    const char0 = source.charCodeAt(index)
    const char1 = source.charCodeAt(index + 1)
    const char2 = source.charAt(index + 2)
    const char3 = source.charAt(index + 3)

    const sextet0 = BASE64_LOOKUP[char0] ?? 255
    const sextet1 = BASE64_LOOKUP[char1] ?? 255
    const sextet2 = char2 === '=' ? 64 : (BASE64_LOOKUP[source.charCodeAt(index + 2)] ?? 255)
    const sextet3 = char3 === '=' ? 64 : (BASE64_LOOKUP[source.charCodeAt(index + 3)] ?? 255)

    if (sextet0 > 63 || sextet1 > 63 || sextet2 > 64 || sextet3 > 64) {
      throw new TypeError('Failed to execute \'atob\': the input is not correctly encoded')
    }

    const triplet = (sextet0 << 18) | (sextet1 << 12) | ((sextet2 & 0x3F) << 6) | (sextet3 & 0x3F)

    output += String.fromCharCode((triplet >> 16) & 0xFF)
    if (char2 !== '=') {
      output += String.fromCharCode((triplet >> 8) & 0xFF)
    }
    if (char3 !== '=') {
      output += String.fromCharCode(triplet & 0xFF)
    }
  }

  return output
}
