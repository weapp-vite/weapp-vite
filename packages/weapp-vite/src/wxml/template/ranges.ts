import type { SourceRange } from './lexical'

export interface SourceEdit extends SourceRange {
  text?: string
}

/** 合并被父级删除区间包含的编辑，未修改内容按原字节顺序保留。 */
export function applySourceEdits(code: string, edits: SourceEdit[], ordered = false) {
  if (!edits.length) {
    return code
  }
  if (!ordered) {
    edits.sort((a, b) => a.start - b.start || b.end - a.end)
  }
  const parts: string[] = []
  let end = 0
  for (const edit of edits) {
    if (edit.start < end) {
      continue
    }
    parts.push(code.slice(end, edit.start), edit.text ?? '')
    end = edit.end
  }
  parts.push(code.slice(end))
  return parts.join('')
}
