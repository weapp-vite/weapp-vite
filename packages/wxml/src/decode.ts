import type { Syntax } from './types'
import { decodeXML } from 'entities'
import { decodeLegacyAttributeLayer } from './attributeLayer'
import { legacyAttributeInterpolations } from './expression'

/** 解码不含外层引号的词法属性值；表达式内部保留 JS 字符串的转义层。 */
export function decodeAttribute(value: string, syntax: Syntax = 'legacy', decodeEntities = true, quote?: string) {
  if (syntax !== 'legacy') {
    return decodeEntities ? decodeXML(value) : value
  }
  const decoded = quote && value.includes('\\') ? decodeLegacyAttributeLayer(value) : value
  if (!decodeEntities || !decoded.includes('&')) {
    return decoded
  }
  if (!decoded.includes('{{')) {
    return decodeXML(decoded)
  }
  let result = ''
  let offset = 0
  for (const range of legacyAttributeInterpolations(decoded)) {
    result += decodeXML(decoded.slice(offset, range.start))
    result += decoded.slice(range.start, range.end)
    offset = range.end
  }
  return result + decodeXML(decoded.slice(offset))
}
