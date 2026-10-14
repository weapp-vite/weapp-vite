const PLUS_REGEXP = /\+/g
const ENCODED_BYTES_REGEXP = /(?:%[\da-f]{2})+/gi

function decodePercentBytes(encoded: string) {
  const bytes: number[] = []
  for (let index = 0; index < encoded.length; index += 3) {
    bytes.push(Number.parseInt(encoded.slice(index + 1, index + 3), 16))
  }

  let result = ''
  let index = 0
  while (index < bytes.length) {
    const first = bytes[index++]!
    if (first < 0x80) {
      result += String.fromCharCode(first)
      continue
    }

    let remaining: number
    let point: number
    let lower = 0x80
    let upper = 0xBF
    if (first >= 0xC2 && first <= 0xDF) {
      remaining = 1
      point = first & 0x1F
    }
    else if (first >= 0xE0 && first <= 0xEF) {
      remaining = 2
      point = first & 0x0F
      if (first === 0xE0) {
        lower = 0xA0
      }
      if (first === 0xED) {
        upper = 0x9F
      }
    }
    else if (first >= 0xF0 && first <= 0xF4) {
      remaining = 3
      point = first & 0x07
      if (first === 0xF0) {
        lower = 0x90
      }
      if (first === 0xF4) {
        upper = 0x8F
      }
    }
    else {
      result += '\uFFFD'
      continue
    }

    while (remaining > 0 && index < bytes.length) {
      const next = bytes[index]!
      if (next < lower || next > upper) {
        break
      }
      point = (point << 6) | (next & 0x3F)
      index++
      remaining--
      lower = 0x80
      upper = 0xBF
    }
    if (remaining > 0) {
      // 无效的后续字节留给下一轮处理，避免吞掉 ASCII 或新的起始字节。
      result += '\uFFFD'
    }
    else if (point <= 0xFFFF) {
      result += String.fromCharCode(point)
    }
    else {
      point -= 0x10000
      result += String.fromCharCode(0xD800 + (point >> 10), 0xDC00 + (point & 0x3FF))
    }
  }
  return result
}

export function decodeSearchParam(value: string) {
  const source = value.replace(PLUS_REGEXP, ' ')
  try {
    return decodeURIComponent(source)
  }
  catch {
    // 保留不完整的百分号转义；有效字节片段按 UTF-8 的替换模式解码，保留 BOM。
    return source.replace(ENCODED_BYTES_REGEXP, decodePercentBytes)
  }
}
