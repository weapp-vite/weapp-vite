interface WxmlFormatterOptions {
  indent: string
  inlineTags?: readonly string[]
  selfClosingTags?: readonly string[]
  wrapAttributes?: number
}
interface ParsedAttribute {
  name: string
  value: string
}

interface Token {
  attributes?: ParsedAttribute[]
  content: string
  originalLength?: number
  tagName?: string
  type: 'open' | 'close' | 'selfClose' | 'text' | 'comment'
}

const EXPRESSION_PLACEHOLDER = '__WEAPP_VITE_WXML_EXPR_'
const DIRECTIVE_PLACEHOLDER = '__WEAPP_VITE_WXML_DIR_'
const DEFAULT_WRAP_ATTRIBUTES = 3
const DEFAULT_INLINE_TAGS = ['text', 'icon', 'rich-text']
const DEFAULT_SELF_CLOSING_TAGS = 'image,input,icon,video,audio,camera,live-player,live-pusher,map,canvas,web-view,ad,official-account,open-data'.split(',')

function getAttributeText(attribute: ParsedAttribute) {
  return attribute.value ? `${attribute.name}=${attribute.value}` : attribute.name
}

function getTagName(content: string) {
  return content.match(/^<\/?([\w-]+)/u)?.[1] ?? ''
}

function getLineEnd(text: string) {
  return text.includes('\r\n') ? '\r\n' : '\n'
}

function recordTagLengths(text: string) {
  const lengths = new Map<string, number[]>()
  const tagPattern = /<[^>]*>/gu
  let match = tagPattern.exec(text)

  while (match) {
    const tagName = getTagName(match[0])
    if (!tagName) {
      match = tagPattern.exec(text)
      continue
    }

    const tagLengths = lengths.get(tagName) ?? []
    tagLengths.push(match[0].length)
    lengths.set(tagName, tagLengths)
    match = tagPattern.exec(text)
  }

  return lengths
}

function protectSpecialSyntax(text: string, expressions: string[], directives: string[]) {
  return text
    .replace(/\{\{[\s\S]*?\}\}/gu, (match) => {
      const index = expressions.length
      expressions.push(match)
      return `${EXPRESSION_PLACEHOLDER}${index}__`
    })
    .replace(/(wx:|bind:|catch:|mut-bind:|capture-bind:|capture-catch:)[\w-]+/gu, (match) => {
      const index = directives.length
      directives.push(match)
      return `${DIRECTIVE_PLACEHOLDER}${index}__`
    })
}

function restoreSpecialSyntax(text: string, expressions: readonly string[], directives: readonly string[]) {
  return text
    .replace(new RegExp(`${DIRECTIVE_PLACEHOLDER}(\\d+)__`, 'gu'), (placeholder, index: string) => {
      return directives[Number(index)] ?? placeholder
    })
    .replace(new RegExp(`${EXPRESSION_PLACEHOLDER}(\\d+)__`, 'gu'), (placeholder, index: string) => {
      return expressions[Number(index)] ?? placeholder
    })
}

function normalizeSelfClosingTags(text: string, selfClosingTags: readonly string[]) {
  let result = text

  for (const tagName of selfClosingTags) {
    result = result.replace(
      new RegExp(`<${tagName}(?=[\\s/>])(\\s[^>]*?)?></${tagName}>`, 'gu'),
      (_, attributes: string | undefined) => `<${tagName}${attributes ?? ''} />`,
    )
    result = result.replace(
      new RegExp(`<${tagName}(?=\\s)(\\s[^>]*)\\s*/>`, 'gu'),
      (_, attributes: string) => {
        const trimmedAttributes = attributes.trim()
        return trimmedAttributes ? `<${tagName} ${trimmedAttributes} />` : `<${tagName} />`
      },
    )
  }

  return result
}

