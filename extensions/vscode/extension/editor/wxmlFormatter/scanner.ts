import type { TemplateScanResult, TemplateToken } from './types'
import {
  findMustacheEnd,
  findTagEnd,
  parseTag,
} from './syntax'

const RAW_CONTENT_TAGS = new Set(['filter', 'script', 'sjs', 'wxs'])

function findRawBlockEnd(source: string, start: number, tagName: string) {
  const closePattern = new RegExp(`^</${tagName}\\s*>`, 'iu')
  let blockComment = false
  let escaped = false
  let lineComment = false
  let quote = ''

  for (let index = start; index < source.length; index += 1) {
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
    if (char === '<') {
      const match = closePattern.exec(source.slice(index))
      if (match) {
        return index + match[0].length
      }
    }
  }

  return -1
}

function findOpaqueEnd(source: string, start: number) {
  if (source.startsWith('<!--', start)) {
    const end = source.indexOf('-->', start + 4)
    return end < 0 ? -1 : end + 3
  }
  if (source.startsWith('<![CDATA[', start)) {
    const end = source.indexOf(']]>', start + 9)
    return end < 0 ? -1 : end + 3
  }
  if (source.startsWith('<?', start)) {
    const end = source.indexOf('?>', start + 2)
    return end < 0 ? -1 : end + 2
  }
  if (source.startsWith('<!', start)) {
    return findTagEnd(source, start)
  }
  return 0
}

function findNextMarkup(source: string, start: number) {
  for (let index = start; index < source.length; index += 1) {
    if (source.startsWith('{{', index)) {
      const end = findMustacheEnd(source, index)
      if (end < 0) {
        return { index: -1, safe: false }
      }
      index = end - 1
      continue
    }
    if (source[index] === '<' && /[A-Za-z_!/?]/u.test(source[index + 1] ?? '')) {
      return { index, safe: true }
    }
  }
  return { index: source.length, safe: true }
}

function linkTagPairs(tokens: TemplateToken[]) {
  const stack: number[] = []

  for (const [index, token] of tokens.entries()) {
    if (token.type === 'open') {
      stack.push(index)
      continue
    }
    if (token.type !== 'close') {
      continue
    }

    const openIndex = stack.pop()
    const openToken = openIndex === undefined ? undefined : tokens[openIndex]
    if (!openToken || openToken.tagName !== token.tagName) {
      return false
    }
    openToken.matchingIndex = index
    token.matchingIndex = openIndex
  }

  return stack.length === 0
}

export function scanTemplate(source: string): TemplateScanResult {
  const tokens: TemplateToken[] = []
  let index = 0

  while (index < source.length) {
    const markup = findNextMarkup(source, index)
    if (!markup.safe) {
      return { safe: false, tokens }
    }
    if (markup.index > index) {
      tokens.push({ type: 'text', content: source.slice(index, markup.index), start: index, end: markup.index })
    }
    if (markup.index >= source.length) {
      break
    }

    const opaqueEnd = findOpaqueEnd(source, markup.index)
    if (opaqueEnd < 0) {
      return { safe: false, tokens }
    }
    if (opaqueEnd > 0) {
      tokens.push({ type: 'opaque', content: source.slice(markup.index, opaqueEnd), start: markup.index, end: opaqueEnd })
      index = opaqueEnd
      continue
    }

    const tagEnd = findTagEnd(source, markup.index)
    if (tagEnd < 0) {
      return { safe: false, tokens }
    }
    const token = parseTag(source, markup.index, tagEnd)
    if (!token) {
      tokens.push({ type: 'opaque', content: source.slice(markup.index, tagEnd), start: markup.index, end: tagEnd })
      index = tagEnd
      continue
    }

    if (token.type === 'open' && token.tagName && RAW_CONTENT_TAGS.has(token.tagName.toLowerCase())) {
      const rawEnd = findRawBlockEnd(source, tagEnd, token.tagName)
      if (rawEnd < 0) {
        return { safe: false, tokens }
      }
      tokens.push({ type: 'opaque', content: source.slice(markup.index, rawEnd), start: markup.index, end: rawEnd })
      index = rawEnd
      continue
    }

    tokens.push(token)
    index = tagEnd
  }

  return { safe: linkTagPairs(tokens), tokens }
}
