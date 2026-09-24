import type { SourceRange, WxmlSyntax } from './lexical'
import { failAt, findScriptClose, isSpace, skipDelimited, skipInterpolation, skipSpace } from './lexical'

export interface Attribute extends SourceRange {
  name: string
  valueStart: number
  valueEnd: number
}

export interface Element extends SourceRange {
  tag: string
  attrs: Attribute[]
  parent?: Element
  previous?: Element
  removed: boolean
}

interface Frame {
  node?: Element
  previous?: Element
}

function readAttribute(code: string, start: number, fileName: string, syntax: WxmlSyntax, attributes?: Attribute[]): number {
  let i = start
  while (i < code.length && !isSpace(code[i]) && code[i] !== '=' && code[i] !== '>' && code[i] !== '/') {
    i++
  }
  if (i === start) {
    failAt(code, fileName, start, 'Invalid attribute in opening tag.')
  }
  const nameEnd = i
  i = skipSpace(code, i)
  if (code[i] !== '=') {
    attributes?.push({ name: code.slice(start, nameEnd), start, end: nameEnd, valueStart: nameEnd, valueEnd: nameEnd })
    return nameEnd
  }
  i = skipSpace(code, i + 1)
  const quote = code[i] === '"' || code[i] === '\'' ? code[i++] : undefined
  const valueStart = i
  while (i < code.length) {
    if (code.startsWith('{{', i)) {
      i = skipInterpolation(code, i, fileName, syntax, quote)
    }
    else if (quote && syntax === 'legacy' && code[i] === '\\' && (code[i + 1] === quote || code[i + 1] === '\\')) {
      i += 2
    }
    else if (quote ? code[i] === quote : isSpace(code[i]) || code[i] === '>' || code.startsWith('/>', i)) {
      const end = quote ? i + 1 : i
      attributes?.push({ name: code.slice(start, nameEnd), start, end, valueStart, valueEnd: i })
      return end
    }
    else {
      i++
    }
  }
  return failAt(code, fileName, start, `Unterminated attribute ${code.slice(start, nameEnd)}.`)
}

export function scanTemplate(
  code: string,
  fileName: string,
  scriptTags: ReadonlySet<string>,
  collectComments: boolean,
  syntax: WxmlSyntax,
  collectElements = true,
) {
  const elements: Element[] = []
  const comments: SourceRange[] = []
  const stack: Frame[] = collectElements ? [{}] : []
  // 只清理注释时，共用词法边界但不建立节点/属性树；最后一个候选之后没有需要处理的内容。
  const scanEnd = collectElements ? code.length : code.lastIndexOf('<!--') + 1
  let i = 0
  while (i < scanEnd) {
    const frame = stack[stack.length - 1]
    if (code.startsWith('{{', i)) {
      if (frame) {
        frame.previous = undefined
      }
      i = skipInterpolation(code, i, fileName, syntax)
      continue
    }
    if (code.startsWith('<!--', i)) {
      const end = skipDelimited(code, i, '<!--', '-->', fileName)
      if (collectComments) {
        comments.push({ start: i, end })
      }
      i = end
      continue
    }
    if (code.startsWith('<![CDATA[', i)) {
      if (frame) {
        frame.previous = undefined
      }
      i = skipDelimited(code, i, '<![CDATA[', ']]>', fileName)
      continue
    }
    if (code.startsWith('<?', i) || code.startsWith('<!', i)) {
      const start = i
      let quote: string | undefined
      for (i += 2; i < code.length; i++) {
        if (quote) {
          if (code[i] === quote) {
            quote = undefined
          }
        }
        else if (code[i] === '"' || code[i] === '\'') {
          quote = code[i]
        }
        else if (code[i] === '>') {
          break
        }
      }
      if (i === code.length) {
        failAt(code, fileName, start, 'Unterminated template declaration.')
      }
      i++
      continue
    }
    if (code.startsWith('</', i)) {
      const start = i
      const nameStart = i += 2
      while (i < code.length && !isSpace(code[i]) && code[i] !== '>') {
        i++
      }
      const nameEnd = i
      i = skipSpace(code, i)
      if (code[i] !== '>' || (collectElements && (!frame.node || code.slice(nameStart, nameEnd) !== frame.node.tag))) {
        failAt(code, fileName, start, `Unexpected closing tag </${code.slice(nameStart, nameEnd)}>.`)
      }
      i++
      if (collectElements) {
        frame.node!.end = i
        stack.pop()
      }
      continue
    }
    const next = code.charCodeAt(i + 1)
    if (code[i] !== '<' || !((next >= 65 && next <= 90) || (next >= 97 && next <= 122) || next === 95)) {
      if (frame && !isSpace(code[i])) {
        frame.previous = undefined
      }
      i++
      continue
    }
    const start = i++
    const nameStart = i
    while (i < code.length && !isSpace(code[i]) && code[i] !== '/' && code[i] !== '>') {
      i++
    }
    const tag = code.slice(nameStart, i)
    const node: Element | undefined = collectElements
      ? { tag, start, end: 0, attrs: [], parent: frame.node, previous: frame.previous, removed: false }
      : undefined
    let selfClosing = false
    let openingEnd = 0
    while (i < code.length) {
      i = skipSpace(code, i)
      if (code[i] === '>' || code.startsWith('/>', i)) {
        selfClosing = code[i] === '/'
        i += selfClosing ? 2 : 1
        openingEnd = i
        break
      }
      if (i < code.length) {
        i = readAttribute(code, i, fileName, syntax, node?.attrs)
      }
    }
    if (!openingEnd) {
      failAt(code, fileName, start, `Unterminated opening tag <${tag}>.`)
    }
    if (node) {
      node.end = openingEnd
      elements.push(node)
      frame.previous = node
      if (!selfClosing) {
        stack.push({ node })
      }
    }
    if (!selfClosing && scriptTags.has(tag)) {
      i = findScriptClose(code, i, tag, fileName)
    }
  }
  const unclosed = stack[stack.length - 1]?.node
  if (unclosed) {
    failAt(code, fileName, unclosed.start, `Missing closing tag for <${unclosed.tag}>.`)
  }
  return { elements, comments }
}
