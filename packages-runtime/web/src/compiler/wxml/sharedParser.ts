import type { Node } from '@weapp-vite/wxml'
import type { SharedTemplateParseOptions } from '../../shared/templateParser'
import type { RenderNode } from './types'
import { parseSharedTemplateDocument, readSharedTemplateAttributes, readSharedTemplateText } from '../../shared/templateParser'

/** Web 编译消费模板结构，空白策略和实体解码仍由 Web 层决定。 */
export function parseSharedWxml(source: string, options: SharedTemplateParseOptions = {}): RenderNode[] {
  const parsed = parseSharedTemplateDocument(source, options)
  const result: RenderNode[] = []
  const stack: { nodes: readonly Node[], target: RenderNode[], index: number }[] = [{ nodes: parsed.document.children, target: result, index: 0 }]
  while (stack.length) {
    const frame = stack[stack.length - 1]!
    const node = frame.nodes[frame.index++]
    if (!node) {
      stack.pop()
      continue
    }
    if (node.kind === 'text' || node.kind === 'script') {
      const data = readSharedTemplateText(parsed, node)
      if (data.trim()) {
        frame.target.push({ type: 'text', data })
      }
      continue
    }
    if (node.kind !== 'element') {
      continue
    }
    const children: RenderNode[] | undefined = node.children.length ? [] : undefined
    frame.target.push({ type: 'element', name: node.name, attribs: readSharedTemplateAttributes(parsed, node), children, startIndex: node.start })
    if (children) {
      stack.push({ nodes: node.children, target: children, index: 0 })
    }
  }
  return result
}
