import type { ScriptBoundaryCandidates } from '../../types'
import type { PathRecord, PathSession } from './model'
import { parseContext } from '../../documentContext'
import { opening, renderItems } from './render'

interface ProjectedSource {
  source: string
  offset: number
}

/** 只有自定义边界判定需要全文投影；普通属性修改和默认解析不支付该成本。 */
export function projectSource(session: PathSession, record: PathRecord, operation: 'before' | 'after' | 'prepend' | 'append' | 'replace' | 'current', snippet: string): ProjectedSource {
  const ranges = new Map([[record, { start: 0, end: 0 }]])
  const current = renderItems(session.roots.items, ranges)
  const range = ranges.get(record)!
  const head = record.base.kind === 'element' ? opening(record, record.base) : ''
  let start = range.start
  let end = start
  if (operation === 'after') {
    start = end = range.end
  }
  else if (operation === 'prepend') {
    start = end = range.start + head.length
  }
  else if (operation === 'append') {
    start = end = range.start + head.length + renderItems(record.children.items).length
  }
  else if (operation === 'replace' || operation === 'current') {
    end = range.end
  }
  if (operation === 'current') {
    return { source: current, offset: start }
  }
  if ((operation === 'prepend' || operation === 'append') && record.base.kind === 'element' && record.base.selfClosing && !record.children.items.length) {
    const expanded = `${head.slice(0, -2)}>`
    return { source: `${current.slice(0, range.start)}${expanded}${snippet}</${record.name}>${current.slice(range.end)}`, offset: range.start + expanded.length }
  }
  return { source: current.slice(0, start) + snippet + current.slice(end), offset: start }
}

function shiftCandidates(candidates: ScriptBoundaryCandidates, offset: number): ScriptBoundaryCandidates {
  const shift = <T extends { start: number, end: number }>(range: T): T => ({ ...range, start: range.start + offset, end: range.end + offset })
  return {
    closingTag: candidates.closingTag && shift(candidates.closingTag),
    trailingComment: candidates.trailingComment === undefined ? undefined : candidates.trailingComment + offset,
    commentClosings: candidates.commentClosings?.map(shift),
  }
}

/** 片段内部坐标保持局部，用户 resolver 始终接收完整投影源码和完整坐标。 */
export function parseFragment(session: PathSession, source: string, projected?: ProjectedSource) {
  const resolver = session.context.resolveScriptBoundary
  if (!resolver || !projected) {
    return parseContext(source, session.context)
  }
  return parseContext(source, {
    ...session.context,
    resolveScriptBoundary: (_source, start, name, candidates) => {
      const wasActive = session.active
      session.active = false
      try {
        const resolved = resolver(projected.source, projected.offset + start, name, shiftCandidates(candidates, projected.offset))
        return resolved && { start: resolved.start - projected.offset, end: resolved.end - projected.offset }
      }
      finally {
        session.active = wasActive
      }
    },
  })
}
