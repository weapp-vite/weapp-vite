import { templateInterpolations } from './templateInterpolation'

function decodeAttribute(raw: string, quote: string) {
  const source = raw.replaceAll(`\\${quote}`, quote)
  let value = ''
  let offset = 0
  for (const range of templateInterpolations(source)) {
    value += source.slice(offset, range.start).replace(/\\([\s\S])/g, '$1')
    value += source.slice(range.start, range.end)
    offset = range.end
  }
  return value + source.slice(offset).replace(/\\([\s\S])/g, '$1')
}

/** 先保存 WXML 属性词法值，再交给 HTML parser 构建标签树，避免反斜杠引号提前截断属性。 */
export function maskTemplateAttributes(source: string) {
  let prefix = '__mpcore_quoted_attribute_'
  while (source.includes(prefix)) {
    prefix += '_'
  }
  const attributes = new Map<string, string>()
  let output = ''
  let offset = 0
  for (let i = 0; i < source.length; i++) {
    if (source.startsWith('<!--', i)) {
      const end = source.indexOf('-->', i + 4)
      i = end < 0 ? source.length : end + 2
      continue
    }
    if (source[i] !== '<' || !/[a-z_]/i.test(source[i + 1] ?? '')) {
      continue
    }
    for (i++; i < source.length && source[i] !== '>'; i++) {
      if (source[i] !== '"' && source[i] !== '\'') {
        continue
      }
      const quote = source[i]!
      const start = i + 1
      for (i++; i < source.length && source[i] !== quote; i++) {
        if (source[i] === '\\') {
          i++
        }
      }
      if (i >= source.length) {
        break
      }
      const token = `${prefix}${attributes.size}`
      attributes.set(token, decodeAttribute(source.slice(start, i), quote))
      output += source.slice(offset, start) + token
      offset = i
    }
  }
  return { source: output + source.slice(offset), attributes }
}
