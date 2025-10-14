import type { ChildNode, DataNode, Element, Node } from 'domhandler'
import { parseDocument } from 'htmlparser2'

export type TemplateScope = Record<string, any>
export type TemplateRenderer = (scope?: TemplateScope) => string

interface RenderOptions {
  skipFor?: boolean
  overrideAttribs?: Record<string, string>
}

interface ExtractForResult {
  expr?: string
  itemName: string
  indexName: string
  restAttribs: Record<string, string>
}

const CONTROL_ATTRS = new Set([
  'wx:if',
  'wx:elif',
  'wx:else',
  'wx:for',
  'wx:for-item',
  'wx:for-index',
  'wx:key',
])

const EVENT_PREFIX_RE = /^(?:bind|catch|mut-bind|capture-bind|capture-catch)([\w-]+)$/
const EVENT_KIND_ALIAS: Record<string, string> = {
  tap: 'click',
}

const SELF_CLOSING_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'image',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

const templateCache = new Map<string, ChildNode[]>()
const expressionCache = new Map<string, (scope: TemplateScope) => any>()

function filterRenderableNode(node: Node) {
  if (node.type === 'directive' || node.type === 'comment') {
    return false
  }
  if (node.type === 'text') {
    const data = (node as DataNode).data ?? ''
    return data.trim().length > 0
  }
  return true
}

function getOrParseTemplate(source: string) {
  let cached = templateCache.get(source)
  if (!cached) {
    const document = parseDocument(source, {
      xmlMode: true,
      decodeEntities: true,
      recognizeSelfClosing: true,
    })
    cached = (document.children ?? []).filter(filterRenderableNode)
    templateCache.set(source, cached)
  }
  return cached
}

function createScope(initial?: TemplateScope) {
  return Object.assign(Object.create(null), initial ?? {})
}

function createChildScope(parent: TemplateScope) {
  return Object.assign(Object.create(parent), {})
}

function normalizeList(value: any): any[] {
  if (Array.isArray(value)) {
    return value
  }
  if (value == null) {
    return []
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const length = Math.max(0, Math.floor(value))
    return Array.from({ length }, (_, index) => index)
  }
  if (typeof value === 'object') {
    return Object.values(value)
  }
  return []
}

function normalizeTagName(name: string) {
  switch (name) {
    case 'view':
    case 'cover-view':
    case 'navigator':
    case 'scroll-view':
    case 'swiper':
    case 'swiper-item':
    case 'movable-area':
    case 'movable-view':
    case 'cover-image':
      return 'div'
    case 'text':
    case 'icon':
      return 'span'
    case 'image':
      return 'img'
    case 'button':
      return 'button'
    case 'input':
      return 'input'
    case 'textarea':
      return 'textarea'
    case 'form':
      return 'form'
    case 'label':
      return 'label'
    case 'picker':
    case 'picker-view':
      return 'select'
    case 'block':
      return '#fragment'
    default:
      return name || 'div'
  }
}

function normalizeAttributeName(name: string) {
  if (name === 'class' || name === 'style' || name.startsWith('data-')) {
    return name
  }
  if (name === 'hover-class') {
    return 'data-hover-class'
  }
  return name.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (match) => {
    switch (match) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case '\'':
        return '&#39;'
      default:
        return match
    }
  })
}

function escapeAttribute(value: string) {
  return escapeHtml(value)
}

function toDisplayString(value: any) {
  if (value == null) {
    return ''
  }
  if (typeof value === 'object') {
    if (value instanceof Date) {
      return value.toISOString()
    }
    try {
      return JSON.stringify(value)
    }
    catch {
      return String(value)
    }
  }
  return String(value)
}

function unwrapExpression(expression: string) {
  const trimmed = expression.trim()
  if (trimmed.startsWith('{{') && trimmed.endsWith('}}')) {
    return trimmed.slice(2, -2).trim()
  }
  return trimmed
}

function evaluateExpression(expression: string, scope: TemplateScope) {
  if (!expression) {
    return undefined
  }
  const trimmed = unwrapExpression(expression)
  if (!trimmed) {
    return undefined
  }
  let evaluator = expressionCache.get(trimmed)
  if (!evaluator) {
    try {
      // eslint-disable-next-line no-new-func -- dynamic expressions are required for template evaluation
      evaluator = new Function('scope', `with(scope){ return (${trimmed}); }`) as (scope: TemplateScope) => any
    }
    catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new SyntaxError(`[@weapp-vite/web] 无法解析表达式 "${trimmed}": ${reason}`)
    }
    expressionCache.set(trimmed, evaluator)
  }
  try {
    return evaluator(scope)
  }
  catch {
    return undefined
  }
}

function interpolateText(source: string, scope: TemplateScope, escapeResult: boolean) {
  if (!source.includes('{{')) {
    return escapeResult ? escapeHtml(source) : source
  }

  let cursor = 0
  let buffer = ''

  while (cursor < source.length) {
    const start = source.indexOf('{{', cursor)
    if (start === -1) {
      buffer += source.slice(cursor)
      break
    }

    buffer += source.slice(cursor, start)

    const end = source.indexOf('}}', start + 2)
    if (end === -1) {
      buffer += source.slice(start)
      break
    }

    const expression = source.slice(start + 2, end).trim()
    const evaluated = toDisplayString(evaluateExpression(expression, scope))
    buffer += evaluated
    cursor = end + 2
  }

  return escapeResult ? escapeHtml(buffer) : buffer
}

