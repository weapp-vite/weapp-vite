import type { Document, Node, SourceRange } from '../types'
import type { SnippetRange } from './output'
import type { EditSession } from './state'
import { parse } from '../parser'
import { renderEdits } from './output'
import { assertValid } from './state'

/** 局部校验复用完整文档已选定的脚本边界，不向用户 resolver 传入片段上下文。 */
function validateSnippets(document: Document, snippets: readonly SnippetRange[]) {
  const boundaries = new Map<number, { name: string, closing: SourceRange }>()
  for (let index = 0; index < document.tokens.length; index++) {
    const token = document.tokens[index]!
    if (token.kind !== 'tag' || token.closing || token.matching === undefined
      || document.tokens[index + 1]?.kind !== 'script') {
      continue
    }
    const closing = document.tokens[token.matching]!
    boundaries.set(token.end, { name: token.name.toLowerCase(), closing })
  }
  for (const snippet of snippets) {
    const local = parse(snippet.source, {
      ...document.options,
      resolveScriptBoundary(_source, start, name) {
        const boundary = boundaries.get(snippet.start + start)
        if (!boundary || boundary.name !== name.toLowerCase()
          || boundary.closing.start < snippet.start || boundary.closing.end > snippet.end) {
          return undefined
        }
        return { start: boundary.closing.start - snippet.start, end: boundary.closing.end - snippet.start }
      },
    })
    assertValid(local)
  }
}

/** 先解析最终源码，再独立验证仍存活的结构片段；被祖先覆盖的片段不会进入校验集合。 */
export function parseCompleteEdits(session: EditSession, ranges?: Map<Node, SourceRange>): Document {
  const snippets: SnippetRange[] | undefined = session.document.options.resolveScriptBoundary ? [] : undefined
  const document = parse(renderEdits(session, ranges, snippets), session.document.options)
  assertValid(document)
  if (snippets?.length) {
    validateSnippets(document, snippets)
  }
  return document
}
