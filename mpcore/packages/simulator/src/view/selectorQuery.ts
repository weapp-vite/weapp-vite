import type {
  HeadlessWxSelectorQueryBoundingClientRectResult,
  HeadlessWxSelectorQueryFieldsOption,
  HeadlessWxSelectorQueryRequest,
  HeadlessWxSelectorQueryScrollOffsetResult,
  HeadlessWxWindowInfoResult,
} from '../host'
import type { HeadlessPageInstance } from '../runtime'
import { querySelectorAll } from './selectors'

interface DomNodeLike {
  attribs?: Record<string, string>
  children?: DomNodeLike[]
  data?: string
  name?: string
  parent?: DomNodeLike | null
  type?: string
}

export interface HeadlessSelectorQueryResolverOptions {
  page: HeadlessPageInstance
  root: DomNodeLike
  windowInfo: HeadlessWxWindowInfoResult
}

const DATASET_NAME_RE = /-([a-z])/g
const LEADING_MARK_PREFIX_RE = /^mark[:\-]?/
const MARK_NAME_RE = /[:\-]([a-z])/g
const NUMERIC_LIKE_VALUE_RE = /-?\d+(?:\.\d+)?/

function toDatasetKey(attributeName: string) {
  return attributeName
    .slice('data-'.length)
    .replace(DATASET_NAME_RE, (_match, char: string) => char.toUpperCase())
}

function collectDataset(node: DomNodeLike) {
  const dataset: Record<string, string> = {}
  for (const [key, value] of Object.entries(node.attribs ?? {})) {
    if (!key.startsWith('data-') || key.startsWith('data-sim-')) {
      continue
    }
    dataset[toDatasetKey(key)] = value
  }
  return dataset
}

function toMarkKey(attributeName: string) {
  return attributeName
    .replace(LEADING_MARK_PREFIX_RE, '')
    .replace(MARK_NAME_RE, (_match, char: string) => char.toUpperCase())
}

function collectMark(node: DomNodeLike) {
  const mark: Record<string, string> = {}
  for (const [key, value] of Object.entries(node.attribs ?? {})) {
    if (!(key.startsWith('mark:') || key.startsWith('mark-'))) {
      continue
    }
    mark[toMarkKey(key)] = value
  }
  return mark
}

function createScopedRoot(node: DomNodeLike): DomNodeLike {
  return {
    children: [node],
    type: 'root',
  }
}

function findNodeByScopeId(root: DomNodeLike, scopeId: string): DomNodeLike | null {
  if (root.attribs?.['data-sim-scope'] === scopeId) {
    return root
  }

  for (const child of root.children ?? []) {
    const match = findNodeByScopeId(child, scopeId)
    if (match) {
      return match
    }
  }

  return null
}

function parseStyleDeclarations(styleValue?: string) {
  const declarations: Record<string, string> = {}
  if (!styleValue) {
    return declarations
  }

  for (const declaration of styleValue.split(';')) {
    const [rawProperty, ...rawValueParts] = declaration.split(':')
    const property = rawProperty?.trim()
    if (!property) {
      continue
    }
    declarations[property] = rawValueParts.join(':').trim()
  }

  return declarations
}

function parseNumericLikeValue(value?: string) {
  if (!value) {
    return 0
  }
  const match = value.match(NUMERIC_LIKE_VALUE_RE)
  return match ? Number(match[0]) : 0
}

function resolveRect(node: DomNodeLike): HeadlessWxSelectorQueryBoundingClientRectResult {
  const style = parseStyleDeclarations(node.attribs?.style)
  const left = parseNumericLikeValue(node.attribs?.['data-sim-left'] ?? style.left)
  const top = parseNumericLikeValue(node.attribs?.['data-sim-top'] ?? style.top)
  const width = parseNumericLikeValue(node.attribs?.['data-sim-width'] ?? style.width)
  const height = parseNumericLikeValue(node.attribs?.['data-sim-height'] ?? style.height)
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
  }
}

export function resolveSelectorScrollTop(root: DomNodeLike, selector?: string | null) {
  const normalizedSelector = selector?.trim()
  if (!normalizedSelector) {
    return null
  }

  const match = querySelectorAll(root, normalizedSelector)[0]
  return match ? resolveRect(match).top : null
}