function parseAttributes(attributeText: string): ParsedAttribute[] {
  const attributes: ParsedAttribute[] = []
  const cleaned = attributeText.replace(/\s+/gu, ' ').trim()
  const attributePattern = /([\w:-]+)(?:=("[^"]*"|'[^']*'))?/gu
  let match = attributePattern.exec(cleaned)

  while (match) {
    attributes.push({
      name: match[1]!,
      value: match[2] ?? '',
    })
    match = attributePattern.exec(cleaned)
  }

  return attributes
}

function tokenize(text: string) {
  const tokens: Token[] = []
  const cleaned = text.replace(/\s+/gu, ' ').trim()
  const tokenPattern = /<!--[\s\S]*?-->|<\/[\w-]+\s*>|<[^>]+>|[^<]+|</gu
  let match = tokenPattern.exec(cleaned)

  while (match) {
    const rawContent = match[0].trim()

    if (!rawContent) {
      match = tokenPattern.exec(cleaned)
      continue
    }

    const content = rawContent.startsWith('<')
      ? rawContent.replace(/\/\s*>$/u, '/>').replace(/\s+>$/u, '>')
      : rawContent

    if (content.startsWith('<!--')) {
      tokens.push({ type: 'comment', content })
      match = tokenPattern.exec(cleaned)
      continue
    }

    if (content === '<') {
      tokens.push({ type: 'text', content })
      match = tokenPattern.exec(cleaned)
      continue
    }

    if (content.startsWith('</')) {
      tokens.push({ type: 'close', content, tagName: getTagName(content) })
      match = tokenPattern.exec(cleaned)
      continue
    }

    if (/\/>$/u.test(content)) {
      const tagName = getTagName(content)
      tokens.push(tagName
        ? {
            type: 'selfClose',
            content,
            tagName,
            attributes: parseAttributes(content.slice(tagName.length + 1, -2)),
          }
        : { type: 'text', content })
      match = tokenPattern.exec(cleaned)
      continue
    }

    if (content.startsWith('<')) {
      const tagName = getTagName(content)
      tokens.push(tagName
        ? {
            type: 'open',
            content,
            tagName,
            attributes: parseAttributes(content.slice(tagName.length + 1, -1)),
          }
        : { type: 'text', content })
      match = tokenPattern.exec(cleaned)
      continue
    }

    tokens.push({ type: 'text', content })
    match = tokenPattern.exec(cleaned)
  }

  return tokens
}

function attachOriginalLengths(tokens: Token[], lengths: Map<string, number[]>) {
  const counters = new Map<string, number>()

  for (const token of tokens) {
    if ((token.type !== 'open' && token.type !== 'selfClose') || !token.tagName) {
      continue
    }

    const index = counters.get(token.tagName) ?? 0
    token.originalLength = lengths.get(token.tagName)?.[index]
    counters.set(token.tagName, index + 1)
  }
}

function buildDocument(tokens: readonly Token[], options: Required<WxmlFormatterOptions>) {
  const lines: string[] = []
  let depth = 0
  const inlineTags = new Set(options.inlineTags)
  const shouldWrapAttributes = (token: Token) => {
    const attributeCount = token.attributes?.length ?? 0
    return attributeCount >= options.wrapAttributes || Boolean(token.originalLength && token.originalLength > 100)
  }
  const isInlineSandwich = (token: Token, next: Token | undefined, nextNext: Token | undefined) => {
    return next?.type === 'text' && nextNext?.type === 'close' && nextNext.tagName === token.tagName
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!
    const nextToken = tokens[index + 1]
    const nextNextToken = tokens[index + 2]

    if (token.type === 'close') {
      depth = Math.max(0, depth - 1)
      lines.push(`${options.indent.repeat(depth)}${token.content}`)
      continue
    }

    if (token.type === 'open' && shouldWrapAttributes(token)) {
      const shouldInline = isInlineSandwich(token, nextToken, nextNextToken) && inlineTags.has(token.tagName ?? '')
      lines.push(`${options.indent.repeat(depth)}<${token.tagName}`)

      for (const attribute of token.attributes ?? []) {
        lines.push(`${options.indent.repeat(depth + 1)}${getAttributeText(attribute)}`)
      }

      if (shouldInline) {
        lines.push(`${options.indent.repeat(depth)}>${nextToken!.content}${nextNextToken!.content}`)
        index += 2
        continue
      }

      lines.push(`${options.indent.repeat(depth)}>`)
      depth += 1
      continue
    }

    if (token.type === 'open' && isInlineSandwich(token, nextToken, nextNextToken)) {
      if (inlineTags.has(token.tagName ?? '') || nextToken!.content.length <= 50) {
        lines.push(`${options.indent.repeat(depth)}${token.content}${nextToken!.content}${nextNextToken!.content}`)
        index += 2
        continue
      }
    }

    if (token.type === 'selfClose' && shouldWrapAttributes(token)) {
      lines.push(`${options.indent.repeat(depth)}<${token.tagName}`)

      for (const [attributeIndex, attribute] of (token.attributes ?? []).entries()) {
        const suffix = attributeIndex === (token.attributes!.length - 1) ? ' />' : ''
        lines.push(`${options.indent.repeat(depth + 1)}${getAttributeText(attribute)}${suffix}`)
      }

      continue
    }

    lines.push(`${options.indent.repeat(depth)}${token.content}`)

    if (token.type === 'open') {
      depth += 1
    }
  }

  return lines.join('\n')
}

function cleanup(text: string) {
  return text
    .replace(/(wx:|bind:|catch:|mut-bind:|capture-bind:|capture-catch:)(\w+)(\s*=\s*)(['"])/gu, '$1$2=$4')
}

export function formatWxmlText(text: string, formatterOptions: WxmlFormatterOptions) {
  const lineEnd = getLineEnd(text)
  const expressions: string[] = []
  const directives: string[] = []
  const options: Required<WxmlFormatterOptions> = {
    indent: formatterOptions.indent,
    inlineTags: formatterOptions.inlineTags ?? DEFAULT_INLINE_TAGS,
    selfClosingTags: formatterOptions.selfClosingTags ?? DEFAULT_SELF_CLOSING_TAGS,
    wrapAttributes: formatterOptions.wrapAttributes ?? DEFAULT_WRAP_ATTRIBUTES,
  }
  const tagLengths = recordTagLengths(text)
  const protectedText = protectSpecialSyntax(text, expressions, directives)
  const normalizedText = normalizeSelfClosingTags(protectedText, options.selfClosingTags)
  const tokens = tokenize(normalizedText)

  attachOriginalLengths(tokens, tagLengths)

  const formattedText = cleanup(restoreSpecialSyntax(buildDocument(tokens, options), expressions, directives))
  return `${formattedText.replace(/\n/gu, lineEnd)}${lineEnd}`
}
