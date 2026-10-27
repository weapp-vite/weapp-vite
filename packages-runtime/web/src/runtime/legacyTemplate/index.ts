import type { ChildNode, DataNode, Element, Node } from 'domhandler'
import type { LegacyDatasetValues } from './dataset'
import type {
  LegacyTemplateRenderer,
  LegacyTemplateScope,
  RenderOptions,
} from './types'
import { parseDocument } from 'htmlparser2'
import {
  hasControlAttribute,
  normalizeTagName,
  resolveControlAttributeValue,
  SELF_CLOSING_TAGS,
} from '../../shared/wxml'
import { createLegacyDatasetAnchor, recordLegacyDatasetRender } from './dataset'
import {
  buildAttributeString,
  extractFor,
  isConditionalElement,
  stripControlAttributes,
} from './dom'
import {
  createChildScope,
  createScope,
  evaluateExpression,
  interpolateText,
  normalizeList,
} from './expression'

const templateCache = new Map<string, ChildNode[]>()

function filterRenderableNode(node: Node) {
  if (node.type === 'directive' || node.type === 'comment') {
    return false
  }
  if (node.type === 'text') {
    const data = (node as DataNode).data
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
    cached = document.children.filter(filterRenderableNode)
    templateCache.set(source, cached)
  }
  return cached
}

function renderConditionalSequence(
  nodes: ChildNode[],
  startIndex: number,
  scope: LegacyTemplateScope,
  renderChildren: (input: ChildNode[] | ChildNode | undefined, scope: LegacyTemplateScope) => string,
  datasets?: LegacyDatasetValues,
) {
  const branches: Array<{ node: Element, attribs: Record<string, string> }> = []
  let cursor = startIndex

  while (cursor < nodes.length) {
    const candidate = nodes[cursor]
    if (!isConditionalElement(candidate)) {
      break
    }
    const element = candidate as Element
    const attribs = element.attribs
    if (branches.length === 0 && !hasControlAttribute(attribs, 'if')) {
      break
    }
    if (branches.length > 0 && !hasControlAttribute(attribs, 'elif') && !hasControlAttribute(attribs, 'else')) {
      break
    }
    branches.push({ node: element, attribs })
    cursor += 1
    if (hasControlAttribute(attribs, 'else')) {
      break
    }
  }

  if (!branches.length) {
    const node = nodes[startIndex]
    return {
      rendered: renderChildren(node, scope),
      endIndex: startIndex,
    }
  }

  for (const { node, attribs } of branches) {
    if (hasControlAttribute(attribs, 'else')) {
      return {
        // eslint-disable-next-line ts/no-use-before-define -- 条件分支与普通节点复用同一元素渲染逻辑。
        rendered: renderElement(
          node,
          scope,
          renderChildren,
          { overrideAttribs: stripControlAttributes(attribs) },
          datasets,
        ),
        endIndex: startIndex + branches.length - 1,
      }
    }
    const conditionExpr = resolveControlAttributeValue(attribs, 'if')
      ?? resolveControlAttributeValue(attribs, 'elif')
    if (!conditionExpr) {
      continue
    }
    const condition = evaluateExpression(conditionExpr, scope)
    if (condition) {
      return {
        // eslint-disable-next-line ts/no-use-before-define -- 条件分支与普通节点复用同一元素渲染逻辑。
        rendered: renderElement(
          node,
          scope,
          renderChildren,
          { overrideAttribs: stripControlAttributes(attribs) },
          datasets,
        ),
        endIndex: startIndex + branches.length - 1,
      }
    }
  }

  return {
    rendered: '',
    endIndex: startIndex + branches.length - 1,
  }
}

function renderElement(
  node: Element,
  scope: LegacyTemplateScope,
  renderChildren: (nodes: ChildNode[] | undefined, scope: LegacyTemplateScope) => string,
  options: RenderOptions = {},
  datasets?: LegacyDatasetValues,
) {
  const attribs = node.attribs
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
        }, datasets)
      }
      return buffer
    }
  }

  const effectiveAttribs = options.overrideAttribs ?? attribs
  const normalizedTag = normalizeTagName(node.name)
  if (normalizedTag === '#fragment') {
    return renderChildren(node.children, scope)
  }

  const dataset = datasets ? new Map<string, unknown>() : undefined
  const attrs = buildAttributeString(effectiveAttribs, scope, dataset)
  const anchor = dataset?.size && datasets ? createLegacyDatasetAnchor(datasets, dataset) : ''
  const children = renderChildren(node.children, scope)

  if (SELF_CLOSING_TAGS.has(normalizedTag) && !children) {
    return `${anchor}<${normalizedTag}${attrs} />`
  }

  return `${anchor}<${normalizedTag}${attrs}>${children}</${normalizedTag}>`
}

function renderTextNode(node: DataNode, scope: LegacyTemplateScope) {
  const value = node.data
  if (!value.trim()) {
    return ''
  }
  return interpolateText(value, scope, true)
}

function renderTree(
  input: ChildNode[] | ChildNode | undefined,
  scope: LegacyTemplateScope,
  datasets?: LegacyDatasetValues,
): string {
  if (!input) {
    return ''
  }

  if (Array.isArray(input)) {
    let buffer = ''
    for (let index = 0; index < input.length; index++) {
      const node = input[index]
      if (isConditionalElement(node)) {
        const { rendered, endIndex } = renderConditionalSequence(input, index, scope, (nodes, childScope) => renderTree(nodes, childScope, datasets), datasets)
        buffer += rendered
        index = endIndex
        continue
      }
      buffer += renderTree(node, scope, datasets)
    }
    return buffer
  }

  const node = input
  if (node.type === 'text') {
    return renderTextNode(node as DataNode, scope)
  }
  if (node.type === 'tag' || node.type === 'script' || node.type === 'style') {
    return renderElement(node as Element, scope, (nodes, childScope) => renderTree(nodes, childScope, datasets), {}, datasets)
  }
  if ('children' in node && node.children?.length) {
    return renderTree(node.children, scope, datasets)
  }
  return ''
}

export function renderTemplate(nodes: ChildNode[], scope?: LegacyTemplateScope) {
  const renderScope = createScope(scope)
  return renderTree(nodes, renderScope)
}

export function createTemplate(source: string): LegacyTemplateRenderer {
  const nodes = getOrParseTemplate(source)
  return (scope?: LegacyTemplateScope, context?: object) => {
    const datasets: LegacyDatasetValues | undefined = context ? [] : undefined
    const result = renderTree(nodes, createScope(scope), datasets)
    if (context && datasets) {
      recordLegacyDatasetRender(context, datasets)
    }
    return result
  }
}

export type { LegacyTemplateRenderer, LegacyTemplateScope } from './types'
