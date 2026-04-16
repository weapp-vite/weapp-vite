import type * as vscode from 'vscode'
import path from 'node:path'

const TEMPLATE_BLOCK_PATTERN = /<template\b[^>]*>/giu
const TEMPLATE_CLOSE_PATTERN = /<\/template>/giu
const LINK_ATTRIBUTE_NAMES = new Set(['src', 'href', 'url'])

export interface TemplateBlockRange {
  contentEnd: number
  contentStart: number
}

export interface WxmlAttributeMatch {
  name: string
  nameEnd: number
  nameStart: number
  rawValue: string
  value: string
  valueEnd: number
  valueStart: number
}

export interface WxmlTagContext {
  attribute: WxmlAttributeMatch | null
  attributes: WxmlAttributeMatch[]
  isClosingTag: boolean
  isInsideTag: boolean
  tagName: string | null
  tagNameEnd: number | null
  tagNameStart: number | null
  tagStart: number | null
}

export interface WxmlInterpolationContext {
  expression: string
  start: number
  end: number
}

function isTemplateWhitespace(char: string | undefined) {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r'
}

function parseTagAttributes(tagText: string, tagStart: number, startOffset: number) {
  const attributes: WxmlAttributeMatch[] = []
  let index = startOffset

  while (index < tagText.length) {
    while (index < tagText.length && isTemplateWhitespace(tagText[index])) {
      index += 1
    }

    if (index >= tagText.length || tagText[index] === '>' || tagText[index] === '/') {
      break
    }

    const nameStartIndex = index

    while (index < tagText.length && /[@:\w-]/u.test(tagText[index])) {
      index += 1
    }

    const name = tagText.slice(nameStartIndex, index)

    if (!name) {
      index += 1
      continue
    }

    while (index < tagText.length && isTemplateWhitespace(tagText[index])) {
      index += 1
    }

    if (tagText[index] !== '=') {
      continue
    }

    index += 1

    while (index < tagText.length && isTemplateWhitespace(tagText[index])) {
      index += 1
    }

    const valueStartIndex = index

    if (index >= tagText.length) {
      break
    }

    let rawValue = ''
    let value = ''
    let valueEndIndex = index

    if (tagText[index] === '"' || tagText[index] === '\'') {
      const quote = tagText[index]

      index += 1
      const innerValueStart = index

      while (index < tagText.length && tagText[index] !== quote) {
        index += 1
      }

      value = tagText.slice(innerValueStart, index)
      rawValue = tagText.slice(valueStartIndex, Math.min(index + 1, tagText.length))
      valueEndIndex = index

      if (tagText[index] === quote) {
        index += 1
      }
    }
    else {
      while (index < tagText.length && !isTemplateWhitespace(tagText[index]) && tagText[index] !== '>') {
        index += 1
      }

      value = tagText.slice(valueStartIndex, index)
      rawValue = value
      valueEndIndex = index
    }

    attributes.push({
      name,
      nameStart: tagStart + nameStartIndex,
      nameEnd: tagStart + nameStartIndex + name.length,
      rawValue,
      value,
      valueStart: tagStart + valueStartIndex + (rawValue.startsWith('"') || rawValue.startsWith('\'') ? 1 : 0),
      valueEnd: tagStart + valueEndIndex,
    })
  }

  return attributes
}

function parseTagName(tagText: string) {
  if (!tagText.startsWith('<')) {
    return null
  }

  let index = 1

  while (index < tagText.length && isTemplateWhitespace(tagText[index])) {
    index += 1
  }

  const isClosingTag = tagText[index] === '/'

  if (isClosingTag) {
    index += 1
  }

  while (index < tagText.length && isTemplateWhitespace(tagText[index])) {
    index += 1
  }

  const nameStart = index

  while (index < tagText.length && !isTemplateWhitespace(tagText[index]) && tagText[index] !== '>' && tagText[index] !== '/') {
    index += 1
  }

  const name = tagText.slice(nameStart, index)

  if (!name) {
    return null
  }

  return {
    isClosingTag,
    name,
    nameEnd: index,
    nameStart,
  }
}

export function isWxmlDocument(document: vscode.TextDocument) {
  return document.languageId === 'wxml' || document.uri.fsPath.endsWith('.wxml')
}

export function getVueTemplateBlockRange(documentText: string): TemplateBlockRange | null {
  TEMPLATE_BLOCK_PATTERN.lastIndex = 0
  const openMatch = TEMPLATE_BLOCK_PATTERN.exec(documentText)

  if (!openMatch || openMatch.index == null) {
    return null
  }

  TEMPLATE_CLOSE_PATTERN.lastIndex = 0
  TEMPLATE_CLOSE_PATTERN.lastIndex = openMatch.index + openMatch[0].length
  const closeMatch = TEMPLATE_CLOSE_PATTERN.exec(documentText)

  if (!closeMatch || closeMatch.index == null) {
    return null
  }

  return {
    contentStart: openMatch.index + openMatch[0].length,
    contentEnd: closeMatch.index,
  }
}

export function isOffsetInsideVueTemplate(documentText: string, offset: number) {
  const range = getVueTemplateBlockRange(documentText)

  if (!range) {
    return false
  }

  return offset >= range.contentStart && offset <= range.contentEnd
}

export function getWxmlSourceText(document: vscode.TextDocument) {
  const text = document.getText()

  if (isWxmlDocument(document)) {
    return text
  }

  if (document.languageId !== 'vue') {
    return null
  }

  const templateRange = getVueTemplateBlockRange(text)

  if (!templateRange) {
    return null
  }

  return text.slice(templateRange.contentStart, templateRange.contentEnd)
}

