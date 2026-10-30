import type { MiniprogramComponentAttribute, MiniprogramComponentAttributeConditionalValue } from './types'

export function joinMarkdownLines(lines?: string[]) {
  return (lines ?? [])
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n\n')
}

export function createConditionalValueDescriptions(conditional: MiniprogramComponentAttributeConditionalValue) {
  const attributeNames = (conditional.attrs ?? [])
    .map(attribute => `\`${attribute.name}\``)
    .filter(Boolean)

  return attributeNames.length > 0
    ? [`可用属性：${attributeNames.join('、')}`]
    : undefined
}

export function createConditionalValueDetail(conditional: MiniprogramComponentAttributeConditionalValue) {
  const attributeNames = (conditional.attrs ?? [])
    .map(attribute => attribute.name)
    .filter(name => Boolean(name) && !name.startsWith('bind') && !name.startsWith('catch'))

  if (attributeNames.length === 0) {
    return undefined
  }

  const visibleNames = attributeNames.slice(0, 3)
  return attributeNames.length > visibleNames.length
    ? `可用: ${visibleNames.join(', ')} 等${attributeNames.length}项`
    : `可用: ${visibleNames.join(', ')}`
}

export function renderAttributeType(attribute: MiniprogramComponentAttribute) {
  const enumValues = [
    ...(attribute.enum?.map(item => item.value).filter(Boolean) ?? []),
    ...(attribute.subAttrs?.map(item => item.equal).filter(Boolean) ?? []),
  ]

  if (enumValues.length > 0) {
    return [...new Set(enumValues)].map(value => `\`${value}\``).join(' | ')
  }

  return attribute.type?.name ? `\`${attribute.type.name}\`` : ''
}
