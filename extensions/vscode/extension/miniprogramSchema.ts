import miniprogramComponents from './data/miniprogram-components.json'

interface MiniprogramComponentAttributeValue {
  desc?: string[]
  value: string
}

interface MiniprogramComponentAttributeConditionalValue {
  attrs?: MiniprogramComponentAttribute[]
  equal: string
}

interface MiniprogramComponentAttributeType {
  name?: string
}

interface MiniprogramComponentAttribute {
  defaultValue?: string
  desc?: string[]
  enum?: MiniprogramComponentAttributeValue[]
  name: string
  since?: string
  subAttrs?: MiniprogramComponentAttributeConditionalValue[]
  type?: MiniprogramComponentAttributeType
}

interface MiniprogramComponentEntry {
  attrs?: MiniprogramComponentAttribute[]
  demoImages?: string[]
  desc?: string[]
  docLink?: string
  name: string
  tips?: string[]
}

interface MiniprogramComponentIndexEntry extends MiniprogramComponentEntry {
  attrsByName: Map<string, MiniprogramComponentAttribute>
}

interface ResolvedMiniprogramAttributeMatch {
  attribute: MiniprogramComponentAttribute
  condition: {
    attributeName: string
    value: string
  } | null
}

const componentEntries = (miniprogramComponents as MiniprogramComponentEntry[]).map((entry) => {
  return {
    ...entry,
    attrsByName: new Map((entry.attrs ?? []).map(attribute => [attribute.name, attribute])),
  } satisfies MiniprogramComponentIndexEntry
})

const componentsByName = new Map(componentEntries.map(entry => [entry.name, entry]))

function joinMarkdownLines(lines?: string[]) {
  return (lines ?? [])
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n\n')
}

function createConditionalValueDescriptions(conditional: MiniprogramComponentAttributeConditionalValue) {
  const attributeNames = (conditional.attrs ?? [])
    .map(attribute => `\`${attribute.name}\``)
    .filter(Boolean)

  return attributeNames.length > 0
    ? [`可用属性：${attributeNames.join('、')}`]
    : undefined
}

function renderAttributeType(attribute: MiniprogramComponentAttribute) {
  const enumValues = [
    ...(attribute.enum?.map(item => item.value).filter(Boolean) ?? []),
    ...(attribute.subAttrs?.map(item => item.equal).filter(Boolean) ?? []),
  ]

  if (enumValues.length > 0) {
    return [...new Set(enumValues)].map(value => `\`${value}\``).join(' | ')
  }

  return attribute.type?.name ? `\`${attribute.type.name}\`` : ''
}

export function getMiniprogramComponentNames() {
  return componentEntries.map(entry => entry.name)
}

export function getMiniprogramComponentEntry(tagName: string) {
  return componentsByName.get(tagName) ?? null
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
) {
  const attributes = getMiniprogramComponentEntry(tagName)?.attrs ?? []

  return getAvailableAttributesFromList(attributes, currentAttributes)
}

export function getMiniprogramComponentAttribute(tagName: string, attributeName: string) {
  return getMiniprogramComponentEntry(tagName)?.attrsByName.get(attributeName) ?? null
}

function resolveMiniprogramComponentAttribute(
  tagName: string,
  attributeName: string,
  currentAttributes?: Record<string, string | boolean>,
): ResolvedMiniprogramAttributeMatch | null {
  const entry = getMiniprogramComponentEntry(tagName)

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

export function getMiniprogramAttributeValues(tagName: string, attributeName: string) {
  const attribute = getMiniprogramComponentAttribute(tagName, attributeName)

  if (!attribute) {
    return []
  }

  if (attribute.enum?.length) {
    return attribute.enum
  }

  return (attribute.subAttrs ?? []).map(item => ({
    desc: createConditionalValueDescriptions(item),
    value: item.equal,
  }))
}

export function getMiniprogramComponentHoverMarkdown(tagName: string) {
  const entry = getMiniprogramComponentEntry(tagName)

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
) {
  const entry = getMiniprogramComponentEntry(tagName)
  const resolvedMatch = resolveMiniprogramComponentAttribute(tagName, attributeName, currentAttributes)
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