function resolveScrollOffset(node: DomNodeLike): HeadlessWxSelectorQueryScrollOffsetResult {
  return {
    scrollLeft: parseNumericLikeValue(node.attribs?.['data-sim-scroll-left']),
    scrollTop: parseNumericLikeValue(node.attribs?.['data-sim-scroll-top']),
  }
}

function resolvePropertyValue(node: DomNodeLike, propertyName: string) {
  const normalizedPropertyName = propertyName.trim()
  if (!normalizedPropertyName) {
    return undefined
  }

  if (normalizedPropertyName === 'id') {
    return node.attribs?.id ?? ''
  }
  if (normalizedPropertyName === 'class') {
    return node.attribs?.class ?? ''
  }
  if (normalizedPropertyName === 'dataset') {
    return collectDataset(node)
  }
  return node.attribs?.[normalizedPropertyName]
}

function pickProperties(node: DomNodeLike, propertyNames: string[]) {
  const result: Record<string, unknown> = {}
  for (const propertyName of propertyNames) {
    result[propertyName] = resolvePropertyValue(node, propertyName)
  }
  return result
}

function pickComputedStyle(node: DomNodeLike, propertyNames: string[]) {
  const style = parseStyleDeclarations(node.attribs?.style)
  const result: Record<string, string> = {}
  for (const propertyName of propertyNames) {
    result[propertyName] = style[propertyName] ?? ''
  }
  return result
}

function resolveFieldsResult(
  node: DomNodeLike,
  fields: HeadlessWxSelectorQueryFieldsOption,
  _options: HeadlessSelectorQueryResolverOptions,
) {
  const result: Record<string, any> = {}

  if (fields.id) {
    result.id = node.attribs?.id ?? ''
  }
  if (fields.dataset) {
    result.dataset = collectDataset(node)
  }
  if (fields.mark) {
    result.mark = collectMark(node)
  }
  if (fields.rect || fields.size) {
    const rect = resolveRect(node)
    if (fields.rect) {
      Object.assign(result, rect)
    }
    if (fields.size) {
      result.width = rect.width
      result.height = rect.height
    }
  }
  if (fields.scrollOffset) {
    Object.assign(result, resolveScrollOffset(node))
  }
  if (Array.isArray(fields.properties) && fields.properties.length > 0) {
    Object.assign(result, pickProperties(node, fields.properties))
  }
  if (Array.isArray(fields.computedStyle) && fields.computedStyle.length > 0) {
    Object.assign(result, pickComputedStyle(node, fields.computedStyle))
  }
  if (fields.context) {
    result.context = {
      type: 'unsupported-context',
    }
  }
  if (fields.node) {
    result.node = {
      type: node.name ?? 'unknown',
    }
  }

  return result
}

function resolveViewportResult(
  fields: HeadlessWxSelectorQueryFieldsOption,
  options: HeadlessSelectorQueryResolverOptions,
) {
  const result: Record<string, any> = {}

  if (fields.rect || fields.size) {
    const rect = {
      bottom: options.windowInfo.windowHeight,
      height: options.windowInfo.windowHeight,
      left: 0,
      right: options.windowInfo.windowWidth,
      top: 0,
      width: options.windowInfo.windowWidth,
    }
    if (fields.rect) {
      Object.assign(result, rect)
    }
    if (fields.size) {
      result.width = rect.width
      result.height = rect.height
    }
  }

  if (fields.scrollOffset) {
    result.scrollLeft = 0
    result.scrollTop = options.page.__scrollTop__ ?? 0
  }

  return result
}

function resolveRequestResult(
  request: HeadlessWxSelectorQueryRequest,
  options: HeadlessSelectorQueryResolverOptions,
) {
  if (request.target === 'viewport') {
    return resolveViewportResult(request.fields, options)
  }

  const matches = querySelectorAll(options.root, request.selector ?? '')
  if (!request.single) {
    return matches.map(node => resolveFieldsResult(node, request.fields, options))
  }

  const match = matches[0]
  return match ? resolveFieldsResult(match, request.fields, options) : null
}

export function executeSelectorQueryRequests(
  requests: HeadlessWxSelectorQueryRequest[],
  options: HeadlessSelectorQueryResolverOptions,
) {
  return requests.map(request => resolveRequestResult(request, options))
}

export function resolveSelectorQueryScopeRoot(root: DomNodeLike, scopeId?: string | null) {
  if (!scopeId) {
    return root
  }

  const scopedNode = findNodeByScopeId(root, scopeId)
  return scopedNode ? createScopedRoot(scopedNode) : root
}
