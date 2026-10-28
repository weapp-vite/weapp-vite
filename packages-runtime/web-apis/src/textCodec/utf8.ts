/** 保留末尾未完成序列；非法续字节留给下一轮重新解释，遵守 UTF-8 解码的替换规则。 */
export function decodeUtf8(bytes: Uint8Array, streaming: boolean, fatal: boolean) {
  const text: string[] = []
  let index = 0
  const invalid = () => {
    if (fatal) {
      throw new TypeError('The encoded data is not valid UTF-8')
    }
    text.push('\uFFFD')
  }
  while (index < bytes.length) {
    const first = bytes[index]!
    if (first <= 0x7F) {
      text.push(String.fromCharCode(first))
      index++
      continue
    }
    const length = first >= 0xC2 && first <= 0xDF
      ? 2
      : first >= 0xE0 && first <= 0xEF
        ? 3
        : first >= 0xF0 && first <= 0xF4
          ? 4
          : 0
    if (!length) {
      invalid()
      index++
      continue
    }
    let codePoint = first & (0x7F >> length)
    let offset = 1
    for (; offset < length; offset++) {
      const byte = bytes[index + offset]
      if (byte === undefined) {
        if (streaming) {
          return { text: text.join(''), pending: bytes.slice(index) }
        }
        invalid()
        return { text: text.join(''), pending: new Uint8Array(0) }
      }
      const lower = offset === 1 && first === 0xE0 ? 0xA0 : offset === 1 && first === 0xF0 ? 0x90 : 0x80
      const upper = offset === 1 && first === 0xED ? 0x9F : offset === 1 && first === 0xF4 ? 0x8F : 0xBF
      if (byte < lower || byte > upper) {
        invalid()
        break
      }
      codePoint = (codePoint << 6) | (byte & 0x3F)
    }
    if (offset === length) {
      text.push(String.fromCodePoint(codePoint))
    }
    index += offset
  }
  return { text: text.join(''), pending: new Uint8Array(0) }
}
