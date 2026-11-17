import type { DataNode, Element, Node } from 'domhandler'
import type { SafeRichTextNode } from './rich-text-shared'
import { parseDocument } from 'htmlparser2'
import { ALLOWED_TAGS, isRecord, isSafeUrl, sanitizeRichTextStyle } from './rich-text-shared'

export { normalizeNativeRichTextNodes, sanitizeNativeRichTextAttributes } from './rich-text-native'
export { sanitizeRichTextStyle } from './rich-text-shared'
export type { RichTextSourceNode, SafeRichTextNode } from './rich-text-shared'

const ALLOWED_ATTRIBUTES = new Set([
  'abbr',
  'align',
  'alt',
  'axis',
  'bgcolor',
  'border',
  'cellpadding',
  'cellspacing',
  'class',
  'colspan',
  'dir',
  'height',
  'href',
  'id',
  'lang',
  'rowspan',
  'scope',
  'span',
  'start',
  'style',
  'summary',
  'target',
  'title',
  'type',
  'valign',
  'width',
])

const URL_ATTRIBUTES = new Set(['href', 'src'])
export function sanitizeRichTextAttributes(value: unknown, tagName: string) {
  if (!isRecord(value)) {
    return {}
  }
  const attributes: Record<string, string> = {}
  for (const [rawName, rawValue] of Object.entries(value)) {
    const name = rawName.trim().toLowerCase()
    if (name.startsWith('on') || name === 'srcdoc') {
      continue
    }
    if (!ALLOWED_ATTRIBUTES.has(name) && name !== 'src' && !name.startsWith('aria-') && !name.startsWith('data-')) {
      continue
    }
    if (name === 'src' && tagName !== 'img') {
      continue
    }
    const serialized = name === 'style' ? sanitizeRichTextStyle(rawValue) : String(rawValue ?? '')
    if (!serialized || (URL_ATTRIBUTES.has(name) && !isSafeUrl(serialized, name))) {
      continue
    }
    attributes[name] = serialized
  }
  if (tagName === 'a') {
    attributes.rel = 'noopener noreferrer'
  }
  return attributes
}

function convertSourceNode(value: unknown): SafeRichTextNode[] {
  if (!isRecord(value)) {
    return []
  }
  if (value.type === 'text' || (!value.name && typeof value.text === 'string')) {
    return [{ type: 'text', text: String(value.text ?? '') }]
  }
  const name = String(value.name ?? '').toLowerCase()
  const children = Array.isArray(value.children)
    ? value.children.flatMap(convertSourceNode)
    : []
  if (!ALLOWED_TAGS.has(name)) {
    return children
  }
  return [{
    type: 'element',
    name,
    attrs: sanitizeRichTextAttributes(value.attrs, name),
    children,
  }]
}

function convertParsedNode(node: Node): SafeRichTextNode[] {
  if (node.type === 'text') {
    return [{ type: 'text', text: (node as DataNode).data }]
  }
  if (node.type !== 'tag') {
    return []
  }
  const element = node as Element
  const name = element.name.toLowerCase()
  const children = element.children.flatMap(convertParsedNode)
  if (!ALLOWED_TAGS.has(name)) {
    return children
  }
  return [{
    type: 'element',
    name,
    attrs: sanitizeRichTextAttributes(element.attribs, name),
    children,
  }]
}

export function normalizeRichTextNodes(value: unknown): SafeRichTextNode[] {
  if (typeof value === 'string') {
    const document = parseDocument(value, {
      decodeEntities: true,
      lowerCaseAttributeNames: true,
      lowerCaseTags: true,
    })
    return document.children.flatMap(convertParsedNode)
  }
  const values = Array.isArray(value) ? value : [value]
  return values.flatMap(convertSourceNode)
}
