import type { ChildNode, DataNode, Element, Node } from 'domhandler'
import type {
  LegacyTemplateRenderer,
  LegacyTemplateScope,
  RenderOptions,
} from './types'
import { parseDocument } from 'htmlparser2'
import {
  buildAttributeString,
  extractFor,
  isConditionalElement,
  normalizeTagName,
  SELF_CLOSING_TAGS,
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

function renderConditionalSequence(
  nodes: ChildNode[],
  startIndex: number,
  scope: LegacyTemplateScope,
  renderChildren: (input: ChildNode[] | ChildNode | undefined, scope: LegacyTemplateScope) => string,
) {
  const branches: Array<{ node: Element, attribs: Record<string, string> }> = []
  let cursor = startIndex

  while (cursor < nodes.length) {
    const candidate = nodes[cursor]
    if (!isConditionalElement(candidate)) {
      break
    }
    const element = candidate as Element
    const attribs = element.attribs ?? {}
    if (branches.length === 0 && !('wx:if' in attribs)) {
      break
    }
    if (branches.length > 0 && !('wx:elif' in attribs) && !('wx:else' in attribs)) {
      break
    }
    branches.push({ node: element, attribs })
    cursor += 1
    if ('wx:else' in attribs) {
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
    if ('wx:else' in attribs) {
      return {
        rendered: renderElement(
          node,
          scope,
          renderChildren,
          { overrideAttribs: stripControlAttributes(attribs) },
        ),
        endIndex: startIndex + branches.length - 1,
      }
    }
    const conditionExpr = attribs['wx:if'] ?? attribs['wx:elif']
    if (!conditionExpr) {
      continue
    }
    const condition = evaluateExpression(conditionExpr, scope)
    if (condition) {
      return {
        rendered: renderElement(
          node,
          scope,
          renderChildren,
          { overrideAttribs: stripControlAttributes(attribs) },
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

function renderTextNode(node: DataNode, scope: LegacyTemplateScope) {
  const value = node.data ?? ''
  if (!value.trim()) {
    return ''
  }
  return interpolateText(value, scope, true)
}

function renderTree(
  input: ChildNode[] | ChildNode | undefined,
  scope: LegacyTemplateScope,
): string {
  if (!input) {
    return ''
  }

  if (Array.isArray(input)) {
    let buffer = ''
    for (let index = 0; index < input.length; index++) {
      const node = input[index]
      if (isConditionalElement(node)) {
        const { rendered, endIndex } = renderConditionalSequence(input, index, scope, renderTree)
        buffer += rendered
        index = endIndex
        continue
      }
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

export function renderTemplate(nodes: ChildNode[], scope?: LegacyTemplateScope) {
  const renderScope = createScope(scope)
  return renderTree(nodes, renderScope)
}

export function createTemplate(source: string): LegacyTemplateRenderer {
  const nodes = getOrParseTemplate(source)
  return (scope?: LegacyTemplateScope) => renderTemplate(nodes, scope)
}

export type { LegacyTemplateRenderer, LegacyTemplateScope } from './types'
