import type { Node, SourceRange, TemplateDocument } from '../types'
import type { EditSession } from './state'
import { parseCompleteEdits } from './snippets'

/** 原始脚本片段按完整宿主上下文解析，且不能越过原有宿主边界插入结构。 */
export function parseRawEdits(session: EditSession): TemplateDocument {
  const ranges = new Map<Node, SourceRange>()
  for (const [node, owner] of session.rawOwners ?? []) {
    if (!owner.isInvalidated()) {
      ranges.set(node, { start: 0, end: 0 })
    }
  }
  const document = parseCompleteEdits(session, ranges)
  const expected = new Map([...ranges.values()].map(range => [range.start, range]))
  const stack = [...document.children]
  while (stack.length && expected.size) {
    const node = stack.pop()!
    const range = expected.get(node.start)
    if (range) {
      if (node.kind !== 'element' || node.end !== range.end || node.children.length !== 1 || node.children[0]?.kind !== 'script') {
        throw new TypeError('Raw WXML edits must stay inside their original script owner.')
      }
      expected.delete(node.start)
    }
    if (node.kind === 'element') {
      stack.push(...node.children)
    }
  }
  if (expected.size) {
    throw new TypeError('Raw WXML edits must stay inside their original script owner.')
  }
  return document
}
