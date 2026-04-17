import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'

/* eslint-disable no-template-curly-in-string -- 生成的类型定义需要保留模板字符串字面量 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const componentsPath = path.resolve(__dirname, '../components.json')
const outputDir = path.resolve(__dirname, '../src/weappIntrinsicElements')
const elementsDir = path.resolve(outputDir, 'elements')
const baseOutputPath = path.resolve(outputDir, 'base.ts')
const indexOutputPath = path.resolve(__dirname, '../src/weappIntrinsicElements.ts')
const GENERATED_FILE_HEADER = '// 此文件由 generate-weapp-intrinsic-elements 基于 components.json 自动生成，请勿直接修改。'

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

const PRIMARY_EVENT_HANDLER_TYPE = 'MiniProgramIntrinsicEventHandler'
const LEGACY_EVENT_HANDLER_TYPE = 'WeappIntrinsicEventHandler'
const IDENTIFIER_RE = /^[a-z_$][\w$]*$/i
const SLASH_SEPARATOR_RE = /\s*\/\s*/g
const RECORD_ANY_RE = /^Record<\s*string\s*,\s*any\s*>$/
const ANY_ARRAY_RE = /\bany\[\]/g
const BACKSLASH_RE = /\\/g
const SINGLE_QUOTE_RE = /'/g
const NON_ALNUM_RE = /[^a-z0-9]+/i
const TS_EXT_RE = /\.ts$/

const BASE_ATTRIBUTE_TYPES = {
  id: 'string | number',
  class: 'MiniProgramClassValue',
  style: 'MiniProgramStyleValue',
  hidden: 'boolean',
}

const BASE_ATTRIBUTE_KEYS = new Set(Object.keys(BASE_ATTRIBUTE_TYPES))
const HTML_ALIAS_TAG_MAPPINGS = [
  ['a', 'navigator'],
  ['article', 'view'],
  ['aside', 'view'],
  ['b', 'text'],
  ['blockquote', 'view'],
  ['code', 'text'],
  ['dd', 'view'],
  ['div', 'view'],
  ['dl', 'view'],
  ['dt', 'view'],
  ['em', 'text'],
  ['figcaption', 'view'],
  ['figure', 'view'],
  ['footer', 'view'],
  ['h1', 'view'],
  ['h2', 'view'],
  ['h3', 'view'],
  ['h4', 'view'],
  ['h5', 'view'],
  ['h6', 'view'],
  ['header', 'view'],
  ['i', 'text'],
  ['img', 'image'],
  ['li', 'view'],
  ['main', 'view'],
  ['nav', 'view'],
  ['ol', 'view'],
  ['p', 'view'],
  ['pre', 'view'],
  ['section', 'view'],
  ['small', 'text'],
  ['span', 'text'],
  ['strong', 'text'],
  ['u', 'text'],
  ['ul', 'view'],
]

function normalizeTypeName(raw) {
  if (!raw || typeof raw !== 'string') {
    return undefined
  }
  const trimmed = raw.trim()
  if (!trimmed) {
    return undefined
  }
  const normalizedRaw = trimmed.replace(SLASH_SEPARATOR_RE, ' | ')
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
  if (RECORD_ANY_RE.test(segment)) {
    return 'Record<string, unknown>'
  }
  return segment.replace(ANY_ARRAY_RE, 'unknown[]')
}

