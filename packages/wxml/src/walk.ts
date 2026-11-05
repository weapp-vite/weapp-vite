import type { ElementNode, Node, TemplateDocument, Visitor } from './types'

/** 迭代遍历文档，enter 返回 false 时跳过子树，避免深模板递归溢出。 */
export function walk(document: TemplateDocument | readonly Node[], visitor: Visitor) {
  const roots = Array.isArray(document) ? document : (document as TemplateDocument).children
  const stack: Array<{ node: Node, parent?: ElementNode, leave?: boolean }> = []
  for (let index = roots.length - 1; index >= 0; index--) {
    stack.push({ node: roots[index]! })
  }
  while (stack.length) {
    const frame = stack.pop()!
    if (frame.leave) {
      visitor.leave?.(frame.node, frame.parent)
      continue
    }
    const descend = visitor.enter?.(frame.node, frame.parent) !== false
    if (visitor.leave) {
      stack.push({ ...frame, leave: true })
    }
    if (descend && frame.node.kind === 'element') {
      for (let index = frame.node.children.length - 1; index >= 0; index--) {
        stack.push({ node: frame.node.children[index]!, parent: frame.node })
      }
    }
  }
}
