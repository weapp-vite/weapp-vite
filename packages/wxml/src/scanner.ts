import type { Diagnostic, ElementNode, Node, ParseOptions, Platform, RawToken, ScanResult, Syntax, TagToken, Token } from './types'
import { expressionEnd } from './expression'
import { isTagStartCode, TemplateLexicalError } from './lexical'
import { defaultRawTags } from './options'
import { scanScriptBoundaryCandidates } from './script'
import { scanTag } from './tag'

type MutableTag = { -readonly [K in keyof TagToken]: TagToken[K] }
type MutableElement = { -readonly [K in keyof ElementNode]: ElementNode[K] }
type TreeResult = ScanResult & { children: Node[], platform: Platform, syntax: Syntax }

const defaultRawTagPattern = new RegExp(`^(?:${defaultRawTags.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`, 'i')
const platforms = new Set(['weapp', 'alipay', 'tt', 'swan', 'jd', 'xhs', 'qq', 'ks', 'ty'])

function opaqueEnd(source: string, start: number) {
  const delimiter = source.startsWith('<!--', start) ? '-->' : source.startsWith('<![CDATA[', start) ? ']]>' : source.startsWith('<?', start) ? '?>' : undefined
  if (delimiter) {
    const end = source.indexOf(delimiter, start + 2)
    if (end < 0) {
      throw new TemplateLexicalError(start, '未闭合的注释、CDATA 或处理指令')
    }
    return end + delimiter.length
  }
  let quote = 0
  let depth = 0
  for (let index = start + 2; index < source.length; index++) {
    const code = source.charCodeAt(index)
    if (quote) {
      if (code === quote) {
        quote = 0
      }
    }
    else if (code === 34 || code === 39) {
      quote = code
    }
    else if (code === 91) {
      depth++
    }
    else if (code === 93) {
      depth--
    }
    else if (code === 62 && depth === 0) {
      return index + 1
    }
  }
  throw new TemplateLexicalError(start, '未闭合的模板声明')
}

