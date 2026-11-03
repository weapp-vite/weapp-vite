import type { Token } from '@weapp-vite/wxml'
import type { SourceRange, WxmlSyntax } from './lexical'
import { findScriptClosingTag } from '@weapp-vite/language-service'
import { scan, scanComments } from '@weapp-vite/wxml'
import { failAt } from './lexical'

export interface Attribute extends SourceRange {
  name: string
  nameEnd: number
  quote?: string
  valueStart: number
  valueEnd: number
}

export interface Element extends SourceRange {
  tag: string
  nameStart: number
  nameEnd: number
  openingEnd: number
  closingName?: SourceRange
  selfClosing: boolean
  attrs: Attribute[]
  parent?: Element
  previous?: Element
  removed: boolean
}

function containsText(source: string, token: Token) {
  if (token.kind === 'cdata') {
    return true
  }
  if (token.kind !== 'text') {
    return false
  }
  for (let index = token.start; index < token.end; index++) {
    const code = source.charCodeAt(index)
    if (code !== 32 && code !== 9 && code !== 10 && code !== 12 && code !== 13) {
      return true
    }
  }
  return false
}

/** 将共享词法结果映射为既有编辑视图，不再重复解释源码边界。 */
export function scanTemplate(code: string, fileName: string, scriptTags: ReadonlySet<string>, collectComments: boolean, syntax: WxmlSyntax, collectElements = true) {
  const options = { syntax, rawTags: [...scriptTags], resolveScriptBoundary: findScriptClosingTag }
  const scanned = collectElements ? scan(code, options) : scanComments(code, options)
  const diagnostic = scanned.diagnostics.find(item => item.severity === 'error')
  if (diagnostic) {
    failAt(code, fileName, diagnostic.start, diagnostic.message)
  }
  const elements: Element[] = []
  const comments: SourceRange[] = []
  const indexed = new Map<number, Element>()
  const previous = new Map<number | undefined, Element | undefined>()
  let parentIndex: number | undefined
  for (let index = 0; index < scanned.tokens.length; index++) {
    const token = scanned.tokens[index]!
    if (token.kind === 'comment' && collectComments) {
      comments.push({ start: token.start, end: token.end })
    }
    if (!collectElements) {
      continue
    }
    if (token.kind !== 'tag') {
      if (containsText(code, token)) {
        previous.delete(parentIndex)
      }
      continue
    }
    if (token.closing) {
      parentIndex = token.parent
      continue
    }
    const closing = token.matching === undefined ? undefined : scanned.tokens[token.matching]
    const element: Element = {
      tag: token.name,
      start: token.start,
      end: closing?.end ?? token.end,
      nameStart: token.nameStart,
      nameEnd: token.nameEnd,
      openingEnd: token.end,
      selfClosing: token.selfClosing,
      closingName: closing?.kind === 'tag' ? { start: closing.nameStart, end: closing.nameEnd } : undefined,
      attrs: token.attributes.map(attribute => ({
        name: attribute.name,
        nameEnd: attribute.nameEnd,
        quote: attribute.quote,
        start: attribute.start,
        end: attribute.end,
        valueStart: attribute.valueStart ?? attribute.nameEnd,
        valueEnd: attribute.valueEnd ?? attribute.nameEnd,
      })),
      parent: token.parent === undefined ? undefined : indexed.get(token.parent),
      previous: previous.get(token.parent),
      removed: false,
    }
    elements.push(element)
    indexed.set(index, element)
    previous.set(token.parent, element)
    if (!token.selfClosing) {
      parentIndex = index
    }
  }
  return { elements, comments }
}
