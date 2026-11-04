import type { ParseOptions } from '../../../packages/wxml/src/types'

export const xmlSubsetContract = 'xml-common-v1'
export type XmlSubset = { eligible: true } | { eligible: false, reason: string }
const entity = /&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);/g
const name = /^[A-Z_][\w:.-]*/i
const attributeName = /^[A-Z_:][\w:.-]*/i
const defaultRawTags = ['wxs', 'sjs', 'ks', 'filter', 'script', 'import-sjs']

function xmlCharacter(code: number) {
  return code === 9 || code === 10 || code === 13 || (code >= 0x20 && code <= 0xD7FF) || (code >= 0xE000 && code <= 0xFFFD) || (code >= 0x10000 && code <= 0x10FFFF)
}

function entitiesAreXml(source: string) {
  let valid = true
  const remaining = source.replace(entity, (value) => {
    if (value.startsWith('&#')) {
      const hexadecimal = value[2] === 'x'
      valid &&= xmlCharacter(Number.parseInt(value.slice(hexadecimal ? 3 : 2, -1), hexadecimal ? 16 : 10))
    }
    return ''
  })
  return valid && !remaining.includes('&')
}

/** 判定仅依赖固定语法与输入，不读取被测 parser 的成功或失败结果。 */
export function classifyXmlSubset(source: string, options: ParseOptions): XmlSubset {
  for (const character of source) {
    if (!xmlCharacter(character.codePointAt(0)!)) {
      return { eligible: false, reason: 'non-xml-character' }
    }
  }
  if (source.includes('{{')) {
    return { eligible: false, reason: 'template-bindings' }
  }
  const syntax = options.syntax ?? (!options.platform || options.platform === 'weapp' ? 'legacy' : 'xml')
  if (syntax === 'legacy' && source.includes('\\')) {
    return { eligible: false, reason: 'legacy-host-escapes' }
  }
  const rawTags = new Set((options.rawTags ?? defaultRawTags).map(tag => tag.toLowerCase()))
  const stack: string[] = []
  let cursor = 0
  const whitespace = () => {
    while (/[\t\n\r ]/.test(source[cursor] ?? '') && cursor < source.length) {
      cursor++
    }
  }
  while (cursor < source.length) {
    const opening = source.indexOf('<', cursor)
    const textEnd = opening < 0 ? source.length : opening
    if (!entitiesAreXml(source.slice(cursor, textEnd))) {
      return { eligible: false, reason: 'non-xml-entity' }
    }
    cursor = textEnd
    if (cursor === source.length) {
      break
    }
    const opaque = source.startsWith('<!--', cursor) ? ['<!--', '-->'] : source.startsWith('<![CDATA[', cursor) ? ['<![CDATA[', ']]>'] : undefined
    if (opaque) {
      const end = source.indexOf(opaque[1]!, cursor + opaque[0]!.length)
      if (end < 0) {
        return { eligible: false, reason: 'unclosed-opaque-region' }
      }
      cursor = end + opaque[1]!.length
      continue
    }
    if (source.startsWith('<!', cursor) || source.startsWith('<?', cursor)) {
      return { eligible: false, reason: 'declaration-or-processing-instruction' }
    }
    const closing = source[cursor + 1] === '/'
    cursor += closing ? 2 : 1
    const tag = name.exec(source.slice(cursor))?.[0]
    if (!tag) {
      return { eligible: false, reason: 'non-common-tag-name-or-literal-less-than' }
    }
    cursor += tag.length
    if (rawTags.has(tag.toLowerCase())) {
      return { eligible: false, reason: 'configured-raw-script' }
    }
    if (closing) {
      whitespace()
      if (source[cursor++] !== '>' || stack.pop() !== tag) {
        return { eligible: false, reason: 'non-common-tag-pairing' }
      }
      continue
    }
    const attributes = new Set<string>()
    let ended = false
    while (cursor < source.length) {
      const previous = cursor
      whitespace()
      if (source[cursor] === '>') {
        cursor++
        stack.push(tag)
        ended = true
        break
      }
      if (source[cursor] === '/' && source[cursor + 1] === '>') {
        cursor += 2
        ended = true
        break
      }
      const attribute = attributeName.exec(source.slice(cursor))?.[0]
      if (previous === cursor || !attribute) {
        return { eligible: false, reason: 'non-common-attribute-name' }
      }
      if (attributes.has(attribute)) {
        return { eligible: false, reason: 'duplicate-xml-attribute' }
      }
      attributes.add(attribute)
      cursor += attribute.length
      whitespace()
      if (source[cursor++] !== '=') {
        return { eligible: false, reason: 'bare-attribute' }
      }
      whitespace()
      const quote = source[cursor++]
      if (quote !== '"' && quote !== '\'') {
        return { eligible: false, reason: 'unquoted-attribute' }
      }
      const end = source.indexOf(quote, cursor)
      if (end < 0) {
        return { eligible: false, reason: 'unclosed-attribute' }
      }
      const value = source.slice(cursor, end)
      if (value.includes('<') || !entitiesAreXml(value)) {
        return { eligible: false, reason: 'non-xml-attribute-value' }
      }
      cursor = end + 1
    }
    if (!ended) {
      return { eligible: false, reason: 'unclosed-tag' }
    }
  }
  return stack.length ? { eligible: false, reason: 'non-common-tag-pairing' } : { eligible: true }
}
