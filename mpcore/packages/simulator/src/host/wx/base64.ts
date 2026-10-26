const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const encoded: string[] = []
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index]!
    const second = bytes[index + 1]
    const third = bytes[index + 2]
    encoded.push(
      BASE64_ALPHABET[first >> 2]!,
      BASE64_ALPHABET[((first & 3) << 4) | ((second ?? 0) >> 4)]!,
      second === undefined ? '=' : BASE64_ALPHABET[((second & 15) << 2) | ((third ?? 0) >> 6)]!,
      third === undefined ? '=' : BASE64_ALPHABET[third & 63]!,
    )
  }
  return encoded.join('')
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const bytes: number[] = []
  let accumulator = 0
  let bitCount = 0
  for (const character of base64) {
    if (character === '=') {
      break
    }
    const value = BASE64_ALPHABET.indexOf(character)
    if (value < 0) {
      continue
    }
    accumulator = (accumulator << 6) | value
    bitCount += 6
    if (bitCount >= 8) {
      bitCount -= 8
      bytes.push((accumulator >> bitCount) & 255)
    }
  }
  return new Uint8Array(bytes).buffer
}