function escapeSingleQuotes(value) {
  return value.replace(BACKSLASH_RE, '\\\\').replace(SINGLE_QUOTE_RE, '\\\'')
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
    .split(NON_ALNUM_RE)
    .filter(Boolean)
    .map((segment) => {
      const lower = segment.toLowerCase()
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join('')
}

function toElementTypeName(componentName) {
  return `MiniProgramIntrinsicElement${toPascalCase(componentName)}`
}

function toLegacyElementTypeName(componentName) {
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
  return [...new Set(literals)].join(' | ')
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
      return `${PRIMARY_EVENT_HANDLER_TYPE}<${returns}>`
    }
    return PRIMARY_EVENT_HANDLER_TYPE
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

const componentTypeNameByTag = new Map(
  sortedComponents.map(component => [component.name, toElementTypeName(component.name)]),
)

function buildElementFile(component) {
  const name = component?.name
  if (!name) {
    return undefined
  }
  const typeName = toElementTypeName(name)
  const legacyTypeName = toLegacyElementTypeName(name)
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
    if (type.includes(PRIMARY_EVENT_HANDLER_TYPE)) {
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
  const importNames = ['MiniProgramIntrinsicElementBaseAttributes']
  if (usesEventHandler) {
    importNames.push(PRIMARY_EVENT_HANDLER_TYPE)
  }
  const lines = [GENERATED_FILE_HEADER]
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
    lines.push(`export type ${typeName} = MiniProgramIntrinsicElementBaseAttributes & {`)
    lines.push(...propLines)
    lines.push('}')
  }
  else {
    lines.push(`export type ${typeName} = MiniProgramIntrinsicElementBaseAttributes`)
  }
  lines.push('', `export type ${legacyTypeName} = ${typeName}`)
  return { fileName: `${name}.ts`, typeName, legacyTypeName, lines }
}

await fs.remove(outputDir)
await fs.ensureDir(outputDir)
await fs.ensureDir(elementsDir)

const baseLines = [
  GENERATED_FILE_HEADER,
  '',
  `export type ${PRIMARY_EVENT_HANDLER_TYPE}<TReturn = void> = (...args: unknown[]) => TReturn`,
  `export type ${LEGACY_EVENT_HANDLER_TYPE}<TReturn = void> = ${PRIMARY_EVENT_HANDLER_TYPE}<TReturn>`,
  '',
  'export type MiniProgramClassValue = string | Record<string, unknown> | MiniProgramClassValue[] | null | undefined | false',
  'export type WeappClassValue = MiniProgramClassValue',
  '',
  'export type MiniProgramStyleValue = false | null | undefined | string | MiniProgramCSSProperties | MiniProgramStyleValue[]',
  'export type WeappStyleValue = MiniProgramStyleValue',
  '',
  'export type MiniProgramDatasetValue = unknown',
  'export type WeappDatasetValue = MiniProgramDatasetValue',
  '',
  'export interface MiniProgramCSSProperties {',
  '  [key: string]: string | number | undefined',
  '  [v: `--${string}`]: string | number | undefined',
  '}',
  'export interface WeappCSSProperties extends MiniProgramCSSProperties {}',
  '',
  'export type MiniProgramDatasetAttributes = {',
  '  [key in `data-${string}`]?: MiniProgramDatasetValue',
  '}',
  'export type WeappDatasetAttributes = MiniProgramDatasetAttributes',
  '',
  'export type MiniProgramIntrinsicElementBaseAttributes = {',
  `  id?: ${BASE_ATTRIBUTE_TYPES.id}`,
  '  class?: MiniProgramClassValue',
  '  style?: MiniProgramStyleValue',
  '  hidden?: boolean',
  '} & MiniProgramDatasetAttributes & Record<string, unknown>',
  'export type WeappIntrinsicElementBaseAttributes = MiniProgramIntrinsicElementBaseAttributes',
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
  GENERATED_FILE_HEADER,
  '/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */',
  '',
  ...elementFiles.map(file => `import type { ${file.typeName} } from './weappIntrinsicElements/elements/${file.fileName.replace(TS_EXT_RE, '')}'`),
  '',
  'export type {',
  '  MiniProgramCSSProperties,',
  '  MiniProgramDatasetAttributes,',
  '  MiniProgramIntrinsicElementBaseAttributes,',
  `  ${PRIMARY_EVENT_HANDLER_TYPE},`,
  '  WeappCSSProperties,',
  '  WeappDatasetAttributes,',
  '  WeappIntrinsicElementBaseAttributes,',
  `  ${LEGACY_EVENT_HANDLER_TYPE},`,
  '} from \'./weappIntrinsicElements/base\'',
]

if (elementFiles.length === 0) {
  indexLines.push('', 'export interface MiniProgramIntrinsicElements extends Record<string, never> {}')
  indexLines.push('export interface WeappIntrinsicElements extends MiniProgramIntrinsicElements {}')
}
else {
  const htmlAliasLines = HTML_ALIAS_TAG_MAPPINGS
    .map(([htmlTag, weappTag]) => {
      const typeName = componentTypeNameByTag.get(weappTag)
      if (!typeName) {
        return undefined
      }
      return `  ${formatPropertyKey(htmlTag)}: ${typeName}`
    })
    .filter(Boolean)

  if (htmlAliasLines.length > 0) {
    indexLines.push('', 'export interface MiniProgramHtmlAliasIntrinsicElements {')
    indexLines.push(...htmlAliasLines)
    indexLines.push('}')
    indexLines.push('export interface WeappHtmlAliasIntrinsicElements extends MiniProgramHtmlAliasIntrinsicElements {}')
  }

  indexLines.push('', 'export interface MiniProgramIntrinsicElements {')
  if (htmlAliasLines.length > 0) {
    indexLines[indexLines.length - 1] = 'export interface MiniProgramIntrinsicElements extends MiniProgramHtmlAliasIntrinsicElements {'
  }
  for (const file of elementFiles) {
    const tagName = file.fileName.replace(TS_EXT_RE, '')
    indexLines.push(`  ${formatPropertyKey(tagName)}: ${file.typeName}`)
  }
  indexLines.push('}')
  indexLines.push('export interface WeappIntrinsicElements extends MiniProgramIntrinsicElements {}')
}

await fs.outputFile(indexOutputPath, `${indexLines.join('\n')}\n`, 'utf8')

console.log(`Generated ${path.relative(process.cwd(), indexOutputPath)}`)
console.log(`Generated ${path.relative(process.cwd(), baseOutputPath)}`)
console.log(`Generated ${path.relative(process.cwd(), elementsDir)}`)
