import type { LoadWxsModule } from '../../view/wxs'
import type { BrowserVirtualFiles } from '../virtualFiles'
import type { BrowserRenderScope, DomNodeLike } from './types'
import { dirname, join, normalize } from 'pathe'
import { collectNodeDataset, isDatasetAttribute, toDatasetKey } from '../../view/nodeDataset'
import { resolveTemplateExpression } from '../../view/templateExpression'
import { createImportedTemplateState } from '../../view/templateImports'
import { isTemplateExpression } from '../../view/templateInterpolation'
import { interpolateTemplateText } from '../../view/templateText'
import { wxsScopeData } from '../../view/wxs'
import { parseWxsTemplateDocument } from '../../view/wxsDocument'
import { readBrowserVirtualFile } from '../virtualFiles'

export const LEADING_SLASH_RE = /^\/+/
export const EVENT_BINDING_ATTRS = ['bindtap', 'bind:tap', 'catchtap', 'catch:tap']
export const STRUCTURAL_ATTRS = ['wx:if', 'wx:elif', 'wx:else', 'wx:for', 'wx:for-item', 'wx:for-index', 'wx:key']
export const WX_ELSE_ATTRS = new Set(['wx:elif', 'wx:else'])
export const CLASS_SPLIT_RE = /\s+/
export const JS_FILE_RE = /\.js$/

export function isMustacheOnly(value: string) {
  return isTemplateExpression(value)
}

export function collectDataset(node: DomNodeLike, source?: Record<string, unknown>) {
  if (node.dataset) {
    return collectNodeDataset(node)
  }

  const dataset: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node.attribs ?? {})) {
    if (!isDatasetAttribute(key)) {
      continue
    }
    dataset[toDatasetKey(key)] = source && isMustacheOnly(value)
      ? resolveTemplateExpression(source, value)
      : value
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
    dataset: node.dataset ? { ...node.dataset } : undefined,
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
  return interpolateTemplateText(input, data, true)
}

export function readTemplateSource(files: BrowserVirtualFiles, filePath: string) {
  const templateSource = readBrowserVirtualFile(files, filePath)
  if (typeof templateSource !== 'string') {
    throw new TypeError(`Missing template in browser simulator runtime: ${filePath}`)
  }
  return templateSource
}

export function parseTemplateDocument(templateSource: string) {
  return parseWxsTemplateDocument(templateSource) as unknown as DomNodeLike
}

export function prepareTemplateRenderState(files: BrowserVirtualFiles, root: DomNodeLike, filePath: string, projectRoot: string, loadWxs: LoadWxsModule) {
  return createImportedTemplateState(root, filePath, (owner, source) => {
    const resolved = normalize(source.startsWith('/')
      ? join(projectRoot, source.slice(1))
      : join(dirname(owner), source))
    const document = parseTemplateDocument(readTemplateSource(files, resolved))
    return { filePath: resolved, root: document.children?.[0] ?? document }
  }, (owner, node) => {
    const source = node.attribs?.src
    if (source) {
      const resolved = normalize(source.startsWith('/')
        ? join(projectRoot, source.slice(1))
        : join(dirname(owner), source))
      return loadWxs(resolved)
    }
    const inlineSource = (node.children ?? []).map(child => child.data ?? '').join('')
    return loadWxs(`${owner}#wxs:${node.attribs?.module}`, inlineSource)
  })
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

function resolveAttributeValue(value: string, scope: BrowserRenderScope) {
  if (isMustacheOnly(value)) {
    const expression = value.trim().slice(2, -2)
    return resolveRawValueByPath(wxsScopeData(scope), expression)
  }
  return interpolateTemplate(value, wxsScopeData(scope))
}

export function resolveComponentAttributeValue(value: string, scope: BrowserRenderScope) {
  if (isMustacheOnly(value)) {
    const expression = value.trim().slice(2, -2)
    // 存在 WXML 绑定但值为 undefined 时，宿主传入 null；省略属性仍由组件默认值处理。
    return resolveRawValueByPath(wxsScopeData(scope), expression) ?? null
  }
  return interpolateTemplate(value, wxsScopeData(scope))
}

export function applyNodeBindings(node: DomNodeLike, scope: BrowserRenderScope) {
  if (!isTagNode(node)) {
    if (node.type === 'text' && typeof node.data === 'string') {
      node.data = interpolateTemplateText(node.data, wxsScopeData(scope))
    }
    return
  }

  node.attribs ??= {}
  node.attribs['data-sim-scope'] = scope.getScopeId()

  for (const key of STRUCTURAL_ATTRS) {
    delete node.attribs[key]
  }

  let dataset: Record<string, unknown> | undefined
  for (const [key, value] of Object.entries({ ...node.attribs })) {
    if (EVENT_BINDING_ATTRS.includes(key)) {
      node.attribs['data-sim-tap'] = value
      continue
    }
    const resolvedValue = typeof value === 'string'
      ? resolveAttributeValue(value, scope)
      : value
    node.attribs[key] = String(resolvedValue ?? '')
    if (isDatasetAttribute(key)) {
      dataset ??= {}
      dataset[toDatasetKey(key)] = resolvedValue
    }
  }
  node.dataset = dataset
}

export function evaluateConditionalBranch(node: DomNodeLike, scope: BrowserRenderScope) {
  const condition = node.attribs?.['wx:if'] ?? node.attribs?.['wx:elif']
  if (condition == null) {
    return true
  }
  return Boolean(resolveRawValueByPath(wxsScopeData(scope), condition))
}

export function createLoopScope(scope: BrowserRenderScope, itemName: string, indexName: string, item: unknown, index: number | string): BrowserRenderScope {
  return {
    ...scope,
    data: {
      ...scope.data,
      [indexName]: index,
      [itemName]: item,
    },
  }
}
