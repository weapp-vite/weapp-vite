import type { DataNode, Element, Node } from 'domhandler'
import type { SafeRichTextNode } from './rich-text-shared'
import { decodeHTML } from 'entities'
import { parseDocument } from 'htmlparser2'
import { ALLOWED_TAGS, isRecord, isSafeUrl, sanitizeRichTextStyle } from './rich-text-shared'

const NATIVE_ALLOWED_TAGS = /* @__PURE__ */ new Set([...ALLOWED_TAGS, 'footer', 'nav'])
const NATIVE_TAG_ATTRIBUTES: Record<string, readonly string[]> = {
  bdo: ['dir'],
  col: ['span', 'width'],
  colgroup: ['span', 'width'],
  img: ['alt', 'src', 'height', 'width'],
  ol: ['start', 'type'],
  table: ['width'],
  td: ['colspan', 'height', 'rowspan', 'width'],
  th: ['colspan', 'height', 'rowspan', 'width'],
  tr: ['colspan', 'height', 'rowspan', 'width'],
}

export function sanitizeNativeRichTextAttributes(value: unknown, tagName: string) {
  if (!isRecord(value)) {
    return {}
  }
  const attributes: Record<string, string> = {}
  const nativeAttributes = Object.prototype.hasOwnProperty.call(NATIVE_TAG_ATTRIBUTES, tagName) ? NATIVE_TAG_ATTRIBUTES[tagName] : undefined
  for (const [rawName, rawValue] of Object.entries(value)) {
    const name = rawName.trim().toLowerCase()
    if (name.startsWith('on') || name === 'srcdoc') {
      continue
    }
    if (name !== 'class' && name !== 'style' && !nativeAttributes?.includes(name)) {
      continue
    }
    if (name === 'src' && tagName !== 'img') {
      continue
    }
    const serialized = name === 'style' ? sanitizeRichTextStyle(rawValue) : String(rawValue ?? '')
    if (!serialized || (name === 'src' && !isSafeUrl(serialized, name))) {
      continue
    }
    if (name === 'src' && !/^(?:https?:)?\/\//i.test(serialized.trim())) {
      continue
    }
    attributes[name] = serialized
  }
  return attributes
}

function convertSourceNode(value: unknown): SafeRichTextNode[] {
  if (!isRecord(value)) {
    return []
  }
  if (value.type === 'text') {
    return typeof value.text === 'string' ? [{ type: 'text', text: decodeHTML(value.text) }] : []
  }
  if ((value.type !== undefined && value.type !== 'node') || typeof value.name !== 'string') {
    return []
  }
  const name = value.name.toLowerCase()
  if (!NATIVE_ALLOWED_TAGS.has(name)) {
    return []
  }
  const children = Array.isArray(value.children) ? value.children.flatMap(convertSourceNode) : []
  return [{ type: 'element', name, attrs: sanitizeNativeRichTextAttributes(value.attrs, name), children }]
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
  if (!NATIVE_ALLOWED_TAGS.has(name)) {
    return []
  }
  const children = element.children.flatMap(convertParsedNode)
  return [{
    type: 'element',
    name,
    attrs: sanitizeNativeRichTextAttributes(element.attribs, name),
    children,
  }]
}

export function normalizeNativeRichTextNodes(value: unknown): SafeRichTextNode[] {
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
