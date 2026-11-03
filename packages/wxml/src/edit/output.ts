import type { ElementNode, Node, SourceRange } from '../types'
import type { DeferredSnippet, EditSession, EditSource, NodeEdits } from './state'
import { assertExpressionBoundary } from '../encoding'

interface SourceEdit extends SourceRange {
  text: string
}

export function openingTag(session: EditSession, node: ElementNode, state: NodeEdits | undefined, expanded: boolean) {
  const { source } = session.document
  for (const name of state?.unvalidatedAttributes ?? []) {
    const value = state?.attributes?.get(name)
    if (typeof value === 'string') {
      assertExpressionBoundary(value, session.document.syntax, '"')
    }
  }
  const edits: SourceEdit[] = []
  if (state?.name && state.name !== node.name) {
    edits.push({ start: node.opening.nameStart, end: node.opening.nameEnd, text: state.name })
  }
  const handled = new Set<string>()
  const attributes = state?.attributes
  for (const attribute of node.attributes) {
    if (!attributes?.has(attribute.name)) {
      continue
    }
    const value = attributes.get(attribute.name)
    const text = handled.has(attribute.name) || value === undefined
      ? ''
      : value === null ? attribute.name : `${attribute.name}="${value}"`
    edits.push({ start: attribute.start, end: attribute.end, text })
    handled.add(attribute.name)
  }
  let additions = ''
  for (const [name, value] of attributes ?? []) {
    if (!handled.has(name) && value !== undefined) {
      additions += ` ${value === null ? name : `${name}="${value}"`}`
    }
  }
  const endStart = node.opening.end - (node.selfClosing ? 2 : 1)
  if (additions || expanded) {
    edits.push({ start: endStart, end: node.opening.end, text: `${additions}${node.selfClosing && !expanded ? '/>' : '>'}` })
  }
  let cursor = node.opening.start
  let output = ''
  for (const edit of edits.sort((a, b) => a.start - b.start)) {
    output += source.slice(cursor, edit.start) + edit.text
    cursor = edit.end
  }
  return output + source.slice(cursor, node.opening.end)
}

interface RangeEnd {
  kind: 'range-end'
  node: Node
  start: number
}

type OutputPart = string | Node | RangeEnd | DeferredSnippet

export interface SnippetRange extends SourceRange {
  readonly source: string
}

function childrenParts(source: string, children: readonly Node[], start: number, end: number) {
  const parts: OutputPart[] = []
  let cursor = start
  for (const child of children) {
    if (child.start > cursor) {
      parts.push(source.slice(cursor, child.start))
    }
    parts.push(child)
    cursor = child.end
  }
  if (cursor < end) {
    parts.push(source.slice(cursor, end))
  }
  return parts
}

function containsEdit(starts: readonly number[], node: Node) {
  let low = 0
  let high = starts.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (starts[middle]! < node.start) {
      low = middle + 1
    }
    else {
      high = middle
    }
  }
  return low < starts.length && starts[low]! < node.end
}

/** 源码片段按树归属组合，父级替换自然覆盖已登记的后代编辑。 */
export function renderEdits(session: EditSession, ranges?: Map<Node, SourceRange>, snippets?: SnippetRange[]) {
  const { source, children } = session.document
  // 仅源码输出需要定位受影响子树，canonical 直接消费修改覆盖层，不登记或复制祖先集合。
  const starts = Array.from(session.edits.keys(), node => node.start).sort((left, right) => left - right)
  const stack = childrenParts(source, children, 0, source.length).reverse()
  const output: string[] = []
  let length = 0
  const emit = (...parts: EditSource[]) => {
    for (const part of parts) {
      const value = typeof part === 'string' ? part : part.source
      if (typeof part !== 'string') {
        snippets?.push({ source: value, start: length, end: length + value.length })
      }
      output.push(value)
      if (ranges || snippets) {
        length += value.length
      }
    }
  }
  while (stack.length) {
    const part = stack.pop()!
    if (typeof part === 'string') {
      emit(part)
      continue
    }
    if (part.kind === 'range-end') {
      ranges!.set(part.node, { start: part.start, end: length })
      continue
    }
    if (part.kind === 'snippet') {
      emit(part)
      continue
    }
    const state = session.edits.get(part)
    // 自身修改单独命中，保留空脚本等零长节点的编辑。
    if (!state && !containsEdit(starts, part)) {
      const value = source.slice(part.start, part.end)
      if (ranges?.has(part)) {
        ranges.set(part, { start: length, end: length + value.length })
      }
      emit(value)
      continue
    }
    emit(...state?.before ?? [])
    const rangeStart = length
    if (state?.removed || state?.replacement !== undefined) {
      if (!state.removed) {
        if (state.literalText === false && typeof state.replacement === 'string') {
          assertExpressionBoundary(state.replacement, session.document.syntax)
        }
        emit(state.replacement!)
      }
      emit(...state.after ?? [])
      continue
    }
    if (part.kind !== 'element') {
      emit(source.slice(part.start, part.end), ...state?.after ?? [])
      continue
    }
    const expanded = Boolean(part.selfClosing && (state?.prepend?.length || state?.append?.length))
    emit(openingTag(session, part, state, expanded), ...state?.prepend ?? [])
    const inner = part.selfClosing
      ? []
      : childrenParts(source, part.children, part.opening.end, part.closing!.start)
    inner.push(...state?.append ?? [])
    if (expanded) {
      inner.push(`</${state?.name ?? part.name}>`)
    }
    else if (part.closing) {
      inner.push(state?.name && state.name !== part.name
        ? source.slice(part.closing.start, part.closing.nameStart) + state.name + source.slice(part.closing.nameEnd, part.closing.end)
        : source.slice(part.closing.start, part.closing.end))
    }
    if (ranges?.has(part)) {
      inner.push({ kind: 'range-end', node: part, start: rangeStart })
    }
    inner.push(...state?.after ?? [])
    for (let index = inner.length - 1; index >= 0; index--) {
      stack.push(inner[index]!)
    }
  }
  return output.join('')
}
