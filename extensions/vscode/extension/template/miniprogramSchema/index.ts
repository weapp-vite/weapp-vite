import type { LanguagePlatform } from '@weapp-vite/language-service'
import type { MiniprogramComponentAttribute, ResolvedMiniprogramAttributeMatch } from './types'
import { getComponents } from './data'
import { createConditionalValueDescriptions, createConditionalValueDetail, joinMarkdownLines, renderAttributeType } from './markdown'

export function getMiniprogramComponentNames(platform: LanguagePlatform = 'weapp') {
  return [...getComponents(platform).keys()]
}

export function getMiniprogramComponentEntry(tagName: string, platform: LanguagePlatform = 'weapp') {
  return getComponents(platform).get(tagName) ?? null
}

function getCurrentAttributeValue(currentAttributes: Record<string, string | boolean> | undefined, attributeName: string) {
  return currentAttributes?.[attributeName]
}

function getAvailableAttributesFromList(
  attributes: MiniprogramComponentAttribute[],
  currentAttributes: Record<string, string | boolean> | undefined,
) {
  const results = attributes.filter(attribute => getCurrentAttributeValue(currentAttributes, attribute.name) == null)

  for (const attribute of [...results]) {
    for (const conditional of attribute.subAttrs ?? []) {
      for (const subAttribute of conditional.attrs ?? []) {
        if (
          results.every(item => item.name !== subAttribute.name)
          && getCurrentAttributeValue(currentAttributes, subAttribute.name) == null
        ) {
          results.push(subAttribute)
        }
      }
    }
  }

  for (const attribute of attributes) {
    const currentValue = getCurrentAttributeValue(currentAttributes, attribute.name)

    if (currentValue == null) {
      continue
    }

    const matchedConditional = attribute.subAttrs?.find(item => item.equal === currentValue)

    if (!matchedConditional) {
      continue
    }

    for (const subAttribute of matchedConditional.attrs ?? []) {
      if (
        results.every(item => item.name !== subAttribute.name)
        && getCurrentAttributeValue(currentAttributes, subAttribute.name) == null
      ) {
        results.push(subAttribute)
      }
    }
  }

  return results
}

export function getMiniprogramComponentAttributes(
  tagName: string,
  currentAttributes?: Record<string, string | boolean>,
  platform: LanguagePlatform = 'weapp',
) {
  const attributes = getMiniprogramComponentEntry(tagName, platform)?.attrs ?? []

  return getAvailableAttributesFromList(attributes, currentAttributes)
}

export function getMiniprogramComponentAttribute(tagName: string, attributeName: string, platform: LanguagePlatform = 'weapp') {
  return getMiniprogramComponentEntry(tagName, platform)?.attrsByName.get(attributeName) ?? null
}

function resolveMiniprogramComponentAttribute(
  tagName: string,
  attributeName: string,
  currentAttributes?: Record<string, string | boolean>,
  platform: LanguagePlatform = 'weapp',
): ResolvedMiniprogramAttributeMatch | null {
  const entry = getMiniprogramComponentEntry(tagName, platform)

  if (!entry) {
    return null
  }

  const directAttribute = entry.attrsByName.get(attributeName)

  if (directAttribute) {
    return {
      attribute: directAttribute,
      condition: null,
    }
  }

  const candidates: ResolvedMiniprogramAttributeMatch[] = []

  for (const rootAttribute of entry.attrs ?? []) {
    for (const conditional of rootAttribute.subAttrs ?? []) {
      for (const nestedAttribute of conditional.attrs ?? []) {
        if (nestedAttribute.name !== attributeName) {
          continue
        }

        const candidate = {
          attribute: nestedAttribute,
          condition: {
            attributeName: rootAttribute.name,
            value: conditional.equal,
          },
        } satisfies ResolvedMiniprogramAttributeMatch

        if (currentAttributes?.[rootAttribute.name] === conditional.equal) {
          return candidate
        }

        candidates.push(candidate)
      }
    }
  }

  return candidates[0] ?? null
}

