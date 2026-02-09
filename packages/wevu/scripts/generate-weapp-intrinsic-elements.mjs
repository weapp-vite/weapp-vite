import process from 'node:process'
import { fileURLToPath } from 'node:url'
import fs from 'fs-extra'
import path from 'pathe'

/* eslint-disable no-template-curly-in-string -- 生成的类型定义需要保留模板字符串字面量 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const componentsPath = path.resolve(__dirname, '../components.json')
const outputDir = path.resolve(__dirname, '../src/weappIntrinsicElements')
const elementsDir = path.resolve(outputDir, 'elements')
const baseOutputPath = path.resolve(outputDir, 'base.ts')
const indexOutputPath = path.resolve(__dirname, '../src/weappIntrinsicElements.ts')

const components = await fs.readJson(componentsPath)

const TYPE_ALIASES = new Map([
  ['string', 'string'],
  ['number', 'number'],
  ['boolean', 'boolean'],
  ['any', 'unknown'],
  ['array', 'unknown[]'],
  ['arrayobject', 'Record<string, unknown>[]'],
  ['object', 'Record<string, unknown>'],
  ['null', 'null'],
  ['undefined', 'undefined'],
])

const EVENT_HANDLER_TYPE = 'WeappIntrinsicEventHandler'
const IDENTIFIER_RE = /^[a-z_$][\w$]*$/i

const BASE_ATTRIBUTE_TYPES = {
  id: 'string | number',
  class: 'WeappClassValue',
  style: 'WeappStyleValue',
  hidden: 'boolean',
}

const BASE_ATTRIBUTE_KEYS = new Set(Object.keys(BASE_ATTRIBUTE_TYPES))

function normalizeTypeName(raw) {
  if (!raw || typeof raw !== 'string') {
    return undefined
  }
  const trimmed = raw.trim()
  if (!trimmed) {
    return undefined
  }
  const normalizedRaw = trimmed.replace(/\s*\/\s*/g, ' | ')
  const segments = normalizedRaw.split('|').map(segment => segment.trim()).filter(Boolean)
  if (segments.length === 0) {
    return undefined
  }
  const normalizedSegments = segments
    .map(segment => normalizeTypeSegment(segment))
    .filter(segment => Boolean(segment))
  if (normalizedSegments.length === 0) {
    return undefined
  }
  return normalizedSegments.join(' | ')
}

function normalizeTypeSegment(segment) {
  const lowered = segment.toLowerCase()
  if (TYPE_ALIASES.has(lowered)) {
    return TYPE_ALIASES.get(lowered)
  }
  if (lowered === 'any[]') {
    return 'unknown[]'
  }
  if (/^Record<\s*string\s*,\s*any\s*>$/.test(segment)) {
    return 'Record<string, unknown>'
  }
  return segment.replace(/\bany\[\]/g, 'unknown[]')
}

function escapeSingleQuotes(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')
}

function formatPropertyKey(name) {
  if (IDENTIFIER_RE.test(name)) {
    return name
  }
  return `'${escapeSingleQuotes(name)}'`
}

function formatStringLiteral(value) {
  return `'${escapeSingleQuotes(value)}'`
}

