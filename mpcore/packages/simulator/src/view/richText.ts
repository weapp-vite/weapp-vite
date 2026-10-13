import type { SafeRichTextNode } from '@weapp-core/shared/rich-text'
import { normalizeRichTextNodes } from '@weapp-core/shared/rich-text'

interface RichTextRenderedNode {
  type: 'tag' | 'text'
  name?: string
  data?: string
  attribs?: Record<string, string>
  children?: RichTextRenderedNode[]
}

function materializeNode(node: SafeRichTextNode): RichTextRenderedNode {
  if (node.type === 'text') {
    return { type: 'text', data: node.text }
  }
  // 富文本的 data-* 不能伪造模拟器的事件、组件或作用域标记。
  for (const name of Object.keys(node.attrs)) {
    if (name.startsWith('data-sim-')) {
      delete node.attrs[name]
    }
  }
  return {
    type: 'tag',
    name: node.name,
    attribs: node.attrs,
    children: node.children.map(materializeNode),
  }
}

/** 富文本直接成为已渲染节点，不能再进入 WXML 表达式或组件处理流程。 */
export function renderRichTextNodes(value: unknown): RichTextRenderedNode[] {
  return normalizeRichTextNodes(value).map(materializeNode)
}
