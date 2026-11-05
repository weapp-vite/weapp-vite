import type { DocumentContext } from '../documentContext'
import type { Node, SourceRange, TemplateDocument } from '../types'
import type { SnippetRange } from './output'
import type { EditSession } from './state'
import { contextFor, parseContext } from '../documentContext'
import { scanCompiledDocument } from '../scannerCore'
import { renderEdits } from './output'
import { assertValid } from './state'

/** 已绑定会话复用完整文档已选定的脚本边界，不向用户 resolver 传入片段上下文。 */
function validateSnippetsInContext(document: TemplateDocument, snippets: readonly SnippetRange[], context: DocumentContext) {
  const boundaries = new Map<number, { name: string, closing: SourceRange }>()
  for (let index = 0; index < document.tokens.length; index++) {
    const token = document.tokens[index]!
    if (token.kind !== 'tag' || token.closing || token.matching === undefined || document.tokens[index + 1]?.kind !== 'script') {
      continue
    }
    const closing = document.tokens[token.matching]!
    boundaries.set(token.end, { name: token.name.toLowerCase(), closing })
  }
  for (const snippet of snippets) {
    const result = scanCompiledDocument(snippet.source, context.state, (_source, start, name) => {
      const boundary = boundaries.get(snippet.start + start)
      if (!boundary || boundary.name !== name.toLowerCase() || boundary.closing.start < snippet.start || boundary.closing.end > snippet.end) {
        return undefined
      }
      return { start: boundary.closing.start - snippet.start, end: boundary.closing.end - snippet.start }
    }, true)
    const local: TemplateDocument = { source: snippet.source, syntax: result.syntax, tokens: result.tokens, diagnostics: result.diagnostics, children: result.children }
    assertValid(local)
  }
}

/** 独立调用仍要求文档保有原解析器上下文，拒绝结构化复制后猜测恢复。 */
export function validateSnippets(document: TemplateDocument, snippets: readonly SnippetRange[]) {
  const context = contextFor(document)
  if (!context) {
    throw new TypeError('This template document has no parser context; parse its source before editing.')
  }
  validateSnippetsInContext(document, snippets, context)
}

/** 先解析最终源码，再独立验证仍存活的结构片段；被祖先覆盖的片段不会进入校验集合。 */
export function parseCompleteEdits(session: EditSession, ranges?: Map<Node, SourceRange>): TemplateDocument {
  const snippets: SnippetRange[] | undefined = session.context.resolveScriptBoundary ? [] : undefined
  const document = parseContext(renderEdits(session, ranges, snippets), session.context)
  assertValid(document)
  if (snippets?.length) {
    validateSnippetsInContext(document, snippets, session.context)
  }
  return document
}
