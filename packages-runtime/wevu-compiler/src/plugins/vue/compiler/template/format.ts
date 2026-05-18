interface WxmlFormatToken {
  type: 'tag' | 'text'
  value: string
}

const TOKEN_RE = /<[^>]+>/g

function tokenizeWxml(source: string): WxmlFormatToken[] {
  const tokens: WxmlFormatToken[] = []
  let index = 0
  for (const match of source.matchAll(TOKEN_RE)) {
    const start = match.index ?? 0
    if (start > index) {
      tokens.push({ type: 'text', value: source.slice(index, start) })
    }
    tokens.push({ type: 'tag', value: match[0] })
    index = start + match[0].length
  }
  if (index < source.length) {
    tokens.push({ type: 'text', value: source.slice(index) })
  }
  return tokens.filter(token => token.value.length > 0)
}

function isClosingTag(value: string) {
  return /^<\//.test(value)
}

function isSelfClosingTag(value: string) {
  return /\/>$/.test(value) || /^<(?:import|include|wxs|sjs)\b/i.test(value)
}

function isOpeningTag(value: string) {
  return /^<[^/!][\s\S]*>$/.test(value) && !isSelfClosingTag(value)
}

function isWhitespaceText(token: WxmlFormatToken) {
  return token.type === 'text' && token.value.trim().length === 0
}

function shouldKeepInline(tokens: WxmlFormatToken[], openIndex: number, closeIndex: number) {
  const inner = tokens.slice(openIndex + 1, closeIndex)
  return inner.some(token => token.type === 'text' && token.value.trim().length > 0)
    && inner.every(token => token.type !== 'tag' || isSelfClosingTag(token.value))
}

function findMatchingClosingTag(tokens: WxmlFormatToken[], openIndex: number) {
  const openTag = tokens[openIndex]?.value
  const match = /^<([^\s>/]+)/.exec(openTag ?? '')
  if (!match) {
    return -1
  }
  const tagName = match[1]
  let depth = 0
  for (let index = openIndex; index < tokens.length; index++) {
    const token = tokens[index]
    if (token?.type !== 'tag') {
      continue
    }
    if (new RegExp(`^<${tagName}(?:\\s|>|/)`).test(token.value) && !isSelfClosingTag(token.value)) {
      depth += 1
      continue
    }
    if (new RegExp(`^</${tagName}>`).test(token.value)) {
      depth -= 1
      if (depth === 0) {
        return index
      }
    }
  }
  return -1
}

function appendLine(lines: string[], level: number, value: string, indent: string) {
  lines.push(`${indent.repeat(Math.max(level, 0))}${value}`)
}

/**
 * 轻量格式化 WXML，只调整标签层级缩进，不重排文本内容。
 */
export function formatWxml(source: string, options: { indent?: string } = {}) {
  const tokens = tokenizeWxml(source).filter(token => !isWhitespaceText(token))
  const indent = options.indent ?? '  '
  const lines: string[] = []
  let level = 0
  let index = 0

  while (index < tokens.length) {
    const token = tokens[index]
    if (!token) {
      index += 1
      continue
    }

    if (token.type === 'text') {
      const value = token.value.trim()
      if (value) {
        appendLine(lines, level, value, indent)
      }
      index += 1
      continue
    }

    if (isClosingTag(token.value)) {
      level -= 1
      appendLine(lines, level, token.value, indent)
      index += 1
      continue
    }

    if (isOpeningTag(token.value)) {
      const closeIndex = findMatchingClosingTag(tokens, index)
      if (closeIndex > index && shouldKeepInline(tokens, index, closeIndex)) {
        const inline = tokens.slice(index, closeIndex + 1).map(item => item.value).join('')
        appendLine(lines, level, inline, indent)
        index = closeIndex + 1
        continue
      }

      appendLine(lines, level, token.value, indent)
      level += 1
      index += 1
      continue
    }

    appendLine(lines, level, token.value, indent)
    index += 1
  }

  return `${lines.join('\n')}\n`
}
