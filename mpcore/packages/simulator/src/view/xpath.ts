import type { Attr, Element, IDomFacade, Node as XPathNode } from 'fontoxpath'
import * as fontoxpath from 'fontoxpath'

// Node 加载 CommonJS 入口，浏览器构建加载 ESM 入口，两者复用同一适配器。
const xpathEngine = (Reflect.get(fontoxpath, 'default') ?? fontoxpath) as typeof fontoxpath

interface SourceNode {
  attribs?: Record<string, string>
  children?: SourceNode[]
  data?: string
  name?: string
  type?: string
}

interface QueryNode extends Element {
  attributes: QueryAttribute[]
  children: QueryNode[]
  data: string
  parent: QueryNode | null
  source?: SourceNode
}

interface QueryAttribute extends Attr {
  parent: QueryNode
}

function wrapNode(source: SourceNode, parent: QueryNode | null = null): QueryNode {
  const node: QueryNode = {
    attributes: [],
    children: [],
    data: source.data ?? '',
    localName: source.name ?? '',
    namespaceURI: null,
    nodeName: source.name ?? '',
    nodeType: source.type === 'tag' ? 1 : source.type === 'text' ? 3 : source.type === 'comment' ? 8 : 9,
    parent,
    prefix: null,
    source,
  }
  node.attributes = Object.entries(source.attribs ?? {}).map(([name, value]) => ({
    localName: name,
    name,
    namespaceURI: null,
    nodeName: name,
    nodeType: 2,
    parent: node,
    prefix: null,
    value,
  }))
  node.children = (source.children ?? []).map(child => wrapNode(child, node))
  return node
}

function sibling(node: XPathNode, offset: number) {
  const current = node as QueryNode
  if (current.nodeType === 2) {
    return null
  }
  const children = current.parent?.children ?? []
  return children[children.indexOf(current) + offset] ?? null
}

const domFacade: IDomFacade = {
  getAllAttributes: node => (node as QueryNode).attributes,
  getAttribute: (node, name) => (node as QueryNode).attributes.find(attribute => attribute.name === name)?.value ?? null,
  getChildNodes: node => (node as QueryNode).children ?? [],
  getData: node => node.nodeType === 2 ? (node as QueryAttribute).value : (node as QueryNode).data,
  getFirstChild: node => (node as QueryNode).children?.[0] ?? null,
  getLastChild: node => (node as QueryNode).children?.at(-1) ?? null,
  getNextSibling: node => sibling(node, 1),
  getParentNode: node => (node as QueryNode | QueryAttribute).parent,
  getPreviousSibling: node => sibling(node, -1),
}

export function queryXPathElements<T extends SourceNode>(root: T, expression: string): T[] {
  if (!expression.trim()) {
    throw new Error('XPath must be a non-empty expression in headless testing runtime.')
  }
  const document = wrapNode(root.type === 'root' ? root : { type: 'root', children: [root] })
  return xpathEngine.evaluateXPathToNodes<QueryNode>(expression, document, domFacade)
    .filter(node => node.nodeType === 1)
    .map(node => node.source as T)
}