/** 同一次词法扫描维护标签配对，可按需同步建立 AST，避免重新扫描源码。 */
export function scanDocument(source: string, options: ParseOptions, buildTree: true): TreeResult
export function scanDocument(source: string, options: ParseOptions, buildTree: false, commentsOnly?: boolean): ScanResult
export function scanDocument(source: string, options: ParseOptions, buildTree: boolean, commentsOnly = false): TreeResult | ScanResult {
  if (typeof source !== 'string' || !options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Expected template source and a parse options object.')
  }
  if (options.platform !== undefined && !platforms.has(options.platform)) {
    throw new TypeError(`Unsupported template platform: ${String(options.platform)}.`)
  }
  if (options.syntax !== undefined && options.syntax !== 'legacy' && options.syntax !== 'xml') {
    throw new TypeError(`Unsupported template syntax: ${String(options.syntax)}.`)
  }
  if (options.rawTags !== undefined && (!Array.isArray(options.rawTags) || options.rawTags.some(name => typeof name !== 'string' || !name))) {
    throw new TypeError('Expected rawTags to be an array of nonempty names.')
  }
  if (options.resolveScriptBoundary !== undefined && typeof options.resolveScriptBoundary !== 'function') {
    throw new TypeError('Expected resolveScriptBoundary to be a function.')
  }
  const platform = options.platform ?? 'weapp'
  const syntax: Syntax = options.syntax ?? (platform === 'weapp' ? 'legacy' : 'xml')
  const rawTags = options.rawTags ? new Set(options.rawTags.map(name => name.toLowerCase())) : undefined
  const tokens: Token[] = []
  const diagnostics: Diagnostic[] = []
  const stack: number[] = []
  const children: Node[] | undefined = buildTree ? [] : undefined
  const elements: MutableElement[] | undefined = buildTree ? [] : undefined
  const scanEnd = commentsOnly ? source.lastIndexOf('<!--') + 1 : source.length
  let cursor = 0
  let textStart = 0
  let nextTag = -1
  const bindings = { next: -1 }

  function appendTag(token: TagToken) {
    if (commentsOnly) {
      return
    }
    const mutable = token as MutableTag
    if (token.closing) {
      const openIndex = stack[stack.length - 1]
      const open = openIndex === undefined ? undefined : tokens[openIndex] as MutableTag
      if (!open || open.name !== token.name) {
        diagnostics.push({ code: 'template/mismatched-tag', message: `结束标签 </${token.name}> 与开始标签不匹配`, severity: 'error', start: token.start, end: token.end })
      }
      else {
        stack.pop()
        mutable.matching = openIndex
        mutable.parent = open.parent
        open.matching = tokens.length
        if (elements) {
          const element = elements.pop()!
          element.closing = token
          element.end = token.end
        }
      }
    }
    else {
      mutable.parent = stack[stack.length - 1]
      if (elements) {
        const element: MutableElement = { kind: 'element', name: token.name, attributes: token.attributes, children: [], opening: token, closing: undefined, selfClosing: token.selfClosing, start: token.start, end: token.end }
        const siblings = elements.length ? elements[elements.length - 1]!.children as Node[] : children!
        siblings.push(element)
        if (!token.selfClosing) {
          elements.push(element)
        }
      }
      if (!token.selfClosing) {
        stack.push(tokens.length)
      }
    }
    tokens.push(token)
  }

  function appendRaw(token: RawToken) {
    if (commentsOnly) {
      if (token.kind === 'comment') {
        tokens.push(token)
      }
      return
    }
    if (elements) {
      const siblings = elements.length ? elements[elements.length - 1]!.children as Node[] : children!
      siblings.push({ kind: token.kind, start: token.start, end: token.end, tagName: token.tagName, data: source.slice(token.start, token.end) })
    }
    tokens.push(token)
  }

  try {
    while (cursor < scanEnd) {
      if (!commentsOnly) {
        // 未找到时保留 Infinity；跨标签复用远处候选，避免反复搜索同一后缀。
        if (nextTag < cursor) {
          const found = source.indexOf('<', cursor)
          nextTag = found < 0 ? Number.POSITIVE_INFINITY : found
        }
        if (bindings.next < cursor) {
          const found = source.indexOf('{{', cursor)
          bindings.next = found < 0 ? Number.POSITIVE_INFINITY : found
        }
        if (bindings.next < nextTag) {
          cursor = expressionEnd(source, bindings.next, true, syntax)
          continue
        }
        if (nextTag >= scanEnd) {
          cursor = scanEnd
          break
        }
        cursor = nextTag
      }
      const code = source.charCodeAt(cursor)
      if (code === 123 && source.charCodeAt(cursor + 1) === 123) {
        cursor = expressionEnd(source, cursor, true, syntax)
        continue
      }
      const next = source.charCodeAt(cursor + 1)
      if (code !== 60 || (!isTagStartCode(next) && next !== 33 && next !== 47 && next !== 63)) {
        cursor++
        continue
      }
      if (cursor > textStart) {
        appendRaw({ kind: 'text', start: textStart, end: cursor })
      }
      if (next === 33 || next === 63) {
        const end = opaqueEnd(source, cursor)
        const kind = source.startsWith('<!--', cursor) ? 'comment' : source.startsWith('<![CDATA[', cursor) ? 'cdata' : 'declaration'
        appendRaw({ kind, start: cursor, end })
        cursor = end
      }
      else {
        const tag = scanTag(source, cursor, syntax, !commentsOnly, bindings)
        appendTag(tag)
        cursor = tag.end
        if (!tag.closing && !tag.selfClosing && (rawTags ? rawTags.has(tag.name.toLowerCase()) : defaultRawTagPattern.test(tag.name))) {
          const candidates = scanScriptBoundaryCandidates(source, cursor, tag.name)
          const close = options.resolveScriptBoundary ? options.resolveScriptBoundary(source, cursor, tag.name, candidates) : candidates.closingTag
          if (!close) {
            if (candidates.commentClosings?.length) {
              throw new TemplateLexicalError(tag.start, `脚本标签 <${tag.name}> 的结束边界存在歧义，需要 resolveScriptBoundary`)
            }
            throw new TemplateLexicalError(tag.start, `未闭合的脚本标签 <${tag.name}>`)
          }
          if (!Number.isInteger(close.start) || !Number.isInteger(close.end) || close.start < cursor || close.end > source.length || close.end <= close.start) {
            throw new TemplateLexicalError(tag.start, '脚本边界 resolver 返回了无效范围')
          }
          appendRaw({ kind: 'script', tagName: tag.name, start: cursor, end: close.start })
          const closing = scanTag(source, close.start, syntax, !commentsOnly, bindings)
          if (!closing.closing || closing.end !== close.end || closing.name.toLowerCase() !== tag.name.toLowerCase()) {
            throw new TemplateLexicalError(close.start, '脚本边界 resolver 返回的范围不是对应结束标签')
          }
          appendTag(closing)
          cursor = closing.end
        }
      }
      textStart = cursor
    }
    if (!commentsOnly && textStart < source.length) {
      appendRaw({ kind: 'text', start: textStart, end: source.length })
    }
    for (const index of stack) {
      const token = tokens[index] as TagToken
      diagnostics.push({ code: 'template/unclosed-tag', message: `标签 <${token.name}> 缺少结束标签`, severity: 'error', start: token.start, end: token.end })
    }
  }
  catch (error) {
    if (!(error instanceof TemplateLexicalError)) {
      throw error
    }
    diagnostics.push({ code: error.recovery ? 'template/invalid-interpolation' : 'template/invalid-syntax', message: error.message, severity: 'error', start: error.offset, end: Math.min(source.length, error.offset + 1), ...(error.recovery ? { recovery: error.recovery } : {}) })
  }
  return buildTree ? { tokens, diagnostics, children: children!, platform, syntax } : { tokens, diagnostics }
}

/** 扫描保留原文的 tokens 与诊断，不分配 AST 节点。 */
export function scan(source: string, options: ParseOptions = {}): ScanResult {
  return scanDocument(source, options, false)
}

/** 只收集普通模板注释，不建立属性和标签配对，最后一个候选之后停止扫描。 */
export function scanComments(source: string, options: ParseOptions = {}): ScanResult {
  return scanDocument(source, options, false, true)
}
