import type { TemplateAttribute, TemplateTag } from './types'
import { expressionEnd, TemplateLexicalError } from './expression'

/** 只读取标签和属性的源码范围，不对属性值做解码或重写。 */
export function readTag(source: string, start: number): TemplateTag {
  let cursor = start + 1
  const closing = source[cursor] === '/'
  if (closing) {
    cursor++
  }
  const nameStart = cursor
  while (/[\w:.-]/.test(source[cursor] ?? '')) {
    cursor++
  }
  const nameEnd = cursor
  if (cursor === nameStart) {
    throw new TemplateLexicalError(start, '标签缺少名称')
  }
  const attributes: TemplateAttribute[] = []
  while (cursor < source.length) {
    const whitespaceStart = cursor
    while (/\s/.test(source[cursor] ?? '')) {
      cursor++
    }
    const selfClosing = source.startsWith('/>', cursor)
    if (source[cursor] === '>' || selfClosing) {
      if (closing && selfClosing) {
        throw new TemplateLexicalError(cursor, '结束标签不能自闭合')
      }
      return { kind: 'tag', start, end: cursor + (selfClosing ? 2 : 1), name: source.slice(nameStart, nameEnd), nameStart, nameEnd, closing, selfClosing, attributes }
    }
    if (closing) {
      throw new TemplateLexicalError(cursor, '结束标签不能包含属性')
    }
    if (cursor === whitespaceStart) {
      throw new TemplateLexicalError(cursor, '属性前缺少空白分隔符')
    }
    const attributeNameStart = cursor
    if (source.startsWith('{{', cursor)) {
      cursor = expressionEnd(source, cursor)
    }
    else {
      while (cursor < source.length && !/[\s=/>]/.test(source[cursor])) {
        if (/[<'"]/.test(source[cursor])) {
          throw new TemplateLexicalError(cursor, '无效的属性名称')
        }
        cursor++
      }
    }
    const attributeNameEnd = cursor
    if (attributeNameEnd === attributeNameStart) {
      throw new TemplateLexicalError(cursor, '属性缺少名称')
    }
    const attribute: TemplateAttribute = { name: source.slice(attributeNameStart, attributeNameEnd), nameStart: attributeNameStart, nameEnd: attributeNameEnd, start: attributeNameStart, end: attributeNameEnd }
    while (/\s/.test(source[cursor] ?? '')) {
      cursor++
    }
    if (source[cursor] !== '=') {
      attributes.push(attribute)
      cursor = attributeNameEnd
      continue
    }
    cursor++
    while (/\s/.test(source[cursor] ?? '')) {
      cursor++
    }
    const rawStart = cursor
    const quote = source[cursor] === '"' || source[cursor] === '\'' ? source[cursor++] : undefined
    const valueStart = cursor
    let closed = !quote
    while (cursor < source.length) {
      if (source.startsWith('{{', cursor)) {
        cursor = expressionEnd(source, cursor)
      }
      else if (quote && source[cursor] === quote) {
        closed = true
        break
      }
      else if (!quote && (/[\s>]/.test(source[cursor]) || source.startsWith('/>', cursor))) {
        break
      }
      else {
        cursor++
      }
    }
    if (!closed || (!quote && cursor === valueStart)) {
      throw new TemplateLexicalError(rawStart, '未闭合或为空的属性值')
    }
    attribute.valueStart = valueStart
    attribute.valueEnd = cursor
    attribute.value = source.slice(valueStart, cursor)
    if (quote) {
      cursor++
    }
    attribute.rawValue = source.slice(rawStart, cursor)
    attribute.end = cursor
    attributes.push(attribute)
  }
  throw new TemplateLexicalError(start, '未闭合的标签')
}
