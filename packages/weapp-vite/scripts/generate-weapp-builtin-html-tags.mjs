import process from 'node:process'
import { fileURLToPath } from 'node:url'
import fs from 'fs-extra'
import path from 'pathe'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const componentsPath = path.resolve(__dirname, '../../wevu/components.json')
const outputPath = path.resolve(__dirname, '../src/runtime/autoImport/weappBuiltinHtmlTagsData.ts')

const components = await fs.readJson(componentsPath)

function joinLines(value) {
  if (!value) {
    return undefined
  }
  const text = Array.isArray(value) ? value.join('\n') : value
  const trimmed = text.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeAttributeType(type) {
  if (!type) {
    return undefined
  }
  if (typeof type === 'string') {
    const trimmed = type.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }
  if (typeof type === 'object') {
    const name = typeof type.name === 'string' ? type.name.trim() : ''
    if (!name) {
      return undefined
    }
    const returns = typeof type.returns?.name === 'string'
      ? type.returns.name.trim()
      : ''
    if (returns) {
      return `${name} => ${returns}`
    }
    return name
  }
  return undefined
}

function normalizeEnumValues(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return undefined
  }
  const normalized = values
    .map((item) => {
      const name = item?.value !== undefined ? String(item.value) : ''
      if (!name) {
        return undefined
      }
      const entry = { name }
      if (item?.desc) {
        const desc = item.desc.trim()
        if (desc) {
          entry.description = desc
        }
      }
      return entry
    })
    .filter(entry => Boolean(entry))

  return normalized.length > 0 ? normalized : undefined
}

function toHtmlAttribute(attr) {
  const name = typeof attr?.name === 'string' ? attr.name.trim() : ''
  if (!name) {
    return undefined
  }
  const pieces = []
  const type = normalizeAttributeType(attr.type)
  if (type) {
    pieces.push(`Type: ${type}`)
  }
  const desc = joinLines(attr.desc)
  if (desc) {
    pieces.push(desc)
  }
  if (attr.defaultValue !== undefined) {
    pieces.push(`Default: ${String(attr.defaultValue)}`)
  }
  if (attr.since) {
    pieces.push(`Since: ${attr.since}`)
  }

  const entry = { name }
  if (pieces.length > 0) {
    entry.description = pieces.join('\n')
  }
  const values = normalizeEnumValues(attr.enum)
  if (values) {
    entry.values = values
  }
  return entry
}

function toHtmlTag(component) {
  const name = typeof component?.name === 'string' ? component.name.trim() : ''
  if (!name) {
    return undefined
  }
  const tag = { name }
  const desc = joinLines(component.desc)
  if (desc) {
    tag.description = desc
  }
  const attributes = component.attrs
    ?.map(toHtmlAttribute)
    .filter(entry => Boolean(entry))
    .sort((a, b) => a.name.localeCompare(b.name))
  if (attributes && attributes.length > 0) {
    tag.attributes = attributes
  }
  if (component.docLink) {
    tag.references = [
      {
        name: 'WeChat Mini Program docs',
        url: component.docLink,
      },
    ]
  }
  return tag
}

const tags = Array.isArray(components)
  ? components
      .map(toHtmlTag)
      .filter(entry => Boolean(entry))
      .sort((a, b) => a.name.localeCompare(b.name))
  : []

const lines = [
  '// This file is auto-generated from components.json. Do not edit directly.',
  '/* eslint-disable style/comma-dangle, style/quote-props, style/quotes */',
  '',
  `export const WEAPP_BUILTIN_HTML_TAGS = ${JSON.stringify(tags, null, 2)}`,
]

await fs.outputFile(outputPath, `${lines.join('\n')}\n`, 'utf8')
console.log(`Generated ${path.relative(process.cwd(), outputPath)}`)
