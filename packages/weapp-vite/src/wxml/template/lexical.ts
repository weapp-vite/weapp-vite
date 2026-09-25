export interface SourceRange {
  start: number
  end: number
}

/** 微信现行 WXML 转义与其他平台的 XML 属性边界不同。 */
export type WxmlSyntax = 'legacy' | 'xml'

export function failAt(code: string, fileName: string, offset: number, message: string): never {
  let line = 1
  let column = 1
  for (let i = 0; i < offset; i++) {
    if (code[i] === '\r' || code[i] === '\n') {
      if (code[i] === '\r' && code[i + 1] === '\n') {
        i++
      }
      line++
      column = 1
    }
    else {
      column++
    }
  }
  throw new Error(`[weapp.wxml] ${fileName}:${line}:${column}: ${message}`)
}

export function isSpace(char: string | undefined) {
  return char === ' ' || char === '\t' || char === '\r' || char === '\n' || char === '\f'
}

export function skipSpace(code: string, start: number) {
  while (isSpace(code[start])) {
    start++
  }
  return start
}

function skipString(code: string, start: number, fileName: string, encoding: 'raw' | 'attribute' | 'attribute-delimiter' = 'raw') {
  const quote = code[start]
  const escapedDelimiter = encoding === 'attribute-delimiter'
  for (let i = start + 1; i < code.length; i++) {
    if (code[i] === '\\') {
      if (encoding === 'raw') {
        i++
        continue
      }
      const slashStart = i
      while (code[i] === '\\') {
        i++
      }
      // 旧属性层先处理反斜杠对，内层引号以四个源码反斜杠为周期判界；保留原始值。
      const remainder = (i - slashStart) % 4
      if (code[i] === quote && (escapedDelimiter ? remainder === 1 : remainder < 2)) {
        return i + 1
      }
    }
    else if (code[i] === quote && !escapedDelimiter) {
      return i + 1
    }
  }
  return failAt(code, fileName, start, 'Unterminated string in template interpolation.')
}

function encodedQuoteAt(code: string, start: number) {
  const match = /^&(?:quot|apos|#0*(?:34|39)|#x0*(?:22|27));/i.exec(code.slice(start, start + 16))
  if (!match) {
    return undefined
  }
  return { token: match[0], quote: /^(?:&quot;|&#0*34;|&#x0*22;)$/i.test(match[0]) ? '"' : '\'' }
}

function skipEncodedString(code: string, start: number, fileName: string) {
  const opening = encodedQuoteAt(code, start)!
  for (let i = start + opening.token.length; i < code.length;) {
    const encoded = encodedQuoteAt(code, i)
    if ((encoded?.quote ?? code[i]) === opening.quote) {
      return i + (encoded?.token.length ?? 1)
    }
    if (code[i] === '\\') {
      i++
      i += encodedQuoteAt(code, i)?.token.length ?? 1
    }
    else {
      i += encoded?.token.length ?? 1
    }
  }
  return failAt(code, fileName, start, 'Unterminated encoded string in template interpolation.')
}

export function skipInterpolation(code: string, start: number, fileName: string, syntax: WxmlSyntax, outerQuote?: string) {
  const legacyAttribute = syntax === 'legacy' && outerQuote !== undefined
  let depth = 0
  for (let i = start + 2; i < code.length; i++) {
    const char = code[i]
    if (legacyAttribute && char === '\\' && code[i + 1] === outerQuote) {
      i = skipString(code, i + 1, fileName, 'attribute-delimiter') - 1
    }
    else if (syntax === 'xml' && outerQuote && char === '&' && encodedQuoteAt(code, i)) {
      i = skipEncodedString(code, i, fileName) - 1
    }
    else if (char === '"' || char === '\'' || char === '`') {
      i = skipString(code, i, fileName, legacyAttribute ? 'attribute' : 'raw') - 1
    }
    else if (char === '{') {
      depth++
    }
    else if (char === '}') {
      if (depth === 0 && code[i + 1] === '}') {
        return i + 2
      }
      depth--
    }
  }
  return failAt(code, fileName, start, 'Unterminated template interpolation.')
}

export function skipDelimited(code: string, start: number, opening: string, closing: string, fileName: string) {
  const end = code.indexOf(closing, start + opening.length)
  return end < 0
    ? failAt(code, fileName, start, `Unterminated ${opening}.`)
    : end + closing.length
}

export function findScriptClose(code: string, start: number, tag: string, fileName: string) {
  const closing = `</${tag}`
  let i = code.indexOf(closing, start)
  while (i >= 0) {
    if (code[i + closing.length] === '>' || isSpace(code[i + closing.length])) {
      return i
    }
    i = code.indexOf(closing, i + closing.length)
  }
  return failAt(code, fileName, start, `Missing closing tag for <${tag}>.`)
}