function resolveAttributeValue(value: string, scope: TemplateScope) {
  return interpolateText(value ?? '', scope, false)
}

function extractFor(attribs: Record<string, string>): ExtractForResult {
  const expr = attribs['wx:for']
  const restAttribs: Record<string, string> = {}
  const itemName = attribs['wx:for-item']?.trim() || 'item'
  let indexName = attribs['wx:for-index']?.trim() || 'index'

  for (const [key, val] of Object.entries(attribs)) {
    if (key === 'wx:for' || key === 'wx:for-item' || key === 'wx:for-index' || key === 'wx:key') {
      continue
    }
    restAttribs[key] = val
  }

  if (itemName === indexName) {
    indexName = `${indexName}Index`
  }

  return {
    expr,
    itemName,
    indexName,
    restAttribs,
  }
}

function buildAttributeString(
  attribs: Record<string, string>,
  scope: TemplateScope,
) {
  let result = ''
  for (const [name, rawValue] of Object.entries(attribs)) {
    if (CONTROL_ATTRS.has(name)) {
      continue
    }

    const eventMatch = EVENT_PREFIX_RE.exec(name)
    if (eventMatch) {
      const [, rawEvent] = eventMatch
      const event = rawEvent.toLowerCase()
      const handlerName = resolveAttributeValue(rawValue, scope).trim()
      if (!handlerName) {
        continue
      }
      const runtimeEvent = EVENT_KIND_ALIAS[event] ?? event
      result += ` data-wx-on-${runtimeEvent}="${escapeAttribute(handlerName)}"`
      continue
    }

    const value = resolveAttributeValue(rawValue, scope)
    if (value === '') {
      continue
    }
    const normalizedName = normalizeAttributeName(name)
    result += ` ${normalizedName}="${escapeAttribute(value)}"`
  }
  return result
}

function renderElement(
  node: Element,
  scope: TemplateScope,
  renderChildren: (nodes: ChildNode[] | undefined, scope: TemplateScope) => string,
  options: RenderOptions = {},
) {
  const attribs = node.attribs ?? {}
  if (!options.skipFor) {
    const forExtract = extractFor(attribs)
    if (forExtract.expr) {
      const list = normalizeList(evaluateExpression(forExtract.expr, scope))
      if (!list.length) {
        return ''
      }
      let buffer = ''
      for (let idx = 0; idx < list.length; idx++) {
        const item = list[idx]
        const childScope = createChildScope(scope)
        childScope[forExtract.itemName] = item
        childScope[forExtract.indexName] = idx
        buffer += renderElement(node, childScope, renderChildren, {
          skipFor: true,
          overrideAttribs: forExtract.restAttribs,
        })
      }
      return buffer
    }
  }

  const effectiveAttribs = options.overrideAttribs ?? attribs
  const conditionExpr = effectiveAttribs['wx:if'] ?? effectiveAttribs['wx:elif']
  if (conditionExpr) {
    const condition = evaluateExpression(conditionExpr, scope)
    if (!condition) {
      return ''
    }
  }

  if (effectiveAttribs['wx:else']) {
    // wx:else should render when previous branch is false.
    // Minimal implementation always renders, leaving flow control to template author.
  }

  const normalizedTag = normalizeTagName(node.name)
  if (normalizedTag === '#fragment') {
    return renderChildren(node.children, scope)
  }

  const attrs = buildAttributeString(effectiveAttribs, scope)
  const children = renderChildren(node.children, scope)

  if (SELF_CLOSING_TAGS.has(normalizedTag) && !children) {
    return `<${normalizedTag}${attrs} />`
  }

  return `<${normalizedTag}${attrs}>${children}</${normalizedTag}>`
}

function renderTextNode(node: DataNode, scope: TemplateScope) {
  const value = node.data ?? ''
  if (!value.trim()) {
    return ''
  }
  return interpolateText(value, scope, true)
}

function renderTree(
  input: ChildNode[] | ChildNode | undefined,
  scope: TemplateScope,
): string {
  if (!input) {
    return ''
  }

  if (Array.isArray(input)) {
    let buffer = ''
    for (const node of input) {
      buffer += renderTree(node, scope)
    }
    return buffer
  }

  const node = input
  if (node.type === 'text') {
    return renderTextNode(node as DataNode, scope)
  }
  if (node.type === 'tag' || node.type === 'script' || node.type === 'style') {
    return renderElement(node as Element, scope, renderTree)
  }
  if ('children' in node && node.children?.length) {
    return renderTree(node.children, scope)
  }
  return ''
}

export function renderTemplate(nodes: ChildNode[], scope?: TemplateScope) {
  const renderScope = createScope(scope)
  return renderTree(nodes, renderScope)
}

export function createTemplate(source: string): TemplateRenderer {
  const nodes = getOrParseTemplate(source)
  return (scope?: TemplateScope) => renderTemplate(nodes, scope)
}
