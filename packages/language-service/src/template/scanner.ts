import type { Diagnostic } from '../types'
import type { TemplateTag, TemplateToken } from './types'
import { findScriptClosingTag } from '../script/scanner'
import { expressionEnd, TemplateLexicalError } from './expression'
import { readTag } from './tag'

const rawTags = new Set(['wxs', 'sjs', 'ks', 'filter', 'script', 'import-sjs'])

function opaqueEnd(source: string, start: number) {
  const delimiter = source.startsWith('<!--', start)
    ? '-->'
    : source.startsWith('<![CDATA[', start)
      ? ']]>'
      : source.startsWith('<?', start) ? '?>' : undefined
  if (delimiter) {
    const end = source.indexOf(delimiter, start + 2)
    if (end < 0) {
      throw new TemplateLexicalError(start, '未闭合的注释、CDATA 或处理指令')
    }
    return end + delimiter.length
  }
  let quote = ''
  let depth = 0
  for (let index = start + 2; index < source.length; index++) {
    const char = source[index]
    if (quote) {
      if (char === quote) {
        quote = ''
      }
      continue
    }
    if (char === '\'' || char === '"') {
      quote = char
    }
    else if (char === '[') {
      depth++
    }
    else if (char === ']') {
      depth--
    }
    else if (char === '>' && depth === 0) {
      return index + 1
    }
  }
  throw new TemplateLexicalError(start, '未闭合的模板声明')
}

function pairTags(tokens: TemplateToken[], diagnostics: Diagnostic[]) {
  const stack: number[] = []
  for (const [index, token] of tokens.entries()) {
    if (token.kind !== 'tag') {
      continue
    }
    if (!token.closing) {
      token.parent = stack.at(-1)
      if (!token.selfClosing) {
        stack.push(index)
      }
      continue
    }
    const openIndex = stack.pop()
    const open = openIndex === undefined ? undefined : tokens[openIndex]
    if (open?.kind !== 'tag' || open.name !== token.name) {
      diagnostics.push({ code: 'template/mismatched-tag', message: `结束标签 </${token.name}> 与开始标签不匹配`, severity: 'error', start: token.start, end: token.end })
      if (openIndex !== undefined) {
        stack.push(openIndex)
      }
      continue
    }
    open.matching = index
    token.matching = openIndex
    token.parent = open.parent
  }
  for (const index of stack) {
    const token = tokens[index] as TemplateTag
    diagnostics.push({ code: 'template/unclosed-tag', message: `标签 <${token.name}> 缺少结束标签`, severity: 'error', start: token.start, end: token.end })
  }
}

/** 生成保留全部源码范围的模板词法结果；错误不自动恢复为可写结果。 */
export function scanTemplate(source: string): { tokens: TemplateToken[], diagnostics: Diagnostic[] } {
  const tokens: TemplateToken[] = []
  const diagnostics: Diagnostic[] = []
  let cursor = 0
  let textStart = 0
  try {
    while (cursor < source.length) {
      if (source.startsWith('{{', cursor)) {
        cursor = expressionEnd(source, cursor)
        continue
      }
      if (source[cursor] !== '<' || !/[A-Z_!/?]/i.test(source[cursor + 1] ?? '')) {
        cursor++
        continue
      }
      if (cursor > textStart) {
        tokens.push({ kind: 'text', start: textStart, end: cursor })
      }
      if (source.startsWith('<!', cursor) || source.startsWith('<?', cursor)) {
        const end = opaqueEnd(source, cursor)
        const kind = source.startsWith('<!--', cursor) ? 'comment' : source.startsWith('<![CDATA[', cursor) ? 'cdata' : 'declaration'
        tokens.push({ kind, start: cursor, end })
        cursor = end
      }
      else {
        const tag = readTag(source, cursor)
        tokens.push(tag)
        cursor = tag.end
        if (!tag.closing && !tag.selfClosing && rawTags.has(tag.name.toLowerCase())) {
          const close = findScriptClosingTag(source, cursor, tag.name)
          if (!close) {
            throw new TemplateLexicalError(tag.start, `未闭合的脚本标签 <${tag.name}>`)
          }
          tokens.push({ kind: 'script', tagName: tag.name, start: cursor, end: close.start })
          tokens.push(readTag(source, close.start))
          cursor = close.end
        }
      }
      textStart = cursor
    }
    if (textStart < source.length) {
      tokens.push({ kind: 'text', start: textStart, end: source.length })
    }
    pairTags(tokens, diagnostics)
  }
  catch (error) {
    if (!(error instanceof TemplateLexicalError)) {
      throw error
    }
    diagnostics.push({ code: 'template/invalid-syntax', message: error.message, severity: 'error', start: error.offset, end: Math.min(error.offset + 1, source.length) })
  }
  return { tokens, diagnostics }
}
