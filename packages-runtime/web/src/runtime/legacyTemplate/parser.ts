import type { Node } from '@weapp-vite/wxml'
import type { ChildNode, ParentNode } from 'domhandler'
import type { SharedTemplateDocument, SharedTemplateParseOptions } from '../../shared/templateParser'
import { CDATA, Comment, Document, Element, ProcessingInstruction, Text } from 'domhandler'
import { parseSharedTemplateDocument, readSharedTemplateAttributes, readSharedTemplateText } from '../../shared/templateParser'

function append(parent: ParentNode, child: ChildNode) {
  const previous = parent.children[parent.children.length - 1] ?? null
  child.parent = parent
  child.prev = previous
  if (previous) {
    previous.next = child
  }
  parent.children.push(child)
}

function convert(parsed: SharedTemplateDocument, node: Node): ChildNode {
  if (node.kind === 'element') {
    return new Element(node.name, readSharedTemplateAttributes(parsed, node), [], 'tag' as Element['type'])
  }
  const data = readSharedTemplateText(parsed, node)
  if (node.kind === 'text' || node.kind === 'script') {
    return new Text(data)
  }
  if (node.kind === 'comment') {
    return new Comment(data.slice(4, -3))
  }
  if (node.kind === 'cdata') {
    const result = new CDATA([])
    append(result, new Text(data.slice(9, -3)))
    return result
  }
  const value = data.slice(1, data.endsWith('?>') ? -2 : -1)
  return new ProcessingInstruction(value.split(/\s/, 1)[0]!, value)
}

/** 按原生 weapp 输入适配公开 domhandler 节点，显式语法选项可覆盖默认 legacy。 */
export function parseSharedTemplateNodes(source: string, options: SharedTemplateParseOptions = {}): ChildNode[] {
  const parsed = parseSharedTemplateDocument(source, { ...options, platform: options.platform ?? 'weapp' })
  const root = new Document([])
  const stack: { nodes: readonly Node[], parent: ParentNode, index: number }[] = [{ nodes: parsed.document.children, parent: root, index: 0 }]
  while (stack.length) {
    const frame = stack[stack.length - 1]!
    const node = frame.nodes[frame.index++]
    if (!node) {
      stack.pop()
      continue
    }
    if (frame.parent === root && (node.kind === 'comment' || node.kind === 'declaration'
      || (node.kind === 'text' && !readSharedTemplateText(parsed, node).trim()))) {
      continue
    }
    const child = convert(parsed, node)
    child.startIndex = node.start
    child.endIndex = node.end - 1
    append(frame.parent, child)
    if (node.kind === 'element' && child instanceof Element) {
      stack.push({ nodes: node.children, parent: child, index: 0 })
    }
  }
  return root.children
}