function toPascalCase(value) {
  return value
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((segment) => {
      const lower = segment.toLowerCase()
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join('')
}

function toElementTypeName(componentName) {
  return `WeappIntrinsicElement${toPascalCase(componentName)}`
}

function resolveEnumType(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return undefined
  }
  const literals = []
  for (const entry of values) {
    if (!entry || entry.value === undefined) {
      continue
    }
    const value = entry.value
    if (typeof value === 'string') {
      literals.push(formatStringLiteral(value))
    }
    else if (typeof value === 'number' || typeof value === 'boolean') {
      literals.push(String(value))
    }
  }
  if (literals.length === 0) {
    return undefined
  }
  return Array.from(new Set(literals)).join(' | ')
}

function resolveAttributeType(attr) {
  const rawType = attr?.type
  let typeName
  let returnName
  if (typeof rawType === 'string') {
    typeName = rawType
  }
  else if (rawType && typeof rawType === 'object') {
    typeName = rawType.name
    returnName = rawType.returns?.name
  }
  const lowered = typeof typeName === 'string' ? typeName.trim().toLowerCase() : ''
  if (lowered === 'function' || lowered === 'eventhandle') {
    if (lowered === 'function' && returnName) {
      const returns = normalizeTypeName(returnName) ?? 'unknown'
      return `${EVENT_HANDLER_TYPE}<${returns}>`
    }
    return EVENT_HANDLER_TYPE
  }
  const normalized = normalizeTypeName(typeName)
  return normalized ?? 'unknown'
}

const sortedComponents = Array.isArray(components)
  ? components
      .map((item) => {
        const name = typeof item?.name === 'string' ? item.name.trim() : ''
        return {
          ...item,
          name,
        }
      })
      .filter(item => item.name)
      .sort((a, b) => a.name.localeCompare(b.name))
  : []

function buildElementFile(component) {
  const name = component?.name
  if (!name) {
    return undefined
  }
  const typeName = toElementTypeName(name)
  const attrs = Array.isArray(component.attrs) ? component.attrs : []
  const sortedAttrs = attrs
    .map(attr => ({
      name: typeof attr?.name === 'string' ? attr.name.trim() : '',
      attr,
    }))
    .filter(item => item.name)
    .sort((a, b) => a.name.localeCompare(b.name))
  const propLines = []
  let usesEventHandler = false
  let usesQuotedProps = false
  let usesUnquotedProps = false
  const usedAttrNames = new Set()
  for (const { name: attrName, attr } of sortedAttrs) {
    if (usedAttrNames.has(attrName)) {
      continue
    }
    usedAttrNames.add(attrName)
    if (BASE_ATTRIBUTE_KEYS.has(attrName)) {
      continue
    }
    const enumType = resolveEnumType(attr.enum)
    const type = enumType ?? resolveAttributeType(attr)
    if (type.includes(EVENT_HANDLER_TYPE)) {
      usesEventHandler = true
    }
    const propertyKey = formatPropertyKey(attrName)
    if (propertyKey.startsWith('\'')) {
      usesQuotedProps = true
    }
    else {
      usesUnquotedProps = true
    }
    propLines.push(`  ${propertyKey}?: ${type}`)
  }
  const importNames = ['WeappIntrinsicElementBaseAttributes']
  if (usesEventHandler) {
    importNames.push(EVENT_HANDLER_TYPE)
  }
  const lines = ['// 此文件由 components.json 自动生成，请勿直接修改。']
  if (usesQuotedProps && usesUnquotedProps) {
    lines.push('/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */')
  }
  lines.push(
    '',
    `import type { ${importNames.join(', ')} } from '../base'`,
    '',
    '/**',
    ` * @see ${component.docLink}`,
    ' */',
  )
  if (propLines.length > 0) {
    lines.push(`export type ${typeName} = WeappIntrinsicElementBaseAttributes & {`)
    lines.push(...propLines)
    lines.push('}')
  }
  else {
    lines.push(`export type ${typeName} = WeappIntrinsicElementBaseAttributes`)
  }
  return { fileName: `${name}.ts`, typeName, lines }
}

await fs.remove(outputDir)
await fs.ensureDir(outputDir)
await fs.ensureDir(elementsDir)

const baseLines = [
  '// 此文件由 components.json 自动生成，请勿直接修改。',
  '',
  `export type ${EVENT_HANDLER_TYPE}<TReturn = void> = (...args: unknown[]) => TReturn`,
  '',
  'export type WeappClassValue = string | Record<string, unknown> | WeappClassValue[] | null | undefined | false',
  'export type WeappStyleValue = false | null | undefined | string | WeappCSSProperties | WeappStyleValue[]',
  'export type WeappDatasetValue = unknown',
  '',
  'export interface WeappCSSProperties {',
  '  [key: string]: string | number | undefined',
  '  [v: `--${string}`]: string | number | undefined',
  '}',
  '',
  'export type WeappDatasetAttributes = {',
  '  [key in `data-${string}`]?: WeappDatasetValue',
  '}',
  '',
  'export type WeappIntrinsicElementBaseAttributes = {',
  `  id?: ${BASE_ATTRIBUTE_TYPES.id}`,
  '  class?: WeappClassValue',
  '  style?: WeappStyleValue',
  '  hidden?: boolean',
  '} & WeappDatasetAttributes & Record<string, unknown>',
]

await fs.outputFile(baseOutputPath, `${baseLines.join('\n')}\n`, 'utf8')

const elementFiles = []
for (const component of sortedComponents) {
  const file = buildElementFile(component)
  if (!file) {
    continue
  }
  elementFiles.push(file)
  await fs.outputFile(path.resolve(elementsDir, file.fileName), `${file.lines.join('\n')}\n`, 'utf8')
}

const indexLines = [
  '// 此文件由 components.json 自动生成，请勿直接修改。',
  '/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */',
  '',
  ...elementFiles.map(file => `import type { ${file.typeName} } from './weappIntrinsicElements/elements/${file.fileName.replace(/\.ts$/, '')}'`),
  '',
  'export type { WeappIntrinsicElementBaseAttributes, WeappIntrinsicEventHandler } from \'./weappIntrinsicElements/base\'',
]

if (elementFiles.length === 0) {
  indexLines.push('', 'export interface WeappIntrinsicElements extends Record<string, never> {}')
}
else {
  indexLines.push('', 'export interface WeappIntrinsicElements {')
  for (const file of elementFiles) {
    const tagName = file.fileName.replace(/\.ts$/, '')
    indexLines.push(`  ${formatPropertyKey(tagName)}: ${file.typeName}`)
  }
  indexLines.push('}')
}

await fs.outputFile(indexOutputPath, `${indexLines.join('\n')}\n`, 'utf8')

console.log(`Generated ${path.relative(process.cwd(), indexOutputPath)}`)
console.log(`Generated ${path.relative(process.cwd(), baseOutputPath)}`)
console.log(`Generated ${path.relative(process.cwd(), elementsDir)}`)
