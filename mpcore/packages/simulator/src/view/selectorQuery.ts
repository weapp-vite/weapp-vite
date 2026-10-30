import type {
  HeadlessWxSelectorQueryFieldsOption,
  HeadlessWxSelectorQueryRequest,
  HeadlessWxWindowInfoResult,
} from '../host'
import type { HeadlessPageInstance } from '../runtime'
import { getInspectionChildren } from './inspectionTree'
import { getNativeScrollOffset } from './nativeNode'
import { collectNodeDataset } from './nodeDataset'
import { parseStyleDeclarations, resolveRect } from './nodeGeometry'
import { querySelectorAll } from './selectors'

interface DomNodeLike {
  attribs?: Record<string, string>
  children?: DomNodeLike[]
  data?: string
  dataset?: Record<string, unknown>
  name?: string
  parent?: DomNodeLike | null
  type?: string
}

export interface HeadlessSelectorQueryResolverOptions {
  page: HeadlessPageInstance
  resolveContext?: (node: DomNodeLike) => unknown
  root: DomNodeLike
  scopeId?: string | null
  windowInfo: HeadlessWxWindowInfoResult
}

interface ResolvedSelectorQueryOptions extends HeadlessSelectorQueryResolverOptions {
  unprojected?: boolean
}

const LEADING_MARK_PREFIX_RE = /^mark[:\-]?/
const MARK_NAME_RE = /[:\-]([a-z])/g

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

function findNodeByScopeId(root: DomNodeLike, scopeId: string, includeUnprojected = false): DomNodeLike | null {
  if (root.attribs?.['data-sim-scope'] === scopeId) {
    return root
  }

  const children = includeUnprojected ? getInspectionChildren(root) : root.children ?? []
  for (const child of children) {
    const match = findNodeByScopeId(child, scopeId, includeUnprojected)
    if (match) {
      return match
    }
  }

  return null
}

export function resolveSelectorScrollTop(root: DomNodeLike, selector?: string | null) {
  const normalizedSelector = selector?.trim()
  if (!normalizedSelector) {
    return null
  }

  const match = querySelectorAll(root, normalizedSelector)[0]
  return match ? resolveRect(match).top : null
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
    return collectNodeDataset(node)
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
  options: ResolvedSelectorQueryOptions,
) {
  const result: Record<string, any> = {}

  if (fields.id) {
    result.id = node.attribs?.id ?? ''
  }
  if (fields.dataset) {
    result.dataset = collectNodeDataset(node)
  }
  if (fields.mark) {
    result.mark = collectMark(node)
  }
  if (fields.rect || fields.size) {
    const rect = options.unprojected
      ? { bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0 }
      : resolveRect(node, options.root.name === 'page' ? options.windowInfo : undefined)
    if (fields.rect) {
      Object.assign(result, rect)
    }
    if (fields.size) {
      result.width = rect.width
      result.height = rect.height
    }
  }
  if (fields.scrollOffset) {
    Object.assign(result, getNativeScrollOffset(options.page, node))
  }
  if (Array.isArray(fields.properties) && fields.properties.length > 0) {
    Object.assign(result, pickProperties(node, fields.properties))
  }
  if (Array.isArray(fields.computedStyle) && fields.computedStyle.length > 0) {
    Object.assign(result, pickComputedStyle(node, fields.computedStyle))
  }
  if (fields.context) {
    result.context = options.resolveContext?.(node) ?? {
      type: 'unsupported-context',
    }
  }
  if (fields.node) {
    const context = options.resolveContext?.(node)
    result.node = node.name === 'canvas' && context
      ? {
          getContext: () => context,
          type: 'canvas',
        }
      : {
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
  options: ResolvedSelectorQueryOptions,
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
  let resolved: ResolvedSelectorQueryOptions = options
  if (options.scopeId) {
    const projected = findNodeByScopeId(options.root, options.scopeId)
    const declared = projected ?? findNodeByScopeId(options.root, options.scopeId, true)
    resolved = {
      ...options,
      root: declared ? createScopedRoot(declared) : { type: 'root', children: [] },
      unprojected: !projected,
    }
  }
  return requests.map(request => resolveRequestResult(request, resolved))
}

export function resolveSelectorQueryScopeRoot(root: DomNodeLike, scopeId?: string | null) {
  if (!scopeId) {
    return root
  }

  const scopedNode = findNodeByScopeId(root, scopeId)
  return scopedNode ? createScopedRoot(scopedNode) : root
}
