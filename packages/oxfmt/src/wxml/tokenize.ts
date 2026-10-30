export interface Attribute {
  name: string
  value?: string
  start: number
  end: number
}

export interface Tag {
  kind: 'tag'
  raw: string
  name: string
  nameStart: number
  nameEnd: number
  closing: boolean
  selfClosing: boolean
  attributes: Attribute[]
  offset: number
}

export type Token = Tag | { kind: 'raw', raw: string }

function fail(fileName: string, offset: number, detail: string): never {
  throw new Error(`${fileName}:${offset + 1}: ${detail}`)
}

function quotedEnd(source: string, start: number, fileName: string) {
  const quote = source[start]
  for (let index = start + 1; index < source.length; index++) {
    if (source[index] === '\\') {
      index++
    }
    else if (source[index] === quote) {
      return index + 1
    }
  }
  return fail(fileName, start, '未闭合的字符串')
}

/** 在表达式词法状态内识别结束符，避免把字符串、对象或正则中的符号当作标签。 */
function expressionEnd(source: string, start: number, fileName: string) {
  let depth = 0
  let operand = true
  for (let index = start + 2; index < source.length;) {
    const char = source[index]
    if (depth === 0 && source.startsWith('}}', index)) {
      return index + 2
    }
    if (/\s/.test(char)) {
      index++
      continue
    }
    if ('\'"`'.includes(char)) {
      index = quotedEnd(source, index, fileName)
      operand = false
      continue
    }
    if (source.startsWith('/*', index)) {
      const end = source.indexOf('*/', index + 2)
      if (end === -1) {
        fail(fileName, index, '未闭合的表达式注释')
      }
      index = end + 2
      continue
    }
    if (source.startsWith('//', index)) {
      const end = source.indexOf('\n', index + 2)
      if (end === -1) {
        fail(fileName, index, '未闭合的表达式')
      }
      index = end + 1
      continue
    }
    if (char === '/' && operand) {
      let characterClass = false
      let closed = false
      for (index++; index < source.length; index++) {
        const current = source[index]
        if (current === '\\') {
          index++
        }
        else if (current === '[') {
          characterClass = true
        }
        else if (current === ']') {
          characterClass = false
        }
        else if (current === '/' && !characterClass) {
          index++
          closed = true
          break
        }
      }
      if (!closed) {
        fail(fileName, start, '未闭合的正则表达式')
      }
      operand = false
      continue
    }
    if (/[\w$]/.test(char)) {
      const begin = index
      while (index < source.length && /[\w$]/.test(source[index])) {
        index++
      }
      operand = ['typeof', 'void', 'delete', 'in', 'instanceof', 'new', 'return'].includes(source.slice(begin, index))
      continue
    }
    if (char === '{') {
      depth++
    }
    if (char === '}') {
      depth--
    }
    if (depth < 0) {
      fail(fileName, index, '不匹配的表达式括号')
    }
    operand = !')]'.includes(char) && char !== '}'
    index++
  }
  return fail(fileName, start, '未闭合的插值表达式')
}

function readTag(source: string, start: number, fileName: string): Tag {
  let index = start + 1
  const closing = source[index] === '/'
  if (closing) {
    index++
  }
  const nameStart = index
  while (index < source.length && /[\w:.-]/.test(source[index])) {
    index++
  }
  const nameEnd = index
  const name = source.slice(nameStart, nameEnd)
  if (!name) {
    fail(fileName, start, '标签缺少名称')
  }
  const attributes: Attribute[] = []
  while (index < source.length) {
    while (/\s/.test(source[index] ?? '') && index < source.length) {
      index++
    }
    const selfClosing = source.startsWith('/>', index)
    if (source[index] === '>' || selfClosing) {
      index += selfClosing ? 2 : 1
      return { kind: 'tag', raw: source.slice(start, index), name, nameStart: nameStart - start, nameEnd: nameEnd - start, closing, selfClosing, attributes, offset: start }
    }
    if (closing) {
      fail(fileName, index, '结束标签不能包含属性')
    }
    const begin = index
    while (index < source.length && !/[\s=/>]/.test(source[index])) {
      index++
    }
    if (begin === index || source.slice(begin, index).includes('<')) {
      fail(fileName, index, '无效的属性名称')
    }
    const attributeName = source.slice(begin, index)
    while (index < source.length && /\s/.test(source[index])) {
      index++
    }
    if (source[index] !== '=') {
      attributes.push({ name: attributeName, start: index - start, end: index - start })
      continue
    }
    index++
    while (index < source.length && /\s/.test(source[index])) {
      index++
    }
    const valueStart = index
    const quote = '\'"'.includes(source[index] ?? '') ? source[index++] : undefined
    let closed = !quote
    while (index < source.length) {
      if (source.startsWith('{{', index)) {
        index = expressionEnd(source, index, fileName)
      }
      else if (quote && source[index] === quote) {
        index++
        closed = true
        break
      }
      else if (!quote && /[\s>]/.test(source[index])) {
        break
      }
      else if (!quote && source.startsWith('/>', index)) {
        break
      }
      else {
        index++
      }
    }
    if (!closed || index === valueStart) {
      fail(fileName, valueStart, '未闭合或为空的属性值')
    }
    attributes.push({ name: attributeName, value: source.slice(valueStart, index), start: valueStart - start, end: index - start })
  }
  return fail(fileName, start, '未闭合的标签')
}

/** 保留所有文本、注释及 WXS 内容原文；只将完整标签交给格式化阶段。 */
export function tokenize(source: string, fileName: string): Token[] {
  const tokens: Token[] = []
  let cursor = 0
  let rawStart = 0
  while (cursor < source.length) {
    if (source.startsWith('{{', cursor)) {
      cursor = expressionEnd(source, cursor, fileName)
      continue
    }
    const comment = source.startsWith('<!--', cursor) ? '-->' : source.startsWith('<![CDATA[', cursor) ? ']]>' : undefined
    if (comment) {
      const end = source.indexOf(comment, cursor + 4)
      if (end === -1) {
        fail(fileName, cursor, '未闭合的注释或 CDATA')
      }
      cursor = end + comment.length
      continue
    }
    if (source[cursor] !== '<' || !/^<\/?[A-Z_]/i.test(source.slice(cursor, cursor + 3))) {
      cursor++
      continue
    }
    if (cursor > rawStart) {
      tokens.push({ kind: 'raw', raw: source.slice(rawStart, cursor) })
    }
    const tag = readTag(source, cursor, fileName)
    tokens.push(tag)
    cursor += tag.raw.length
    rawStart = cursor
    if (!tag.closing && !tag.selfClosing && tag.name.toLowerCase() === 'wxs') {
      const remainder = source.slice(cursor)
      const close = /<\/wxs\s*>/i.exec(remainder)
      if (!close) {
        fail(fileName, tag.offset, '未闭合的 WXS 标签')
      }
      cursor += close.index
      if (cursor > rawStart) {
        tokens.push({ kind: 'raw', raw: source.slice(rawStart, cursor) })
      }
      const closingTag = readTag(source, cursor, fileName)
      tokens.push(closingTag)
      cursor += closingTag.raw.length
      rawStart = cursor
    }
  }
  if (rawStart < source.length) {
    tokens.push({ kind: 'raw', raw: source.slice(rawStart) })
  }
  return tokens
}
