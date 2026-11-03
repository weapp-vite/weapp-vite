import type { Attribute, Syntax, TagToken } from './types'
import { legacyAttributeEnd } from './attributeLayer'
import { expressionEnd, validateLegacyAttribute } from './expression'
import { isNameCode, isSpaceCode, skipSpace, TemplateLexicalError } from './lexical'

const emptyAttributes: readonly Attribute[] = Object.freeze([])
const doubleQuotedBoundary = /"|\{\{/g
const singleQuotedBoundary = /'|\{\{/g
export interface BindingCursor { next: number }

/** 读取标签与属性范围；属性值始终保留未解码的原文。 */
export function readTag(source: string, start: number, syntax: Syntax = 'xml', collectAttributes = true): TagToken {
  // eslint-disable-next-line ts/no-use-before-define -- 公开兼容入口委托下方统一词法实现，内部扫描另传共享游标。
  return scanTag(source, start, syntax, collectAttributes)
}

/** 文档扫描共享单调的绑定候选，避免逐属性搜索相同后缀。 */
export function scanTag(source: string, start: number, syntax: Syntax, collectAttributes: boolean, bindings?: BindingCursor): TagToken {
  let cursor = start + 1
  const closing = source.charCodeAt(cursor) === 47
  if (closing) {
    cursor++
  }
  const nameStart = cursor
  while (isNameCode(source.charCodeAt(cursor))) {
    cursor++
  }
  const nameEnd = cursor
  if (nameStart === nameEnd) {
    throw new TemplateLexicalError(start, '标签缺少名称')
  }
  let attributes: Attribute[] | undefined
  while (cursor < source.length) {
    const whitespaceStart = cursor
    cursor = skipSpace(source, cursor)
    const code = source.charCodeAt(cursor)
    const selfClosing = code === 47 && source.charCodeAt(cursor + 1) === 62
    if (code === 62 || selfClosing) {
      if (closing && selfClosing) {
        throw new TemplateLexicalError(cursor, '结束标签不能自闭合')
      }
      return { kind: 'tag', start, end: cursor + (selfClosing ? 2 : 1), name: source.slice(nameStart, nameEnd), nameStart, nameEnd, closing, selfClosing, attributes: attributes ?? emptyAttributes, parent: undefined, matching: undefined }
    }
    if (closing) {
      throw new TemplateLexicalError(cursor, '结束标签不能包含属性')
    }
    if (whitespaceStart === cursor) {
      throw new TemplateLexicalError(cursor, '属性前缺少空白分隔符')
    }
    const attributeStart = cursor
    if (source.charCodeAt(cursor) === 123 && source.charCodeAt(cursor + 1) === 123) {
      cursor = expressionEnd(source, cursor, true, syntax)
    }
    else {
      while (cursor < source.length) {
        const attributeCode = source.charCodeAt(cursor)
        if (isSpaceCode(attributeCode) || attributeCode === 61 || attributeCode === 47 || attributeCode === 62) {
          break
        }
        if (attributeCode === 60 || attributeCode === 34 || attributeCode === 39) {
          throw new TemplateLexicalError(cursor, '无效的属性名称')
        }
        cursor++
      }
    }
    const attributeNameEnd = cursor
    if (cursor === attributeStart) {
      throw new TemplateLexicalError(cursor, '属性缺少名称')
    }
    const name = collectAttributes ? source.slice(attributeStart, attributeNameEnd) : ''
    cursor = skipSpace(source, cursor)
    if (source.charCodeAt(cursor) !== 61) {
      if (collectAttributes) {
        ;(attributes ??= []).push({ name, nameStart: attributeStart, nameEnd: attributeNameEnd, start: attributeStart, end: attributeNameEnd })
      }
      cursor = attributeNameEnd
      continue
    }
    cursor = skipSpace(source, cursor + 1)
    const rawStart = cursor
    const quoteCode = source.charCodeAt(cursor)
    const quote = quoteCode === 34 ? '"' : quoteCode === 39 ? '\'' : undefined
    if (quote) {
      cursor++
    }
    const valueStart = cursor
    let closed = !quote
    if (quote && syntax === 'legacy') {
      const end = legacyAttributeEnd(source, valueStart, quote)
      if (end >= 0) {
        validateLegacyAttribute(source, valueStart, end)
        cursor = end
        closed = true
      }
    }
    else if (quote && bindings) {
      let end = source.indexOf(quote, cursor)
      while (true) {
        if (bindings.next < cursor) {
          const found = source.indexOf('{{', cursor)
          bindings.next = found < 0 ? Number.POSITIVE_INFINITY : found
        }
        if (end >= 0 && end < bindings.next) {
          cursor = end
          closed = true
          break
        }
        if (bindings.next === Number.POSITIVE_INFINITY) {
          break
        }
        cursor = expressionEnd(source, bindings.next, true, syntax, quote)
        if (end >= 0 && end < cursor) {
          end = source.indexOf(quote, cursor)
        }
      }
    }
    else if (quote) {
      // 搜索在当前外层引号处停止，避免逐字符读取静态值或反复搜索远端绑定。
      const boundary = quoteCode === 34 ? doubleQuotedBoundary : singleQuotedBoundary
      boundary.lastIndex = cursor
      while (boundary.test(source)) {
        if (source.charCodeAt(boundary.lastIndex - 1) === quoteCode) {
          cursor = boundary.lastIndex - 1
          closed = true
          break
        }
        cursor = expressionEnd(source, boundary.lastIndex - 2, true, syntax, quote)
        boundary.lastIndex = cursor
      }
    }
    else {
      while (cursor < source.length) {
        const valueCode = source.charCodeAt(cursor)
        if (valueCode === 123 && source.charCodeAt(cursor + 1) === 123) {
          cursor = expressionEnd(source, cursor, true, syntax, quote)
        }
        else if (quote ? valueCode === quoteCode : isSpaceCode(valueCode) || valueCode === 62 || (valueCode === 47 && source.charCodeAt(cursor + 1) === 62)) {
          closed = true
          break
        }
        else {
          cursor++
        }
      }
    }
    if (!closed || (!quote && cursor === valueStart)) {
      throw new TemplateLexicalError(attributeStart, '未闭合或为空的属性值')
    }
    const valueEnd = cursor
    if (quote) {
      cursor++
    }
    if (collectAttributes) {
      const value = source.slice(valueStart, valueEnd)
      ;(attributes ??= []).push({ name, nameStart: attributeStart, nameEnd: attributeNameEnd, start: attributeStart, end: cursor, valueStart, valueEnd, value, rawValue: quote ? source.slice(rawStart, cursor) : value, quote })
    }
  }
  throw new TemplateLexicalError(start, '未闭合的标签')
}
