import miniprogramComponents from './data/miniprogram-components.json'

interface MiniprogramComponentAttributeValue {
  desc?: string[]
  value: string
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

function renderAttributeType(attribute: MiniprogramComponentAttribute) {
  const enumValues = attribute.enum?.map(item => item.value).filter(Boolean) ?? []

  if (enumValues.length > 0) {
    return enumValues.map(value => `\`${value}\``).join(' | ')
  }

  return attribute.type?.name ? `\`${attribute.type.name}\`` : ''
}

export function getMiniprogramComponentNames() {
  return componentEntries.map(entry => entry.name)
}

export function getMiniprogramComponentEntry(tagName: string) {
  return componentsByName.get(tagName) ?? null
}

export function getMiniprogramComponentAttributes(tagName: string) {
  return getMiniprogramComponentEntry(tagName)?.attrs ?? []
}

export function getMiniprogramComponentAttribute(tagName: string, attributeName: string) {
  return getMiniprogramComponentEntry(tagName)?.attrsByName.get(attributeName) ?? null
}

export function getMiniprogramAttributeValues(tagName: string, attributeName: string) {
  return getMiniprogramComponentAttribute(tagName, attributeName)?.enum ?? []
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

export function getMiniprogramAttributeHoverMarkdown(tagName: string, attributeName: string) {
  const entry = getMiniprogramComponentEntry(tagName)
  const attribute = getMiniprogramComponentAttribute(tagName, attributeName)

  if (!entry || !attribute) {
    return null
  }

  const parts = [
    `## \`${entry.name}.${attribute.name}\``,
    renderAttributeType(attribute),
    joinMarkdownLines(attribute.desc),
  ].filter(Boolean)

  if (attribute.defaultValue != null && attribute.defaultValue !== '') {
    parts.push(`默认值：\`${attribute.defaultValue}\``)
  }

  if (attribute.since) {
    parts.push(`最低基础库：\`${attribute.since}\``)
  }

  if (entry.docLink) {
    parts.push(`[官方文档](${entry.docLink})`)
  }

  return parts.join('\n\n')
}
