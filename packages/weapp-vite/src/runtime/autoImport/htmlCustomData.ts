import type {
  HtmlCustomDataAttribute,
  HtmlCustomDataAttributeValue,
  HtmlCustomDataTag,
  HtmlCustomDataTagReference,
} from './htmlCustomDataTypes'
import type { ComponentMetadata } from './metadata'

export function createHtmlCustomDataDefinition(
  componentNames: string[],
  getMetadata: (name: string) => ComponentMetadata,
  baseTags: HtmlCustomDataTag[] = [],
) {
  const autoImportTags = componentNames.map((name) => {
    const metadata = getMetadata(name)
    const combinedTypes = metadata.types
    const docs = metadata.docs
    const attributeNames = new Set<string>([
      ...combinedTypes.keys(),
      ...docs.keys(),
    ])
    const attributes = Array.from(attributeNames)
      .sort((a, b) => a.localeCompare(b))
      .map((propName) => {
        const type = combinedTypes.get(propName)
        const doc = docs.get(propName)
        const pieces: string[] = []
        if (type) {
          pieces.push(`类型: ${type}`)
        }
        if (doc) {
          pieces.push(doc)
        }
        const entry: HtmlCustomDataAttribute = { name: propName }
        if (pieces.length > 0) {
          entry.description = pieces.join('\n')
        }
        return entry
      })
    const tag: HtmlCustomDataTag = {
      name,
      description: '自动导入的小程序组件',
    }
    if (attributes.length) {
      tag.attributes = attributes
    }
    tag.references = [
      {
        name: 'weapp-vite 自动导入组件',
        url: 'https://vite.icebreaker.top/guide/auto-import-components.html',
      },
    ]
    return tag
  })

  const tags = mergeHtmlCustomDataTags(baseTags, autoImportTags)

  const payload = {
    version: 1.1,
    tags,
  }

  return `${JSON.stringify(payload, null, 2)}\n`
}

function mergeHtmlCustomDataTags(baseTags: HtmlCustomDataTag[], extraTags: HtmlCustomDataTag[]) {
  if (!baseTags.length) {
    return extraTags
  }
  if (!extraTags.length) {
    return baseTags
  }
  const tagMap = new Map<string, HtmlCustomDataTag>()
  for (const tag of baseTags) {
    if (tag?.name) {
      tagMap.set(tag.name, { ...tag })
    }
  }
  for (const tag of extraTags) {
    if (!tag?.name) {
      continue
    }
    const existing = tagMap.get(tag.name)
    if (!existing) {
      tagMap.set(tag.name, { ...tag })
      continue
    }
    const mergedAttributes = mergeHtmlAttributes(existing.attributes, tag.attributes)
    const mergedReferences = mergeReferences(existing.references, tag.references)
    tagMap.set(tag.name, {
      ...existing,
      ...tag,
      description: tag.description ?? existing.description,
      attributes: mergedAttributes,
      references: mergedReferences,
    })
  }
  return Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name))
}

function mergeHtmlAttributes(
  baseAttributes?: HtmlCustomDataAttribute[],
  extraAttributes?: HtmlCustomDataAttribute[],
) {
  if (!baseAttributes?.length) {
    return extraAttributes?.length ? [...extraAttributes] : undefined
  }
  if (!extraAttributes?.length) {
    return [...baseAttributes]
  }
  const attrMap = new Map<string, HtmlCustomDataAttribute>()
  for (const attr of baseAttributes) {
    if (attr?.name) {
      attrMap.set(attr.name, { ...attr })
    }
  }
  for (const attr of extraAttributes) {
    if (!attr?.name) {
      continue
    }
    const existing = attrMap.get(attr.name)
    if (!existing) {
      attrMap.set(attr.name, { ...attr })
      continue
    }
    attrMap.set(attr.name, {
      ...existing,
      ...attr,
      description: attr.description ?? existing.description,
      values: mergeAttributeValues(existing.values, attr.values),
    })
  }
  return Array.from(attrMap.values()).sort((a, b) => a.name.localeCompare(b.name))
}

function mergeAttributeValues(
  baseValues?: HtmlCustomDataAttributeValue[],
  extraValues?: HtmlCustomDataAttributeValue[],
) {
  if (!baseValues?.length) {
    return extraValues?.length ? [...extraValues] : undefined
  }
  if (!extraValues?.length) {
    return [...baseValues]
  }
  const valueMap = new Map<string, HtmlCustomDataAttributeValue>()
  for (const entry of baseValues) {
    if (entry?.name) {
      valueMap.set(entry.name, { ...entry })
    }
  }
  for (const entry of extraValues) {
    if (!entry?.name) {
      continue
    }
    const existing = valueMap.get(entry.name)
    if (!existing) {
      valueMap.set(entry.name, { ...entry })
      continue
    }
    valueMap.set(entry.name, {
      ...existing,
      ...entry,
      description: entry.description ?? existing.description,
    })
  }
  return Array.from(valueMap.values())
}

function mergeReferences(
  base?: HtmlCustomDataTagReference[],
  extra?: HtmlCustomDataTagReference[],
) {
  if (!base?.length) {
    return extra?.length ? [...extra] : undefined
  }
  if (!extra?.length) {
    return [...base]
  }
  const referenceMap = new Map<string, HtmlCustomDataTagReference>()
  for (const entry of base) {
    if (entry?.url) {
      referenceMap.set(entry.url, { ...entry })
    }
  }
  for (const entry of extra) {
    if (!entry?.url) {
      continue
    }
    const existing = referenceMap.get(entry.url)
    if (!existing) {
      referenceMap.set(entry.url, { ...entry })
      continue
    }
    referenceMap.set(entry.url, {
      ...existing,
      ...entry,
      name: entry.name ?? existing.name,
    })
  }
  return Array.from(referenceMap.values())
}
