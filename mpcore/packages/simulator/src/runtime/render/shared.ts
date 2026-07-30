import type { ArtifactSource } from '../../kernel'
import type { DomNodeLike, RuntimeRenderScope } from './types'
import { parseDocument } from 'htmlparser2'
import { resolveTemplateExpression } from '../../view/templateExpression'

const TEMPLATE_INTERPOLATION_RE = /\{\{([^{}]+)\}\}/g
const DATASET_NAME_RE = /-([a-z])/g

export const LEADING_SLASH_RE = /^\/+/
export const EVENT_BINDING_ATTRS = ['bindtap', 'bind:tap', 'catchtap', 'catch:tap']
export const STRUCTURAL_ATTRS = ['wx:if', 'wx:elif', 'wx:else', 'wx:for', 'wx:for-item', 'wx:for-index', 'wx:key']
export const WX_ELSE_ATTRS = new Set(['wx:elif', 'wx:else'])
export const CLASS_SPLIT_RE = /\s+/
export const JS_FILE_RE = /\.js$/

export function isMustacheOnly(value: string) {
  const trimmed = value.trim()
  return trimmed.startsWith('{{') && trimmed.endsWith('}}') && !trimmed.includes('{{', 2)
}

function toDatasetKey(attributeName: string) {
  return attributeName
    .slice('data-'.length)
    .replace(DATASET_NAME_RE, (_match, char: string) => char.toUpperCase())
}

export function collectDataset(node: DomNodeLike) {
  const dataset: Record<string, string> = {}
  for (const [key, value] of Object.entries(node.attribs ?? {})) {
    if (!key.startsWith('data-') || key === 'data-sim-scope' || key === 'data-sim-tap' || key === 'data-sim-component') {
      continue
    }
    dataset[toDatasetKey(key)] = String(value)
  }
  return dataset
}

function escapeText(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function escapeAttribute(value: string) {
  return escapeText(value).replaceAll('"', '&quot;')
}

export function cloneNode(node: DomNodeLike): DomNodeLike {
  return {
    ...node,
    attribs: node.attribs ? { ...node.attribs } : undefined,
    children: node.children?.map(child => cloneNode(child)),
  }
}

export function resolveValueByPath(source: Record<string, any>, expression: string) {
  return resolveTemplateExpression(source, expression) ?? ''
}

export function resolveRawValueByPath(source: Record<string, any>, expression: string) {
  return resolveTemplateExpression(source, expression)
}

function interpolateTemplate(input: string, data: Record<string, any>) {
  return input.replace(TEMPLATE_INTERPOLATION_RE, (_match, expression: string) => {
    const value = resolveValueByPath(data, expression)
    return typeof value === 'string' ? value : String(value)
  })
}

export function readTemplateSource(artifactSource: ArtifactSource, filePath: string) {
  const source = artifactSource.readText(filePath)
  if (source == null) {
    throw new Error(`Missing template in headless runtime: ${filePath}`)
  }
  return source
}

export function parseTemplateDocument(templateSource: string) {
  return parseDocument(`<page>${templateSource}</page>`, {
    xmlMode: false,
    decodeEntities: false,
    lowerCaseAttributeNames: false,
    recognizeSelfClosing: true,
  }) as unknown as DomNodeLike
}

export function serializeDomNode(node: DomNodeLike): string {
  if (node.type === 'text') {
    return escapeText(node.data ?? '')
  }

  if (node.type === 'root') {
    return (node.children ?? []).map(serializeDomNode).join('')
  }

  const tagName = node.name ?? ''
  if (!tagName) {
    return (node.children ?? []).map(serializeDomNode).join('')
  }

  const attrs = Object.entries(node.attribs ?? {})
    .map(([key, value]) => ` ${key}="${escapeAttribute(value)}"`)
    .join('')
  const children = (node.children ?? []).map(serializeDomNode).join('')
  return `<${tagName}${attrs}>${children}</${tagName}>`
}

export function isTagNode(node: DomNodeLike): node is DomNodeLike & { name: string, type: string } {
  return node.type === 'tag' && typeof node.name === 'string'
}

export function isIgnorableTextNode(node: DomNodeLike) {
  return node.type === 'text' && typeof node.data === 'string' && node.data.trim() === ''
}

function resolveAttributeValue(value: string, scope: RuntimeRenderScope) {
  if (isMustacheOnly(value)) {
    const expression = value.trim().slice(2, -2)
    return resolveValueByPath(scope.data, expression)
  }
  return interpolateTemplate(value, scope.data)
}

export function resolveComponentAttributeValue(value: string, scope: RuntimeRenderScope) {
  if (isMustacheOnly(value)) {
    const expression = value.trim().slice(2, -2)
    return resolveRawValueByPath(scope.data, expression)
  }
  return interpolateTemplate(value, scope.data)
}

export function applyNodeBindings(node: DomNodeLike, scope: RuntimeRenderScope) {
  if (!isTagNode(node)) {
    if (node.type === 'text' && typeof node.data === 'string') {
      node.data = interpolateTemplate(node.data, scope.data)
    }
    return
  }

  node.attribs ??= {}
  node.attribs['data-sim-scope'] = scope.getScopeId()

  for (const key of STRUCTURAL_ATTRS) {
    delete node.attribs[key]
  }

  for (const [key, value] of Object.entries({ ...node.attribs })) {
    if (EVENT_BINDING_ATTRS.includes(key)) {
      node.attribs['data-sim-tap'] = value
      continue
    }
    node.attribs[key] = typeof value === 'string'
      ? String(resolveAttributeValue(value, scope))
      : String(value)
  }
}

export function createMergedScopeData(
  pageData: Record<string, any>,
  componentProperties: Record<string, any>,
  componentData: Record<string, any>,
) {
  return {
    ...pageData,
    ...componentProperties,
    ...componentData,
  }
}

export function evaluateConditionalBranch(node: DomNodeLike, scope: RuntimeRenderScope) {
  const condition = node.attribs?.['wx:if'] ?? node.attribs?.['wx:elif']
  if (condition == null) {
    return true
  }
  return Boolean(resolveRawValueByPath(scope.data, condition))
}

export function createLoopScope(scope: RuntimeRenderScope, itemName: string, indexName: string, item: unknown, index: number): RuntimeRenderScope {
  return {
    ...scope,
    data: {
      ...scope.data,
      [indexName]: index,
      [itemName]: item,
    },
  }
}
