import type { ChildNode, DataNode, Element, Node } from 'domhandler'

import type { RenderNode } from './types'

import { parseDocument } from 'htmlparser2'

function isRenderableNode(node: Node) {
  if (node.type === 'directive' || node.type === 'comment') {
    return false
  }
  if (node.type === 'text') {
    const data = (node as DataNode).data ?? ''
    return data.trim().length > 0
  }
  return true
}

type NodeWithChildren = Node & { children: ChildNode[] }

function hasChildren(node: Node): node is NodeWithChildren {
  return Array.isArray((node as NodeWithChildren).children)
}

function toRenderNode(node: Node, children?: RenderNode[]): RenderNode | undefined {
  if (node.type === 'text') {
    const data = (node as DataNode).data ?? ''
    return { type: 'text', data }
  }
  if (node.type === 'tag' || node.type === 'script' || node.type === 'style') {
    const element = node as Element
    return {
      type: 'element',
      name: element.name,
      attribs: element.attribs ?? {},
      children,
    }
  }
  return undefined
}

function convertNode(node: Node): RenderNode | undefined {
  if (!isRenderableNode(node)) {
    return undefined
  }
  const children = (hasChildren(node) && node.children.length > 0)
    ? node.children.map(child => convertNode(child)).filter((child): child is RenderNode => Boolean(child))
    : undefined
  return toRenderNode(node, children)
}

export function parseWxml(source: string): RenderNode[] {
  const document = parseDocument(source, {
    xmlMode: true,
    decodeEntities: true,
    recognizeSelfClosing: true,
  })
  const nodes = (document.children ?? []).filter(isRenderableNode)
  return nodes
    .map(node => convertNode(node))
    .filter((node): node is RenderNode => Boolean(node))
}
