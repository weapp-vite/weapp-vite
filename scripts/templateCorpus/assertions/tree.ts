import type { Document, ElementNode, Node } from '../../../packages/wxml/src/types'
import type { AssertionMetrics, TemplateApi } from './types'
import { attributeShape } from './ranges'
import { equal, invariant } from './types'

export interface TreeEntry { node: Node, parent?: ElementNode, leave: boolean }

/** 独立迭代顺序同时充当 walk 和 canonical 语义的预言。 */
export function treeEntries(document: Document): TreeEntry[] {
  const entries: TreeEntry[] = []
  const stack: TreeEntry[] = document.children.map(node => ({ node, leave: false })).reverse()
  while (stack.length) {
    const entry = stack.pop()!
    entries.push(entry)
    if (!entry.leave) {
      stack.push({ ...entry, leave: true })
      if (entry.node.kind === 'element') {
        for (let index = entry.node.children.length - 1; index >= 0; index--) {
          stack.push({ node: entry.node.children[index]!, parent: entry.node, leave: false })
        }
      }
    }
  }
  return entries
}

export function semanticShape(api: TemplateApi, document: Document) {
  return treeEntries(document).map(({ node, leave }) => node.kind === 'element'
    ? [leave ? 'close' : 'open', node.name, node.selfClosing, ...(leave ? [] : [node.attributes.map(attribute => [attribute.name, attribute.value === undefined ? null : api.decodeAttribute(attribute.value, document.syntax, true, attribute.quote)])])]
    : [leave ? 'leave' : node.kind, node.data, node.tagName])
}

export function assertTree(api: TemplateApi, document: Document): Omit<AssertionMetrics, 'edits'> {
  const entries = treeEntries(document)
  const metrics = { tokens: document.tokens.length, nodes: 0, elements: 0, attributes: 0 }
  const tokenNodes = new Set<Node>()
  const rawTokens = new Set(document.tokens.filter(token => token.kind !== 'tag').map(token => `${token.kind}:${token.start}:${token.end}`))
  for (const { node, parent, leave } of entries) {
    if (leave) {
      continue
    }
    metrics.nodes++
    invariant(!tokenNodes.has(node), 'tree', 'node occurs more than once')
    tokenNodes.add(node)
    invariant(node.start >= (parent?.opening.end ?? 0) && node.end <= (parent?.closing?.start ?? document.source.length), 'tree', 'node lies outside parent content')
    if (node.kind !== 'element') {
      invariant(node.data === document.source.slice(node.start, node.end), 'tree', 'raw node disagrees with source')
      invariant(rawTokens.has(`${node.kind}:${node.start}:${node.end}`), 'tree', 'raw node has no matching token')
      continue
    }
    metrics.elements++
    metrics.attributes += node.attributes.length
    invariant(node.start === node.opening.start && node.name === node.opening.name && node.selfClosing === node.opening.selfClosing, 'tree', 'element disagrees with opening token')
    equal(node.attributes.map(attributeShape), node.opening.attributes.map(attributeShape), 'tree', 'element attributes disagree with opening token')
    invariant(node.end === (node.selfClosing ? node.opening.end : node.closing?.end), 'tree', 'element end disagrees with closing token')
    invariant(node.selfClosing ? node.children.length === 0 && node.closing === undefined : node.closing?.name === node.name, 'tree', 'element closing metadata disagrees')
    let cursor = node.opening.end
    for (const child of node.children) {
      invariant(child.start === cursor, 'tree', 'children do not partition element content')
      cursor = child.end
    }
    invariant(cursor === (node.closing?.start ?? node.opening.end), 'tree', 'children omit element content')
  }
  const observed: TreeEntry[] = []
  api.walk(document, {
    enter: (node, parent) => { observed.push({ node, parent, leave: false }) },
    leave: (node, parent) => { observed.push({ node, parent, leave: true }) },
  })
  invariant(observed.length === entries.length && entries.every((entry, index) => entry.node === observed[index]?.node && entry.parent === observed[index]?.parent && entry.leave === observed[index]?.leave), 'walk', 'visitor order or parent identity disagrees')
  return metrics
}
