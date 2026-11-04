/* eslint-disable ts/no-use-before-define -- 模板字符串与表达式需要相互递归。 */
import type { SourceRange, Syntax } from './types'
import { attributeSourceError, attributeSourcePosition, legacyAttributeEnd, legacyAttributeSource } from './attributeLayer'
import { TokenContext } from './context'
import { findLineEnd, isSpaceCode, isWordCode, TemplateLexicalError } from './lexical'

const fastInterpolation = /\{\{[^{}[\]()"'`\x2F&]*\}\}/y

function encodedQuoteAt(source: string, start: number) {
  if (source.charCodeAt(start) !== 38) {
    return undefined
  }
  const initial = source.charCodeAt(start + 1) | 32
  if (initial !== 35 && initial !== 97 && initial !== 113) {
    return undefined
  }
  // 实体最长只接受 15 字符，不为普通逻辑运算符重复搜索整段模板后缀。
  const limit = Math.min(source.length, start + 16)
  let end = start + 1
  while (end < limit && source.charCodeAt(end) !== 59) {
    end++
  }
  if (end === limit) {
    return undefined
  }
  const name = source.slice(start + 1, end).toLowerCase()
  let code = name === 'quot' ? 34 : name === 'apos' ? 39 : 0
  if (!code && name.charCodeAt(0) === 35) {
    const hexadecimal = name.charCodeAt(1) === 120
    const begin = hexadecimal ? 2 : 1
    if (begin === name.length) {
      return undefined
    }
    for (let index = begin; index < name.length; index++) {
      const digit = name.charCodeAt(index)
      if (!((digit >= 48 && digit <= 57) || (hexadecimal && digit >= 97 && digit <= 102))) {
        return undefined
      }
    }
    code = Number.parseInt(name.slice(begin), hexadecimal ? 16 : 10)
  }
  return code === 34 || code === 39 ? { code, end: end + 1 } : undefined
}

function quotedEnd(source: string, start: number, syntax: Syntax, limit: number, entityQuotes: boolean): number {
  const opening = encodedQuoteAt(source, start)
  const quote = opening?.code ?? source.charCodeAt(start)
  const entityLayer = syntax === 'xml' || Boolean(opening)
  for (let index = opening?.end ?? start + 1; index < limit;) {
    const entity = entityLayer ? encodedQuoteAt(source, index) : undefined
    const code = entity?.code ?? source.charCodeAt(index)
    if (code === 92) {
      const slashStart = index
      while (source.charCodeAt(index) === 92) {
        index++
      }
      const delimiter = entityLayer ? encodedQuoteAt(source, index) : undefined
      const slashes = index - slashStart
      if (slashes % 2 !== 0) {
        index = delimiter?.end ?? index + 1
      }
      continue
    }
    if (quote === 96 && code === 36 && source.charCodeAt(index + 1) === 123) {
      index = scanExpression(source, index + 1, false, syntax, limit, entityQuotes)
    }
    else if (code === quote) {
      return entity?.end ?? index + 1
    }
    else {
      index = entity?.end ?? index + 1
    }
  }
  throw new TemplateLexicalError(start, '未闭合的表达式字符串')
}

function regexpEnd(source: string, start: number, limit: number) {
  let characterClass = false
  for (let index = start + 1; index < limit; index++) {
    const code = source.charCodeAt(index)
    if (code === 92) {
      index++
    }
    else if (code === 91) {
      characterClass = true
    }
    else if (code === 93) {
      characterClass = false
    }
    else if (code === 47 && !characterClass) {
      index++
      while (isWordCode(source.charCodeAt(index))) {
        index++
      }
      return index
    }
    else if (code === 10 || code === 13) {
      break
    }
  }
  throw new TemplateLexicalError(start, '未闭合的表达式正则')
}

function scanExpression(source: string, start: number, mustache: boolean, syntax: Syntax, limit = source.length, entityQuotes = true): number {
  if (mustache) {
    // 无字符串、运算符或括号的成员路径无需创建 JS 词法上下文。
    fastInterpolation.lastIndex = start
    const fast = fastInterpolation.exec(source)
    if (fast && fast.index + fast[0].length <= limit) {
      return fast.index + fast[0].length
    }
  }
  const context = new TokenContext(true)
  let mismatch: number | undefined
  for (let index = start + (mustache ? 2 : 1); index < limit;) {
    const code = source.charCodeAt(index)
    const next = source.charCodeAt(index + 1)
    if (code === 125 && (!mustache ? context.depth === 0 : next === 125 && context.bracket !== 123)) {
      const end = index + (mustache ? 2 : 1)
      if (mismatch !== undefined || context.depth > 0) {
        throw new TemplateLexicalError(mismatch ?? index, '不匹配的表达式括号', { kind: 'interpolation', start, end })
      }
      return end
    }
    if (isSpaceCode(code)) {
      if (code === 10 || code === 13 || code === 0x2028 || code === 0x2029) {
        context.lineBreak()
      }
      index++
      continue
    }
    if (entityQuotes && code === 38 && encodedQuoteAt(source, index)) {
      index = quotedEnd(source, index, syntax, limit, entityQuotes)
      context.value()
      continue
    }
    if (code === 34 || code === 39 || code === 96) {
      index = quotedEnd(source, index, syntax, limit, entityQuotes)
      context.value()
      continue
    }
    if (code === 47 && next === 42) {
      const end = source.indexOf('*/', index + 2)
      if (end < 0 || end >= limit) {
        throw new TemplateLexicalError(index, '未闭合的表达式注释')
      }
      context.lineBreak(source, index + 2, end)
      index = end + 2
      continue
    }
    if (code === 47 && next === 47) {
      const end = findLineEnd(source, index + 2)
      if (end < 0 || end >= limit) {
        throw new TemplateLexicalError(index, '未闭合的插值表达式')
      }
      context.lineBreak()
      index = end + 1
      continue
    }
    if (code === 47 && context.operand) {
      index = regexpEnd(source, index, limit)
      context.value()
      continue
    }
    if (isWordCode(code)) {
      const begin = index++
      while (isWordCode(source.charCodeAt(index))) {
        index++
      }
      context.word(source, begin, index)
      continue
    }
    if ((code === 43 || code === 45) && code === next) {
      context.increment(code)
      index += 2
      continue
    }
    if (!context.punctuation(code, next)) {
      if (!mustache) {
        throw new TemplateLexicalError(index, '不匹配的表达式括号')
      }
      mismatch ??= index
    }
    index++
  }
  if (mismatch !== undefined) {
    throw new TemplateLexicalError(mismatch, '不匹配的表达式括号')
  }
  throw new TemplateLexicalError(start, '未闭合的插值表达式')
}

/** 定位插值末尾；跳过字符串、注释、正则和嵌套括号，保留原文编码。 */
export function expressionEnd(source: string, start: number, mustache = true, syntax: Syntax = 'xml', outerQuote?: string): number {
  if (syntax === 'legacy' && outerQuote) {
    const boundary = legacyAttributeEnd(source, start, outerQuote)
    const view = legacyAttributeSource(source, start, boundary < 0 ? source.length : boundary)
    try {
      return attributeSourcePosition(view, scanExpression(view.source, view.start, mustache, syntax, view.end, false))
    }
    catch (error) {
      attributeSourceError(view, error)
    }
  }
  return scanExpression(source, start, mustache, syntax)
}

function collectInterpolations(source: string, syntax: Syntax, entityQuotes = true, begin = 0, limit = source.length): SourceRange[] {
  const result: SourceRange[] = []
  let start = source.indexOf('{{', begin)
  while (start >= 0 && start < limit) {
    const end = scanExpression(source, start, true, syntax, limit, entityQuotes)
    result.push({ start, end })
    start = source.indexOf('{{', end)
  }
  return result
}

/** 返回完整插值的半开范围，保留属性层的编码规则。 */
export function interpolations(source: string, syntax: Syntax = 'xml', outerQuote?: string): SourceRange[] {
  if (syntax === 'legacy' && outerQuote) {
    const boundary = legacyAttributeEnd(source, 0, outerQuote)
    const view = legacyAttributeSource(source, 0, boundary < 0 ? source.length : boundary)
    try {
      return collectInterpolations(view.source, syntax, false, view.start, view.end).map(range => ({
        start: attributeSourcePosition(view, range.start),
        end: attributeSourcePosition(view, range.end),
      }))
    }
    catch (error) {
      attributeSourceError(view, error)
    }
  }
  return collectInterpolations(source, syntax)
}

/** 已解开宿主层的绑定不将实体样文本解释为 JavaScript 引号。 */
export function legacyAttributeInterpolations(source: string) {
  return collectInterpolations(source, 'legacy', false)
}

/** 宿主先确定属性边界，绑定词法只读取解开一层后的逻辑字符。 */
export function validateLegacyAttribute(source: string, start: number, end: number) {
  const view = legacyAttributeSource(source, start, end)
  let begin = view.source.indexOf('{{', view.start)
  try {
    while (begin >= 0 && begin < view.end) {
      const boundary = scanExpression(view.source, begin, true, 'legacy', view.end, false)
      begin = view.source.indexOf('{{', boundary)
    }
  }
  catch (error) {
    attributeSourceError(view, error)
  }
}