export function toWxmlSourceOffset(document: vscode.TextDocument, position: vscode.Position) {
  const documentOffset = document.offsetAt(position)

  if (isWxmlDocument(document)) {
    return documentOffset
  }

  const templateRange = getVueTemplateBlockRange(document.getText())

  if (!templateRange || documentOffset < templateRange.contentStart || documentOffset > templateRange.contentEnd) {
    return null
  }

  return documentOffset - templateRange.contentStart
}

export function toDocumentOffsetFromWxmlSource(document: vscode.TextDocument, sourceOffset: number) {
  if (isWxmlDocument(document)) {
    return sourceOffset
  }

  const templateRange = getVueTemplateBlockRange(document.getText())

  if (!templateRange) {
    return null
  }

  return templateRange.contentStart + sourceOffset
}

export function resolveWxmlFileCompanionPaths(filePath: string) {
  const extension = path.extname(filePath)
  const basePath = extension ? filePath.slice(0, -extension.length) : filePath

  return {
    js: `${basePath}.js`,
    json: `${basePath}.json`,
    ts: `${basePath}.ts`,
    vue: `${basePath}.vue`,
    wxml: `${basePath}.wxml`,
  }
}

export function parseWxmlTagContext(sourceText: string, offset: number): WxmlTagContext {
  const safeOffset = Math.max(0, Math.min(offset, sourceText.length))
  const beforeCursor = sourceText.slice(0, safeOffset)
  const tagStart = beforeCursor.lastIndexOf('<')
  const tagEndBeforeCursor = beforeCursor.lastIndexOf('>')

  if (tagStart < 0 || tagEndBeforeCursor > tagStart) {
    return {
      attribute: null,
      attributes: [],
      isClosingTag: false,
      isInsideTag: false,
      tagName: null,
      tagNameEnd: null,
      tagNameStart: null,
      tagStart: null,
    }
  }

  const nextTagEnd = sourceText.indexOf('>', tagStart)

  if (nextTagEnd < 0 || safeOffset > nextTagEnd + 1) {
    return {
      attribute: null,
      attributes: [],
      isClosingTag: false,
      isInsideTag: false,
      tagName: null,
      tagNameEnd: null,
      tagNameStart: null,
      tagStart: null,
    }
  }

  const tagText = sourceText.slice(tagStart, nextTagEnd + 1)
  const tagNameMatch = parseTagName(tagText)

  if (!tagNameMatch) {
    return {
      attribute: null,
      attributes: [],
      isClosingTag: false,
      isInsideTag: true,
      tagName: null,
      tagNameEnd: null,
      tagNameStart: tagStart,
      tagStart,
    }
  }

  const isClosingTag = tagNameMatch.isClosingTag
  const tagName = tagNameMatch.name
  const tagNameStart = tagStart + tagNameMatch.nameStart
  const tagNameEnd = tagStart + tagNameMatch.nameEnd
  const attributes: WxmlAttributeMatch[] = []
  let attribute: WxmlAttributeMatch | null = null

  for (const item of parseTagAttributes(tagText, tagStart, tagNameMatch.nameEnd)) {
    attributes.push(item)
    if (safeOffset >= item.nameStart && safeOffset <= item.valueEnd + 1) {
      attribute = item
    }
  }

  return {
    attribute,
    attributes,
    isClosingTag,
    isInsideTag: true,
    tagName,
    tagNameEnd,
    tagNameStart,
    tagStart,
  }
}

export function isOffsetInsideAttributeValue(attribute: WxmlAttributeMatch | null, offset: number) {
  if (!attribute) {
    return false
  }

  return offset >= attribute.valueStart && offset <= attribute.valueEnd
}

export function isLinkAttribute(attributeName: string | null | undefined) {
  return attributeName ? LINK_ATTRIBUTE_NAMES.has(attributeName) : false
}

export function isEventAttribute(attributeName: string | null | undefined) {
  if (!attributeName) {
    return false
  }

  return /^(?:bind|catch|capture-bind|capture-catch|mut-bind|@)/u.test(attributeName)
}

export function getWxmlInterpolationContext(sourceText: string, offset: number): WxmlInterpolationContext | null {
  const openIndex = sourceText.lastIndexOf('{{', offset)
  const closeIndex = sourceText.indexOf('}}', offset)

  if (openIndex < 0 || closeIndex < 0 || openIndex > offset || closeIndex < offset) {
    return null
  }

  return {
    expression: sourceText.slice(openIndex + 2, closeIndex).trim(),
    start: openIndex + 2,
    end: closeIndex,
  }
}

export function getPrimaryScriptIdentifier(expression: string) {
  return expression.trim().match(/[$A-Z_a-z][\w$]*/u)?.[0] ?? null
}

export function getClassNameAtOffset(value: string, valueStartOffset: number, absoluteOffset: number) {
  const relativeOffset = absoluteOffset - valueStartOffset

  if (relativeOffset < 0 || relativeOffset > value.length) {
    return null
  }

  let tokenStart = relativeOffset
  let tokenEnd = relativeOffset

  while (tokenStart > 0 && /[\w-]/u.test(value[tokenStart - 1] ?? '')) {
    tokenStart -= 1
  }

  while (tokenEnd < value.length && /[\w-]/u.test(value[tokenEnd] ?? '')) {
    tokenEnd += 1
  }

  const className = value.slice(tokenStart, tokenEnd).trim()

  return className || null
}
