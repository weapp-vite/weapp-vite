import type {
  TemplateToken,
  WxmlFormatterOptions,
} from './types'

type ResolvedWxmlFormatterOptions = Required<WxmlFormatterOptions>

function getAttributeText(token: TemplateToken) {
  return token.attributes?.map(attribute => attribute.text).join(' ') ?? ''
}

function shouldWrapAttributes(token: TemplateToken, options: ResolvedWxmlFormatterOptions) {
  const attributeCount = token.attributes?.length ?? 0
  return token.attributes !== undefined
    && (attributeCount >= options.wrapAttributes || token.content.length > 100)
}

function formatTagStart(
  token: TemplateToken,
  depth: number,
  options: ResolvedWxmlFormatterOptions,
  ending: '>' | ' />',
  inlineContent = '',
) {
  const indent = options.indent.repeat(depth)
  if (!shouldWrapAttributes(token, options)) {
    if (token.attributes === undefined) {
      return [`${indent}${token.content.trim()}`]
    }
    const attributeText = getAttributeText(token)
    return [`${indent}<${token.tagName}${attributeText ? ` ${attributeText}` : ''}${ending}${inlineContent}`]
  }

  const lines = [`${indent}<${token.tagName}`]
  for (const attribute of token.attributes ?? []) {
    lines.push(`${options.indent.repeat(depth + 1)}${attribute.text}`)
  }
  if (ending === ' />') {
    if (lines.length === 1) {
      lines[0] += ending
    }
    else {
      lines[lines.length - 1] += ending
    }
  }
  else {
    lines.push(`${indent}>${inlineContent}`)
  }
  return lines
}

function getDirectContentState(tokens: readonly TemplateToken[], openIndex: number, closeIndex: number) {
  let childDepth = 0
  let significantTextCount = 0
  let hasStructuralChild = false
  let hasMultilineText = false

  for (let index = openIndex + 1; index < closeIndex; index += 1) {
    const token = tokens[index]!
    if (token.type === 'close') {
      childDepth -= 1
      continue
    }
    if (childDepth === 0) {
      if (token.type === 'text' && token.content.trim()) {
        significantTextCount += 1
        hasMultilineText ||= token.content.includes('\n')
      }
      else if (token.type !== 'text') {
        hasStructuralChild = true
      }
    }
    if (token.type === 'open') {
      childDepth += 1
    }
  }

  return {
    preserveWhole: hasMultilineText || (significantTextCount > 0 && (hasStructuralChild || significantTextCount > 1)),
    significantTextCount,
  }
}

function getSingleTextChild(tokens: readonly TemplateToken[], openIndex: number, closeIndex: number) {
  let result: TemplateToken | undefined
  for (let index = openIndex + 1; index < closeIndex; index += 1) {
    const token = tokens[index]!
    if (token.type === 'text' && !token.content.trim()) {
      continue
    }
    if (token.type !== 'text' || result) {
      return undefined
    }
    result = token
  }
  return result
}

function isEmptyPair(tokens: readonly TemplateToken[], openIndex: number, closeIndex: number) {
  for (let index = openIndex + 1; index < closeIndex; index += 1) {
    const token = tokens[index]!
    if (token.type !== 'text' || token.content.trim()) {
      return false
    }
  }
  return true
}

export function printTemplate(
  source: string,
  tokens: readonly TemplateToken[],
  options: ResolvedWxmlFormatterOptions,
) {
  const inlineTags = new Set(options.inlineTags)
  const selfClosingTags = new Set(options.selfClosingTags)
  const lines: string[] = []
  let depth = 0

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!
    if (token.type === 'text') {
      if (token.content.trim()) {
        const content = token.content.includes('\n') ? token.content.trim() : token.content
        lines.push(`${options.indent.repeat(depth)}${content}`)
      }
      continue
    }
    if (token.type === 'opaque') {
      lines.push(`${options.indent.repeat(depth)}${token.content.trim()}`)
      continue
    }
    if (token.type === 'close') {
      depth = Math.max(0, depth - 1)
      lines.push(`${options.indent.repeat(depth)}${token.content.trim()}`)
      continue
    }
    if (token.type === 'selfClose') {
      lines.push(...formatTagStart(token, depth, options, ' />'))
      continue
    }

    const closeIndex = token.matchingIndex
    if (closeIndex === undefined) {
      return source
    }
    const closeToken = tokens[closeIndex]!
    const contentState = getDirectContentState(tokens, index, closeIndex)
    if (contentState.preserveWhole) {
      lines.push(`${options.indent.repeat(depth)}${source.slice(token.start, closeToken.end)}`)
      index = closeIndex
      continue
    }
    if (selfClosingTags.has(token.tagName ?? '') && isEmptyPair(tokens, index, closeIndex)) {
      lines.push(...formatTagStart(token, depth, options, ' />'))
      index = closeIndex
      continue
    }

    const textChild = contentState.significantTextCount === 1
      ? getSingleTextChild(tokens, index, closeIndex)
      : undefined
    if (textChild && !textChild.content.includes('\n')) {
      const inline = inlineTags.has(token.tagName ?? '')
        || (!shouldWrapAttributes(token, options) && textChild.content.length <= 50)
      if (inline) {
        const ending = `${textChild.content}${closeToken.content.trim()}`
        lines.push(...formatTagStart(token, depth, options, '>', ending))
        index = closeIndex
        continue
      }
    }

    lines.push(...formatTagStart(token, depth, options, '>'))
    depth += 1
  }

  return lines.join('\n')
}
