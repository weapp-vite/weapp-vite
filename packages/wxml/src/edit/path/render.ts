import type { ElementNode, TemplateDocument } from '../../types'
import type { LogicalAttribute, PathRecord, PathSession } from './model'
import { parseContext } from '../../documentContext'
import { assertValid } from '../state'

function attributeSource(record: PathRecord, attribute: LogicalAttribute) {
  const original = attribute.original
  if (original && !attribute.changed) {
    return record.source.slice(original.start, original.nameStart) + attribute.name + record.source.slice(original.nameEnd, original.end)
  }
  return attribute.value === undefined ? attribute.name : `${attribute.name}="${attribute.value}"`
}

export function opening(record: PathRecord, base: ElementNode) {
  const edits: Array<{ start: number, end: number, text: string }> = []
  if (record.name !== base.name) {
    edits.push({ start: base.opening.nameStart, end: base.opening.nameEnd, text: record.name! })
  }
  for (const original of base.attributes) {
    const current = record.attributes.find(attribute => attribute.original === original)
    if (!current || current.name !== original.name || current.changed) {
      edits.push({ start: original.start, end: original.end, text: current ? attributeSource(record, current) : '' })
    }
  }
  const additions = record.attributes.filter(attribute => !attribute.original).map(attribute => ` ${attributeSource(record, attribute)}`).join('')
  const expanded = base.selfClosing && record.children.items.length > 0
  if (additions || expanded) {
    edits.push({ start: base.opening.end - (base.selfClosing ? 2 : 1), end: base.opening.end, text: `${additions}${base.selfClosing && !expanded ? '/>' : '>'}` })
  }
  let cursor = base.opening.start
  let result = ''
  for (const edit of edits.sort((left, right) => left.start - right.start)) {
    result += record.source.slice(cursor, edit.start) + edit.text
    cursor = edit.end
  }
  return result + record.source.slice(cursor, base.opening.end)
}

interface RangeEnd {
  record: PathRecord
  start: number
}

/** 按片段来源迭代拼接；未修改子树直接复用原字节，不依赖旧坐标表示当前树。 */
export function renderItems(items: readonly PathRecord[], ranges?: Map<PathRecord, { start: number, end: number }>) {
  const tracked = new Set<PathRecord>()
  for (const record of ranges?.keys() ?? []) {
    for (let current: PathRecord | undefined = record; current; current = current.parent) {
      tracked.add(current)
    }
  }
  const stack: Array<PathRecord | string | RangeEnd> = [...items].reverse()
  const output: string[] = []
  let size = 0
  const emit = (value: string) => {
    output.push(value)
    size += value.length
  }
  while (stack.length) {
    const part = stack.pop()!
    if (typeof part === 'string') {
      emit(part)
      continue
    }
    if ('record' in part) {
      ranges!.set(part.record, { start: part.start, end: size })
      continue
    }
    const base = part.base
    const start = size
    if (!part.dirty && !tracked.has(part)) {
      emit(part.source.slice(base.start, base.end))
      continue
    }
    if (base.kind !== 'element') {
      emit(part.data!)
      if (tracked.has(part)) {
        ranges?.set(part, { start, end: size })
      }
      continue
    }
    emit(opening(part, base))
    if (ranges && (part.rawProtected || tracked.has(part))) {
      stack.push({ record: part, start })
    }
    if (base.closing) {
      stack.push(part.source.slice(base.closing.start, base.closing.nameStart) + part.name + part.source.slice(base.closing.nameEnd, base.closing.end))
    }
    else if (part.children.items.length) {
      stack.push(`</${part.name}>`)
    }
    for (let index = part.children.items.length - 1; index >= 0; index--) {
      stack.push(part.children.items[index]!)
    }
  }
  return output.join('')
}

/** 提交后统一重建公开 AST 和坐标，同时核验脚本片段未逃出所属原文标签。 */
export function commit(session: PathSession): TemplateDocument {
  const ranges = new Map<PathRecord, { start: number, end: number }>()
  const document = parseContext(renderItems(session.roots.items, ranges), session.context)
  assertValid(document)
  if (ranges.size) {
    const expected = new Map([...ranges.values()].map(range => [range.start, range.end]))
    const stack = [...document.children]
    while (stack.length && expected.size) {
      const node = stack.pop()!
      const end = expected.get(node.start)
      if (end !== undefined) {
        if (node.kind !== 'element' || node.end !== end || node.children.length !== 1 || node.children[0]?.kind !== 'script') {
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
  }
  return document
}
