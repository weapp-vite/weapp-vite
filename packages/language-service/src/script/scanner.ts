import type { SourceRange } from '../types'
import { parse } from '@weapp-vite/ast'

interface ScanResult {
  closingTag?: SourceRange
  trailingComment?: number
  commentClosings?: Array<SourceRange & { block: boolean }>
}

const EXPRESSION_KEYWORDS = new Set(['return', 'throw', 'case', 'delete', 'void', 'typeof', 'new', 'in', 'instanceof', 'yield', 'await', 'else', 'do'])
const CONTROL_KEYWORDS = new Set(['if', 'while', 'for', 'with', 'switch', 'catch'])

function quotedEnd(source: string, start: number, quote: string) {
  for (let index = start + 1; index < source.length; index++) {
    if (source[index] === '\\') {
      index++
    }
    else if (source[index] === quote) {
      return index + 1
    }
  }
  return source.length
}

function regexpEnd(source: string, start: number) {
  let characterClass = false
  for (let index = start + 1; index < source.length; index++) {
    const character = source[index]
    if (character === '\\') {
      index++
    }
    else if (character === '[') {
      characterClass = true
    }
    else if (character === ']') {
      characterClass = false
    }
    else if (character === '/' && !characterClass) {
      while (/[a-z]/i.test(source[index + 1] ?? '')) {
        index++
      }
      return index + 1
    }
    else if (character === '\n' || character === '\r') {
      return index
    }
  }
  return source.length
}

function closingTagAt(source: string, start: number, tagName?: string): SourceRange | undefined {
  if (!tagName || !source.startsWith('</', start)) {
    return undefined
  }
  const match = /^<\/([\w:.-]+)\s*>/.exec(source.slice(start))
  if (match?.[1]?.toLowerCase() === tagName.toLowerCase()) {
    return { start, end: start + match[0].length }
  }
  return undefined
}

function templateEnd(source: string, start: number): number {
  let index = start + 1
  while (index < source.length) {
    if (source[index] === '\\') {
      index += 2
    }
    else if (source[index] === '`') {
      return index + 1
    }
    else if (source.startsWith('${', index)) {
      // eslint-disable-next-line ts/no-use-before-define -- 模板插值与脚本词法状态需要相互递归。
      index = scanCode(source, index + 2, undefined, true).end
    }
    else {
      index++
    }
  }
  return index
}

function scanCode(source: string, start: number, tagName?: string, interpolation = false): ScanResult & { end: number } {
  const brackets: Array<{ character: string, expressionAfter: boolean }> = []
  const commentClosings: NonNullable<ScanResult['commentClosings']> = []
  let expression = true
  let previousWord = ''
  let previousCharacter = ''
  let index = start
  while (index < source.length) {
    const character = source[index]!
    const closingTag = closingTagAt(source, index, tagName)
    if (closingTag) {
      return { closingTag, commentClosings, end: closingTag.end }
    }
    if (/\s/.test(character)) {
      index++
      continue
    }
    if (character === '"' || character === '\'') {
      index = quotedEnd(source, index, character)
      expression = false
    }
    else if (character === '`') {
      index = templateEnd(source, index)
      expression = false
    }
    else if (source.startsWith('//', index)) {
      const end = source.indexOf('\n', index + 2)
      const limit = end < 0 ? source.length : end
      for (let candidate = index + 2; candidate < limit; candidate++) {
        const closing = closingTagAt(source, candidate, tagName)
        if (closing) {
          commentClosings.push({ ...closing, block: false })
        }
      }
      index = limit + (end < 0 ? 0 : 1)
      continue
    }
    else if (source.startsWith('/*', index)) {
      const end = source.indexOf('*/', index + 2)
      const limit = end < 0 ? source.length : end
      for (let candidate = index + 2; candidate < limit; candidate++) {
        const closing = closingTagAt(source, candidate, tagName)
        if (closing) {
          commentClosings.push({ ...closing, block: true })
        }
      }
      if (end < 0) {
        return { trailingComment: index, commentClosings, end: source.length }
      }
      index = end + 2
      continue
    }
    else if (character === '/' && expression) {
      index = regexpEnd(source, index)
      expression = false
    }
    else if (/[\w$\u0080-\uFFFF]/.test(character)) {
      const begin = index++
      while (/[\w$\u0080-\uFFFF]/.test(source[index] ?? '')) {
        index++
      }
      previousWord = source.slice(begin, index)
      expression = EXPRESSION_KEYWORDS.has(previousWord)
      previousCharacter = 'word'
      continue
    }
    else {
      if (character === '(') {
        brackets.push({ character, expressionAfter: CONTROL_KEYWORDS.has(previousWord) })
        expression = true
      }
      else if (character === '[') {
        brackets.push({ character, expressionAfter: false })
        expression = true
      }
      else if (character === '{') {
        const object = expression && !['', ';', ')', '=>'].includes(previousCharacter) && !['else', 'do', 'try', 'finally'].includes(previousWord)
        brackets.push({ character, expressionAfter: !object })
        expression = true
      }
      else if (character === ')' || character === ']' || character === '}') {
        if (interpolation && character === '}' && brackets.length === 0) {
          return { end: index + 1 }
        }
        expression = brackets.pop()?.expressionAfter ?? character === '}'
      }
      else if ((character === '+' || character === '-') && source[index + 1] === character) {
        index++
      }
      else if (character === '.') {
        expression = false
      }
      else {
        expression = true
      }
      index++
    }
    previousCharacter = character
    previousWord = ''
  }
  return { end: index, commentClosings }
}

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
export function findScriptClosingTag(source: string, start: number, tagName: string): SourceRange | undefined {
  const scanned = scanCode(source, start, tagName)
  if (!scanned.commentClosings?.length || (scanned.closingTag && validPrefix(source, start, scanned.closingTag))) {
    return scanned.closingTag
  }
  for (const closing of [...scanned.commentClosings].reverse()) {
    if (validPrefix(source, start, closing, closing.block)) {
      return { start: closing.start, end: closing.end }
    }
  }
  return scanned.closingTag
}

/** WXS 允许未带结束符的结尾块注释；仅在词法分析确认后交给解析兼容层。 */
export function findTrailingScriptComment(source: string): number | undefined {
  return scanCode(source, 0).trailingComment
}
