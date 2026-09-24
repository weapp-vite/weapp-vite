/** 按表达式词法寻找插值边界，字符串和对象内部的大括号不结束绑定。 */
export function templateInterpolations(source: string) {
  const ranges: Array<{ start: number, end: number, expression: string }> = []
  let offset = 0
  while (offset < source.length) {
    const start = source.indexOf('{{', offset)
    if (start < 0) {
      break
    }
    let quote: string | undefined
    let depth = 0
    let closed = false
    for (let i = start + 2; i < source.length; i++) {
      const char = source[i]
      if (quote) {
        if (char === '\\') {
          i++
        }
        else if (char === quote) {
          quote = undefined
        }
      }
      else if (char === '\'' || char === '"') {
        quote = char
      }
      else if (char === '{') {
        depth++
      }
      else if (char === '}') {
        if (depth === 0 && source[i + 1] === '}') {
          ranges.push({ start, end: i + 2, expression: source.slice(start + 2, i) })
          offset = i + 2
          closed = true
          break
        }
        depth--
      }
    }
    if (!closed) {
      break
    }
  }
  return ranges
}

export function isTemplateExpression(value: string) {
  const trimmed = value.trim()
  const ranges = templateInterpolations(trimmed)
  return ranges.length === 1 && ranges[0]!.start === 0 && ranges[0]!.end === trimmed.length
}
