/* eslint-disable ts/no-use-before-define -- 模板字符串与插值表达式互相递归读取。 */
/** 词法错误携带源码偏移，避免调用方猜测解析失败的位置。 */
export class TemplateLexicalError extends Error {
  constructor(public offset: number, message: string) {
    super(message)
  }
}

function quotedEnd(source: string, start: number) {
  const quote = source[start]
  for (let index = start + 1; index < source.length; index++) {
    if (source[index] === '\\') {
      index++
    }
    else if (quote === '`' && source.startsWith('${', index)) {
      index = expressionEnd(source, index + 1, false) - 1
    }
    else if (source[index] === quote) {
      return index + 1
    }
  }
  throw new TemplateLexicalError(start, '未闭合的表达式字符串')
}

function regexpEnd(source: string, start: number) {
  let characterClass = false
  for (let index = start + 1; index < source.length; index++) {
    const char = source[index]
    if (char === '\\') {
      index++
    }
    else if (char === '[') {
      characterClass = true
    }
    else if (char === ']') {
      characterClass = false
    }
    else if (char === '/' && !characterClass) {
      while (/[a-z]/i.test(source[index + 1] ?? '')) {
        index++
      }
      return index + 1
    }
    else if (char === '\n' || char === '\r') {
      break
    }
  }
  throw new TemplateLexicalError(start, '未闭合的表达式正则')
}

/** 跳过插值内的字符串、注释、嵌套对象及正则，不把其中的模板字符当作结构。 */
export function expressionEnd(source: string, start: number, mustache = true): number {
  const brackets: string[] = []
  let operand = true
  const begin = start + (mustache ? 2 : 1)
  for (let index = begin; index < source.length;) {
    const char = source[index]
    if (brackets.length === 0 && (mustache ? source.startsWith('}}', index) : char === '}')) {
      return index + (mustache ? 2 : 1)
    }
    if (/\s/.test(char)) {
      index++
      continue
    }
    if ('\'"`'.includes(char)) {
      index = quotedEnd(source, index)
      operand = false
      continue
    }
    if (source.startsWith('/*', index)) {
      const end = source.indexOf('*/', index + 2)
      if (end < 0) {
        throw new TemplateLexicalError(index, '未闭合的表达式注释')
      }
      index = end + 2
      continue
    }
    if (source.startsWith('//', index)) {
      const end = source.indexOf('\n', index + 2)
      if (end < 0) {
        throw new TemplateLexicalError(index, '未闭合的插值表达式')
      }
      index = end + 1
      continue
    }
    if (char === '/' && operand) {
      index = regexpEnd(source, index)
      operand = false
      continue
    }
    if (/[\w$]/.test(char)) {
      const wordStart = index++
      while (/[\w$]/.test(source[index] ?? '')) {
        index++
      }
      operand = /^(?:typeof|void|delete|in|instanceof|new|return)$/.test(source.slice(wordStart, index))
      continue
    }
    if (source.startsWith('++', index) || source.startsWith('--', index)) {
      index += 2
      continue
    }
    if ('([{'.includes(char)) {
      brackets.push(char)
    }
    else if (')]}'.includes(char)) {
      const expected = char === ')' ? '(' : char === ']' ? '[' : '{'
      if (brackets.pop() !== expected) {
        throw new TemplateLexicalError(index, '不匹配的表达式括号')
      }
    }
    operand = !')]}'.includes(char)
    index++
  }
  throw new TemplateLexicalError(start, '未闭合的插值表达式')
}
