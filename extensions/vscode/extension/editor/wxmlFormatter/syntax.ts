import type {
  ParsedAttribute,
  TemplateToken,
} from './types'

function isWhitespace(value: string | undefined) {
  return value !== undefined && /\s/u.test(value)
}

export function findMustacheEnd(source: string, start: number) {
  const brackets: string[] = []
  let blockComment = false
  let escaped = false
  let lineComment = false
  let quote = ''

  for (let index = start + 2; index < source.length; index += 1) {
    const char = source[index]!
    const next = source[index + 1]

    if (lineComment) {
      if (char === '\n') {
        lineComment = false
      }
      continue
    }

    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index += 1
      }
      continue
    }

    if (quote) {
      if (escaped) {
        escaped = false
      }
      else if (char === '\\') {
        escaped = true
      }
      else if (char === quote) {
        quote = ''
      }
      continue
    }

    if (char === '/' && next === '/') {
      lineComment = true
      index += 1
      continue
    }
    if (char === '/' && next === '*') {
      blockComment = true
      index += 1
      continue
    }
    if (char === '"' || char === '\'' || char === '`') {
      quote = char
      continue
    }
    if (char === '}' && next === '}' && brackets.length === 0) {
      return index + 2
    }
    if (char === '(' || char === '[' || char === '{') {
      brackets.push(char)
      continue
    }
    if (char === ')' || char === ']' || char === '}') {
      const expected = char === ')' ? '(' : char === ']' ? '[' : '{'
      if (brackets.at(-1) === expected) {
        brackets.pop()
      }
    }
  }

  return -1
}

export function findTagEnd(source: string, start: number) {
  let escaped = false
  let quote = ''

  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index]!

    if (quote) {
      if (escaped) {
        escaped = false
      }
      else if (char === '\\') {
        escaped = true
      }
      else if (char === quote) {
        quote = ''
      }
      continue
    }

    if (source.startsWith('{{', index)) {
      const mustacheEnd = findMustacheEnd(source, index)
      if (mustacheEnd < 0) {
        return -1
      }
      index = mustacheEnd - 1
      continue
    }
    if (char === '"' || char === '\'') {
      quote = char
      continue
    }
    if (char === '>') {
      return index + 1
    }
  }

  return -1
}

function readAttributeValue(source: string, start: number) {
  const quote = source[start]

  if (quote === '"' || quote === '\'') {
    let escaped = false
    for (let index = start + 1; index < source.length; index += 1) {
      const char = source[index]!
      if (escaped) {
        escaped = false
      }
      else if (char === '\\') {
        escaped = true
      }
      else if (char === quote) {
        return index + 1
      }
    }
    return -1
  }

  let index = start
  while (index < source.length && !isWhitespace(source[index])) {
    if (source.startsWith('{{', index)) {
      const mustacheEnd = findMustacheEnd(source, index)
      if (mustacheEnd < 0) {
        return -1
      }
      index = mustacheEnd
      continue
    }
    index += 1
  }
  return index
}

function parseAttributes(source: string): ParsedAttribute[] | undefined {
  const attributes: ParsedAttribute[] = []
  let index = 0

  while (index < source.length) {
    while (isWhitespace(source[index])) {
      index += 1
    }
    if (index >= source.length) {
      break
    }

    if (source.startsWith('{{', index)) {
      const end = findMustacheEnd(source, index)
      if (end < 0) {
        return undefined
      }
      attributes.push({ text: source.slice(index, end) })
      index = end
      continue
    }

    const nameStart = index
    while (index < source.length && !isWhitespace(source[index]) && source[index] !== '=') {
      if (source[index] === '<' || source[index] === '>' || source[index] === '"' || source[index] === '\'') {
        return undefined
      }
      index += 1
    }
    const name = source.slice(nameStart, index)
    if (!name) {
      return undefined
    }

    while (isWhitespace(source[index])) {
      index += 1
    }
    if (source[index] !== '=') {
      attributes.push({ text: name })
      continue
    }

    index += 1
    while (isWhitespace(source[index])) {
      index += 1
    }
    const valueEnd = readAttributeValue(source, index)
    if (valueEnd < 0 || valueEnd === index) {
      return undefined
    }
    attributes.push({ text: `${name}=${source.slice(index, valueEnd)}` })
    index = valueEnd
  }

  return attributes
}

export function parseTag(source: string, start: number, end: number): TemplateToken | undefined {
  const content = source.slice(start, end)
  if (content.startsWith('</')) {
    const body = content.slice(2, -1).trim()
    if (!body || /\s/u.test(body)) {
      return undefined
    }
    return { type: 'close', content, tagName: body, start, end }
  }

  let body = content.slice(1, -1)
  const selfClosing = /\/\s*$/u.test(body)
  if (selfClosing) {
    body = body.replace(/\/\s*$/u, '')
  }
  body = body.trim()

  let nameEnd = 0
  while (nameEnd < body.length && !isWhitespace(body[nameEnd])) {
    nameEnd += 1
  }
  const tagName = body.slice(0, nameEnd)
  if (!tagName || /[<>=/'"]/u.test(tagName)) {
    return undefined
  }

  return {
    type: selfClosing ? 'selfClose' : 'open',
    attributes: parseAttributes(body.slice(nameEnd)),
    content,
    tagName,
    start,
    end,
  }
}
