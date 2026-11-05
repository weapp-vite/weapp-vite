import type { Attribute } from '@weapp-vite/wxml/core'
import type { Token } from '../shared'
import { decodeAttribute } from '@weapp-vite/wxml/core'

const xmlEntity = /&(?:#(?:x[\da-f]+|\d+)|amp|lt|gt|quot|apos);/gi

/** 构建分析保持原 XML 实体解码契约，不解释属性中的反斜杠。 */
export function decodeBuildAttribute(attribute: Attribute) {
  return decodeAttribute(attribute.value ?? '', 'xml', true, attribute.quote)
}

/** 从共享文本范围恢复既有实体回调分段，避免改变 i18n 消费的源码偏移。 */
export function textTokens(source: string, start: number, contentStart: number, end: number): Token[] {
  const value = source.slice(contentStart, end)
  const output: Token[] = []
  let offset = 0
  for (const match of value.matchAll(xmlEntity)) {
    const decoded = decodeAttribute(match[0], 'xml')
    if (decoded === match[0]) {
      continue
    }
    if (match.index > offset) {
      output.push({ start, end: contentStart + match.index, value: value.slice(offset, match.index) })
      start = contentStart + match.index
    }
    const entityEnd = contentStart + match.index + match[0].length
    output.push({ start, end: entityEnd, value: decoded })
    offset = match.index + match[0].length
    start = entityEnd
  }
  if (offset < value.length) {
    output.push({ start, end, value: value.slice(offset) })
  }
  return output
}