export function getMiniprogramAttributeValues(tagName: string, attributeName: string, platform: LanguagePlatform = 'weapp') {
  const attribute = getMiniprogramComponentAttribute(tagName, attributeName, platform)

  if (!attribute) {
    return []
  }

  if (attribute.enum?.length) {
    return attribute.enum
  }

  return (attribute.subAttrs ?? []).map(item => ({
    desc: createConditionalValueDescriptions(item),
    detail: createConditionalValueDetail(item),
    value: item.equal,
  }))
}

function renderConditionDetail(condition: ResolvedMiniprogramAttributeMatch['condition']) {
  return condition ? `${condition.attributeName}=${condition.value}` : undefined
}

export function getMiniprogramComponentCompletionDetail() {
  return 'native component'
}

export function getMiniprogramAttributeCompletionDetail(
  tagName: string,
  attributeName: string,
  currentAttributes?: Record<string, string | boolean>,
  platform: LanguagePlatform = 'weapp',
) {
  const resolvedMatch = resolveMiniprogramComponentAttribute(tagName, attributeName, currentAttributes, platform)
  const conditionDetail = renderConditionDetail(resolvedMatch?.condition ?? null)

  if (conditionDetail) {
    return conditionDetail
  }

  const attribute = resolvedMatch?.attribute

  if (!attribute) {
    return undefined
  }

  if (attribute.enum?.length || attribute.subAttrs?.length) {
    return 'enum'
  }

  if (attribute.type?.name) {
    return attribute.type.name
  }

  return attribute.defaultValue
    ? `default=${attribute.defaultValue}`
    : undefined
}

export function getMiniprogramComponentHoverMarkdown(tagName: string, platform: LanguagePlatform = 'weapp') {
  const entry = getMiniprogramComponentEntry(tagName, platform)

  if (!entry) {
    return null
  }

  const parts = [
    `## \`${entry.name}\``,
    joinMarkdownLines(entry.desc),
    entry.docLink ? `[官方文档](${entry.docLink})` : '',
  ].filter(Boolean)

  const tips = joinMarkdownLines(entry.tips)

  if (tips) {
    parts.push(`### 提示\n\n${tips}`)
  }

  return parts.join('\n\n')
}

function renderConditionalAttributeSummary(attribute: MiniprogramComponentAttribute) {
  if (!attribute.subAttrs?.length) {
    return ''
  }

  const rows = attribute.subAttrs
    .map((item) => {
      const attributeNames = (item.attrs ?? []).map(attr => `\`${attr.name}\``).join('、')
      return `- \`${item.equal}\`：${attributeNames || '无额外字段'}`
    })
    .filter(Boolean)

  return rows.length > 0
    ? `### 条件分支\n\n${rows.join('\n')}`
    : ''
}

export function getMiniprogramAttributeHoverMarkdown(
  tagName: string,
  attributeName: string,
  currentAttributes?: Record<string, string | boolean>,
  platform: LanguagePlatform = 'weapp',
) {
  const entry = getMiniprogramComponentEntry(tagName, platform)
  const resolvedMatch = resolveMiniprogramComponentAttribute(tagName, attributeName, currentAttributes, platform)
  const attribute = resolvedMatch?.attribute ?? null

  if (!entry || !attribute) {
    return null
  }

  const parts = [
    `## \`${entry.name}.${attribute.name}\``,
    renderAttributeType(attribute),
    joinMarkdownLines(attribute.desc),
  ].filter(Boolean)

  if (resolvedMatch?.condition) {
    parts.push(`条件：\`${resolvedMatch.condition.attributeName}="${resolvedMatch.condition.value}"\``)
  }

  if (attribute.defaultValue != null && attribute.defaultValue !== '') {
    parts.push(`默认值：\`${attribute.defaultValue}\``)
  }

  if (attribute.since) {
    parts.push(`最低基础库：\`${attribute.since}\``)
  }

  if (entry.docLink) {
    parts.push(`[官方文档](${entry.docLink})`)
  }

  const conditionalSummary = renderConditionalAttributeSummary(attribute)

  if (conditionalSummary) {
    parts.push(conditionalSummary)
  }

  return parts.join('\n\n')
}
