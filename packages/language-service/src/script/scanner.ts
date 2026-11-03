import type { ScriptBoundaryCandidates } from '@weapp-vite/wxml'
import type { SourceRange } from '../types'
import { parse } from '@weapp-vite/ast'
import { scanScriptBoundaryCandidates } from '@weapp-vite/wxml'

export { findTrailingScriptComment } from '@weapp-vite/wxml'

function validPrefix(source: string, start: number, closing: SourceRange, block = false) {
  try {
    parse(source.slice(start, closing.start) + (block ? '*/' : ''), { sourceType: 'unambiguous', plugins: ['typescript'] })
    return true
  }
  catch {
    return false
  }
}

/** 在脚本词法状态中查找真正的结束标签，跳过字符串、模板、正则和完整注释。 */
export function findScriptClosingTag(source: string, start: number, tagName: string, candidates?: ScriptBoundaryCandidates): SourceRange | undefined {
  const scanned = candidates ?? scanScriptBoundaryCandidates(source, start, tagName)
  if (!scanned.commentClosings?.length || (scanned.closingTag && validPrefix(source, start, scanned.closingTag))) {
    return scanned.closingTag
  }
  for (let index = scanned.commentClosings.length - 1; index >= 0; index--) {
    const closing = scanned.commentClosings[index]!
    if (validPrefix(source, start, closing, closing.block)) {
      return { start: closing.start, end: closing.end }
    }
  }
  return scanned.closingTag
}
