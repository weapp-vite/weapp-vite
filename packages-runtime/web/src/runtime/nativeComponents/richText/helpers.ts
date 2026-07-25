import type { ChildNode, DataNode, Element, Node } from 'domhandler'
import { parseDocument } from 'htmlparser2'

export interface RichTextSourceNode {
  type?: string
  name?: string
  attrs?: Record<string, unknown>
  children?: RichTextSourceNode[]
  text?: string
}

export type SafeRichTextNode
  = | { type: 'text', text: string }
    | { type: 'element', name: string, attrs: Record<string, string>, children: SafeRichTextNode[] }

const ALLOWED_TAGS = new Set([
  'a',
  'abbr',
  'address',
  'article',
  'aside',
  'b',
  'bdi',
  'bdo',
  'big',
  'blockquote',
  'br',
  'caption',
  'center',
  'cite',
  'code',
  'col',
  'colgroup',
  'dd',
  'del',
  'div',
  'dl',
  'dt',
  'em',
  'fieldset',
  'font',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'i',
  'img',
  'ins',
  'label',
  'legend',
  'li',
  'mark',
  'ol',
  'p',
  'pre',
  'q',
  'rt',
  'ruby',
  's',
  'section',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'tt',
  'u',
  'ul',
])

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

const ALLOWED_STYLE_PROPERTIES = new Set([
  'background',
  'background-color',
  'border',
  'border-bottom',
  'border-color',
  'border-left',
  'border-radius',
  'border-right',
  'border-style',
  'border-top',
  'border-width',
  'color',
  'display',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'height',
  'letter-spacing',
  'line-height',
  'margin',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'margin-top',
  'max-height',
  'max-width',
  'min-height',
  'min-width',
  'opacity',
  'overflow',
  'padding',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'padding-top',
  'text-align',
  'text-decoration',
  'text-indent',
  'text-overflow',
  'text-transform',
  'vertical-align',
  'white-space',
  'width',
  'word-break',
  'word-wrap',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isSafeUrl(value: string, attribute: string) {
  const normalized = Array.from(value)
    .filter(character => character.charCodeAt(0) > 0x20)
    .join('')
    .toLowerCase()
  if (!normalized || normalized.startsWith('#') || normalized.startsWith('/') || normalized.startsWith('./') || normalized.startsWith('../')) {
    return true
  }
  if (/^(?:https?:|mailto:|tel:)/.test(normalized)) {
    return true
  }
  return attribute === 'src' && /^data:image\/(?:gif|jpe?g|png|webp);base64,/.test(normalized)
}

function isSafeStyleValue(value: string) {
  const normalized = value.toLowerCase().replace(/\s+/g, '')
  return !normalized.includes('url(')
    && !normalized.includes('expression(')
    && !normalized.includes('javascript:')
    && !normalized.includes('behavior:')
    && !normalized.includes('-moz-binding')
}

export function sanitizeRichTextStyle(value: unknown) {
  const source = isRecord(value)
    ? Object.entries(value)
        .map(([property, propertyValue]) => `${property}:${String(propertyValue)}`)
        .join(';')
    : String(value ?? '')
  const declarations: string[] = []
  for (const declaration of source.split(';')) {
    const separator = declaration.indexOf(':')
    if (separator <= 0) {
      continue
    }
    const property = declaration.slice(0, separator).trim().toLowerCase()
    const propertyValue = declaration.slice(separator + 1).trim()
    if (ALLOWED_STYLE_PROPERTIES.has(property) && propertyValue && isSafeStyleValue(propertyValue)) {
      declarations.push(`${property}: ${propertyValue}`)
    }
  }
  return declarations.join('; ')
}

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
  const children = Array.isArray(value.children)
    ? value.children.flatMap(convertSourceNode)
    : []
  const name = String(value.name ?? '').toLowerCase()
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

function hasChildren(node: Node): node is Node & { children: ChildNode[] } {
  return Array.isArray((node as Node & { children?: ChildNode[] }).children)
}

function convertParsedNode(node: Node): SafeRichTextNode[] {
  if (node.type === 'text') {
    return [{ type: 'text', text: (node as DataNode).data ?? '' }]
  }
  if (node.type !== 'tag') {
    return []
  }
  const element = node as Element
  const children = hasChildren(node) ? node.children.flatMap(convertParsedNode) : []
  const name = element.name.toLowerCase()
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
