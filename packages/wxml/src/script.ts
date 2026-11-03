/* eslint-disable ts/no-use-before-define -- 脚本模板字符串与代码边界互相递归。 */
import type { ScriptBoundaryCandidates, SourceRange } from './types'
import { TokenContext } from './context'
import { findLineEnd, isNameCode, isSpaceCode, isWordCode } from './lexical'

interface ScriptScan extends ScriptBoundaryCandidates {
  end: number
}

function quotedEnd(source: string, start: number, quote: number) {
  for (let index = start + 1; index < source.length; index++) {
    const code = source.charCodeAt(index)
    if (code === 92) {
      index++
    }
    else if (code === quote) {
      return index + 1
    }
  }
  return source.length
}

function regexpEnd(source: string, start: number) {
  let characterClass = false
  for (let index = start + 1; index < source.length; index++) {
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
      return index
    }
  }
  return source.length
}

function closingTagAt(source: string, start: number, tagName?: string): SourceRange | undefined {
  if (!tagName || source.charCodeAt(start) !== 60 || source.charCodeAt(start + 1) !== 47) {
    return undefined
  }
  const begin = start + 2
  let cursor = begin
  while (isNameCode(source.charCodeAt(cursor))) {
    cursor++
  }
  if (source.slice(begin, cursor).toLowerCase() !== tagName) {
    return undefined
  }
  while (isSpaceCode(source.charCodeAt(cursor))) {
    cursor++
  }
  return source.charCodeAt(cursor) === 62 ? { start, end: cursor + 1 } : undefined
}

function templateEnd(source: string, start: number): number {
  let index = start + 1
  while (index < source.length) {
    const code = source.charCodeAt(index)
    if (code === 92) {
      index += 2
    }
    else if (code === 96) {
      return index + 1
    }
    else if (code === 36 && source.charCodeAt(index + 1) === 123) {
      index = scanCode(source, index + 2, undefined, true).end
    }
    else {
      index++
    }
  }
  return index
}

function scanCode(source: string, start: number, tagName?: string, interpolation = false): ScriptScan {
  const commentClosings: Array<SourceRange & { block: boolean }> = []
  const context = new TokenContext(interpolation)
  let index = start
  while (index < source.length) {
    const code = source.charCodeAt(index)
    const next = source.charCodeAt(index + 1)
    if (code === 60 && next === 47) {
      const closingTag = closingTagAt(source, index, tagName)
      if (closingTag) {
        return { closingTag, commentClosings, end: closingTag.end }
      }
    }
    if (isSpaceCode(code)) {
      if (code === 10 || code === 13 || code === 0x2028 || code === 0x2029) {
        context.lineBreak()
      }
      index++
      continue
    }
    if (code === 34 || code === 39) {
      index = quotedEnd(source, index, code)
      context.value(code)
    }
    else if (code === 96) {
      index = templateEnd(source, index)
      context.value(code)
    }
    else if (code === 47 && (next === 47 || next === 42)) {
      const block = next === 42
      const end = block ? source.indexOf('*/', index + 2) : findLineEnd(source, index + 2)
      const limit = end < 0 ? source.length : end
      if (tagName) {
        let candidate = source.indexOf('</', index + 2)
        while (candidate >= 0 && candidate < limit) {
          const closing = closingTagAt(source, candidate, tagName)
          if (closing) {
            commentClosings.push({ ...closing, block })
          }
          candidate = source.indexOf('</', candidate + 2)
        }
      }
      if (end < 0 && block) {
        return { trailingComment: index, commentClosings, end: source.length }
      }
      if (block) {
        context.lineBreak(source, index + 2, limit)
      }
      else if (end >= 0) {
        context.lineBreak()
      }
      index = limit + (end < 0 ? 0 : block ? 2 : 1)
      continue
    }
    else if (code === 47 && context.operand) {
      index = regexpEnd(source, index)
      context.value(code)
    }
    else if (isWordCode(code)) {
      const begin = index++
      while (isWordCode(source.charCodeAt(index))) {
        index++
      }
      context.word(source, begin, index)
      continue
    }
    else {
      if (interpolation && code === 125 && context.depth === 0) {
        return { end: index + 1 }
      }
      if ((code === 43 || code === 45) && next === code) {
        context.increment(code)
        index++
      }
      else {
        context.punctuation(code, next)
      }
      index++
    }
  }
  return { end: index, commentClosings }
}

/** 只收集词法候选，不加载 JS AST；歧义由调用方注入的 resolver 处理。 */
export function scanScriptBoundaryCandidates(source: string, start: number, tagName: string): ScriptBoundaryCandidates {
  return scanCode(source, start, tagName.toLowerCase())
}

/** 返回明确位于脚本代码层的结束标签，不擅自采用注释内的候选。 */
export function findScriptClosingTag(source: string, start: number, tagName: string): SourceRange | undefined {
  return scanScriptBoundaryCandidates(source, start, tagName).closingTag
}

/** 查找词法确认的未闭合尾部块注释。 */
export function findTrailingScriptComment(source: string): number | undefined {
  return scanCode(source, 0).trailingComment
}
