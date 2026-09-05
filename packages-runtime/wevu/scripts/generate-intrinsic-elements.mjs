import { access, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import path from 'pathe'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(__dirname, '..')
const CHECK_MODE = process.argv.includes('--check')

async function pathExists(file) {
  try {
    await access(file)
    return true
  }
  catch {
    return false
  }
}

async function outputFile(file, content) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, content, 'utf8')
}

const TAG_NAME_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const ATTRIBUTE_NAME_RE = /^[A-Z][\w.*:-]*$/i
const JSX_ATTRIBUTE_NAME_RE = /^[A-Z][\w:-]*$/i
const SOURCE_EVENT_NAME_RE = /^(?:on|catch|captureBind|captureCatch|mutBind)[A-Z]\w*$/
const UNSUPPORTED_JSX_HOST_ATTRIBUTE_PREFIXES = ['worklet:']
const IDENTIFIER_RE = /^[A-Z_$][\w$]*$/i
const NON_ALNUM_RE = /[^A-Z0-9]+/i
const TS_EXT_RE = /\.ts$/
const BASE_ATTRIBUTE_KEYS = {
  'class': true,
  'className': true,
  'data-*': true,
  'hidden': true,
  'id': true,
  'style': true,
}
const GENERATED_FILE_HEADER = '// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。'
const COMPILER_EVENT_ALIASES_OUTPUT = '../wevu-compiler/src/plugins/vue/compiler/template/platforms/generatedEventAliases.ts'
const PLATFORM_CONFIGS = [
  {
    id: 'weapp',
    typePrefix: 'Weapp',
    catalogPath: path.resolve(packageRoot, 'components.weapp.json'),
  },
  {
    id: 'alipay',
    typePrefix: 'Alipay',
    catalogPath: path.resolve(packageRoot, 'components.alipay.json'),
  },
  {
    id: 'tt',
    typePrefix: 'Tt',
    catalogPath: path.resolve(packageRoot, 'components.tt.json'),
  },
]
const TYPE_ALIAS_BY_NAME = {
  'any': 'unknown',
  'any[]': 'unknown[]',
  'array': 'unknown[]',
  'arrayobject': 'Record<string, unknown>[]',
  'boolean': 'boolean',
  'boolean[]': 'boolean[]',
  'null': 'null',
  'number': 'number',
  'number[]': 'number[]',
  'object': 'Record<string, unknown>',
  'record<string, any>': 'Record<string, unknown>',
  'string': 'string',
  'string[]': 'string[]',
  'undefined': 'undefined',
  'unknown': 'unknown',
}
const EVENT_TYPE_NAMES = {
  eventhandle: true,
  eventhandler: true,
  function: true,
}
const EVENT_PREFIXES = [
  ['capture-bind', 'captureBind'],
  ['capture-catch', 'captureCatch'],
  ['capture-on', 'captureBind'],
  ['mut-bind', 'mutBind'],
  ['bind', 'on'],
  ['catch', 'catch'],
]

function fail(message) {
  throw new Error(`Intrinsic catalog validation failed: ${message}`)
}

function compareText(left, right) {
  if (left === right) {
    return 0
  }
  return left < right ? -1 : 1
}

function escapeSingleQuotes(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')
}

function formatPropertyKey(name) {
  return IDENTIFIER_RE.test(name) ? name : `'${escapeSingleQuotes(name)}'`
}

function formatLiteral(value) {
  if (typeof value === 'string') {
    return `'${escapeSingleQuotes(value)}'`
  }
  return String(value)
}

function toPascalCase(value) {
  return value
    .split(NON_ALNUM_RE)
    .filter(Boolean)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('')
}

function toElementTypeName(typePrefix, componentName) {
  return `${typePrefix}IntrinsicElement${toPascalCase(componentName)}`
}

function scoreSourceEventName(name) {
  return [...name].filter(character => /[A-Z]/.test(character)).length
}

function collectPreferredSourceEventNames(rawCatalogs) {
  const preferredNames = new Map()
  for (const catalog of rawCatalogs) {
    if (!Array.isArray(catalog)) {
      continue
    }
    for (const component of catalog) {
      const attrs = Array.isArray(component?.attrs) ? component.attrs : []
      for (const attr of attrs) {
        for (const candidate of [attr?.jsxName, attr?.name]) {
          if (typeof candidate !== 'string' || !SOURCE_EVENT_NAME_RE.test(candidate)) {
            continue
          }
          const key = candidate.toLowerCase()
          const existing = preferredNames.get(key)
          if (!existing || scoreSourceEventName(candidate) > scoreSourceEventName(existing)) {
            preferredNames.set(key, candidate)
          }
        }
      }
    }
  }
  return preferredNames
}

function canonicalizeEventName(rawName, preferredSourceEventNames) {
  if (/^(?:on|catch|captureBind|captureCatch|mutBind)[A-Z]/.test(rawName)) {
    return preferredSourceEventNames.get(rawName.toLowerCase()) ?? rawName
  }
  for (const [hostPrefix, sourcePrefix] of EVENT_PREFIXES) {
    const prefixPattern = new RegExp(`^${hostPrefix.replace('-', '\\-')}:?(.+)$`, 'i')
    const match = prefixPattern.exec(rawName)
    if (match) {
      const fallbackName = `${sourcePrefix}${toPascalCase(match[1])}`
      return preferredSourceEventNames.get(fallbackName.toLowerCase()) ?? fallbackName
    }
  }
  const fallbackName = `on${toPascalCase(rawName)}`
  return preferredSourceEventNames.get(fallbackName.toLowerCase()) ?? fallbackName
}

function collectCompilerEventAliases(rawCatalog, platform, preferredSourceEventNames) {
  const aliasesByComponent = new Map()
  for (const [componentIndex, component] of rawCatalog.entries()) {
    const attrs = Array.isArray(component?.attrs) ? component.attrs : []
    const aliases = new Map()
    for (const [attrIndex, attr] of attrs.entries()) {
      const location = `${platform.id}[${componentIndex}].attrs[${attrIndex}]`
      const normalized = normalizeAttribute(attr, location, preferredSourceEventNames)
      if (normalized.type.kind !== 'event' || !/^on[A-Z]/.test(normalized.name)) {
        continue
      }
      const sourceName = `${normalized.name.charAt(2).toLowerCase()}${normalized.name.slice(3)}`
      if (!aliases.has(sourceName)) {
        aliases.set(sourceName, normalized.rawName)
      }
    }
    if (aliases.size > 0) {
      aliasesByComponent.set(
        component.name,
        [...aliases.entries()].sort(([left], [right]) => compareText(left, right)),
      )
    }
  }
  return [...aliasesByComponent.entries()].sort(([left], [right]) => compareText(left, right))
}

function renderCompilerEventAliases(rawCatalogs, preferredSourceEventNames) {
  const lines = [
    `${GENERATED_FILE_HEADER} 来源：${PLATFORM_CONFIGS.map(platform => `components.${platform.id}.json`).join('、')}。`,
    '/* eslint-disable style/quote-props -- 生成的组件名需要保留宿主拼写。 */',
    '',
  ]
  for (const [index, platform] of PLATFORM_CONFIGS.entries()) {
    const exportName = `${platform.id.toUpperCase()}_JSX_EVENT_NAME_ALIASES`
    const componentAliases = collectCompilerEventAliases(rawCatalogs[index], platform, preferredSourceEventNames)
    const type = 'Readonly<Record<string, Readonly<Record<string, string>>>>'
    if (componentAliases.length === 0) {
      lines.push(`export const ${exportName}: ${type} = {}`, '')
      continue
    }
    lines.push(`export const ${exportName}: ${type} = {`)
    for (const [componentName, aliases] of componentAliases) {
      lines.push(`  ${formatPropertyKey(componentName)}: {`)
      for (const [sourceName, hostName] of aliases) {
        lines.push(`    ${formatPropertyKey(sourceName)}: '${escapeSingleQuotes(hostName)}',`)
      }
      lines.push('  },')
    }
    lines.push('}', '')
  }
  return lines.join('\n')
}

function readRawTypeName(attr) {
  if (typeof attr.type === 'string') {
    return attr.type
  }
  if (attr.type && typeof attr.type === 'object' && typeof attr.type.name === 'string') {
    return attr.type.name
  }
  return 'unknown'
}

function normalizeTypeSegment(segment, location) {
  const normalized = segment.trim()
  const lowered = normalized.toLowerCase()
  if (Object.hasOwn(TYPE_ALIAS_BY_NAME, lowered)) {
    return TYPE_ALIAS_BY_NAME[lowered]
  }
  fail(`${location} uses unsupported type ${JSON.stringify(normalized)}`)
}

function normalizeUnionType(rawType, location) {
  const normalizedRaw = rawType.trim().replace(/\s*\/\s*/g, ' | ')
  const segments = normalizedRaw
    .split('|')
    .map(segment => normalizeTypeSegment(segment, location))
  return [...new Set(segments)].sort()
}

function normalizeEnum(attr, location) {
  if (attr.enum === undefined) {
    return undefined
  }
  if (!Array.isArray(attr.enum) || attr.enum.length === 0) {
    fail(`${location}.enum must be a non-empty array`)
  }
  const values = []
  const seen = new Set()
  for (const [index, entry] of attr.enum.entries()) {
    const value = entry?.value
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      fail(`${location}.enum[${index}].value must be a string, number, or boolean`)
    }
    const key = `${typeof value}:${String(value)}`
    if (seen.has(key)) {
      fail(`${location}.enum contains duplicate value ${JSON.stringify(value)}`)
    }
    seen.add(key)
    values.push(value)
  }
  return values.sort((a, b) => compareText(String(a), String(b)))
}

function normalizeAttribute(attr, location, preferredSourceEventNames) {
  if (!attr || typeof attr !== 'object') {
    fail(`${location} must be an object`)
  }
  const rawName = typeof attr.name === 'string' ? attr.name.trim() : ''
  if (!ATTRIBUTE_NAME_RE.test(rawName)) {
    fail(`${location}.name is invalid: ${JSON.stringify(rawName)}`)
  }
  const rawType = readRawTypeName(attr).trim()
  const loweredType = rawType.toLowerCase()
  const isHostEvent = EVENT_PREFIXES.some(([prefix]) => new RegExp(`^${prefix.replace('-', '\\-')}:?`, 'i').test(rawName))
  const isEvent = isHostEvent || Object.hasOwn(EVENT_TYPE_NAMES, loweredType)
  const explicitJsxName = attr.jsxName
  if (explicitJsxName !== undefined && (typeof explicitJsxName !== 'string' || !JSX_ATTRIBUTE_NAME_RE.test(explicitJsxName))) {
    fail(`${location}.jsxName is invalid: ${JSON.stringify(explicitJsxName)}`)
  }
  if (explicitJsxName !== undefined && (!isEvent || !SOURCE_EVENT_NAME_RE.test(explicitJsxName))) {
    fail(`${location}.jsxName must be a compiler-source event name`)
  }
  const name = explicitJsxName ?? (isEvent ? canonicalizeEventName(rawName, preferredSourceEventNames) : rawName)
  const enumValues = normalizeEnum(attr, location)
  if (isEvent && enumValues) {
    fail(`${location} cannot be both an event and an enum`)
  }
  if (isEvent) {
    return { name, rawName, type: { kind: 'event' } }
  }
  if (enumValues) {
    return { name, rawName, type: { kind: 'enum', values: enumValues } }
  }
  return {
    name,
    rawName,
    type: {
      kind: 'union',
      segments: normalizeUnionType(rawType, location),
    },
  }
}

function typeSignature(type) {
  if (type.kind === 'event') {
    return 'event'
  }
  if (type.kind === 'enum') {
    return `enum:${type.values.map(value => `${typeof value}:${String(value)}`).join(',')}`
  }
  return `union:${type.segments.join(',')}`
}

function validateDocLink(value, location) {
  if (typeof value !== 'string' || !value) {
    fail(`${location}.docLink must be a non-empty URL`)
  }
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      fail(`${location}.docLink must use http or https`)
    }
  }
  catch {
    fail(`${location}.docLink is invalid: ${JSON.stringify(value)}`)
  }
}

function normalizeCatalog(rawCatalog, platform, preferredSourceEventNames) {
  if (!Array.isArray(rawCatalog) || rawCatalog.length === 0) {
    fail(`${platform.id} catalog must be a non-empty array`)
  }
  const tagNames = new Set()
  const components = rawCatalog.map((component, componentIndex) => {
    const location = `${platform.id}[${componentIndex}]`
    if (!component || typeof component !== 'object') {
      fail(`${location} must be an object`)
    }
    const name = typeof component.name === 'string' ? component.name.trim() : ''
    if (!TAG_NAME_RE.test(name)) {
      fail(`${location}.name is invalid: ${JSON.stringify(name)}`)
    }
    if (tagNames.has(name)) {
      fail(`${platform.id} contains duplicate tag ${name}`)
    }
    tagNames.add(name)
    validateDocLink(component.docLink, location)
    const rawAttrs = component.attrs ?? []
    if (!Array.isArray(rawAttrs)) {
      fail(`${location}.attrs must be an array when present`)
    }
    const rawNames = new Set()
    const canonicalAttrs = new Map()
    for (const [attrIndex, rawAttr] of rawAttrs.entries()) {
      const attrLocation = `${location}.attrs[${attrIndex}]`
      const attr = normalizeAttribute(rawAttr, attrLocation, preferredSourceEventNames)
      if (rawNames.has(attr.rawName)) {
        fail(`${location} contains duplicate attribute ${attr.rawName}`)
      }
      rawNames.add(attr.rawName)
      if (UNSUPPORTED_JSX_HOST_ATTRIBUTE_PREFIXES.some(prefix => attr.rawName.startsWith(prefix))) {
        continue
      }
      if (Object.hasOwn(BASE_ATTRIBUTE_KEYS, attr.name)) {
        continue
      }
      const existing = canonicalAttrs.get(attr.name)
      if (existing) {
        if (typeSignature(existing.type) !== typeSignature(attr.type)) {
          fail(`${location} maps incompatible host attributes to ${attr.name}`)
        }
        continue
      }
      canonicalAttrs.set(attr.name, attr)
    }
    return {
      name,
      docLinks: [component.docLink],
      attrs: canonicalAttrs,
    }
  })
  return components.sort((a, b) => compareText(a.name, b.name))
}

function intersectType(types) {
  if (types.every(type => type.kind === 'event')) {
    return { kind: 'event' }
  }
  const enumTypes = types.filter(type => type.kind === 'enum')
  const unionTypes = types.filter(type => type.kind === 'union')
  if (enumTypes.length > 0 && enumTypes.length + unionTypes.length === types.length) {
    const [first, ...rest] = enumTypes
    const commonKeys = new Set(first.values.map(value => `${typeof value}:${String(value)}`))
    for (const type of rest) {
      const keys = new Set(type.values.map(value => `${typeof value}:${String(value)}`))
      for (const key of commonKeys) {
        if (!keys.has(key)) {
          commonKeys.delete(key)
        }
      }
    }
    const values = first.values.filter((value) => {
      if (!commonKeys.has(`${typeof value}:${String(value)}`)) {
        return false
      }
      return unionTypes.every(type => (
        type.segments.includes('unknown')
        || type.segments.includes(typeof value)
      ))
    })
    return values.length > 0 ? { kind: 'enum', values } : undefined
  }
  if (types.every(type => type.kind === 'union')) {
    const [first, ...rest] = types
    const segments = first.segments.filter(segment => rest.every(type => type.segments.includes(segment)))
    if (segments.length === 0 || segments.includes('unknown')) {
      return undefined
    }
    return { kind: 'union', segments }
  }
  return undefined
}

function deriveCommonCatalog(catalogs) {
  const catalogMaps = catalogs.map(catalog => new Map(catalog.map(component => [component.name, component])))
  const commonNames = catalogs[0]
    .map(component => component.name)
    .filter(name => catalogMaps.slice(1).every(catalog => catalog.has(name)))
    .sort(compareText)
  return commonNames.map((name) => {
    const components = catalogMaps.map(catalog => catalog.get(name))
    const attrs = new Map()
    for (const [attrName] of components[0].attrs) {
      const platformAttrs = components.map(component => component.attrs.get(attrName))
      if (platformAttrs.some(attr => !attr)) {
        continue
      }
      const type = intersectType(platformAttrs.map(attr => attr.type))
      if (type) {
        attrs.set(attrName, { name: attrName, rawName: attrName, type })
      }
    }
    return {
      name,
      docLinks: components.flatMap(component => component.docLinks),
      attrs,
    }
  })
}

function renderType(type) {
  if (type.kind === 'event') {
    return 'WevuJsxEventHandler'
  }
  if (type.kind === 'enum') {
    return type.values.map(formatLiteral).join(' | ')
  }
  return type.segments.join(' | ')
}

function renderElementFile(component, typePrefix, catalogNames) {
  const typeName = toElementTypeName(typePrefix, component.name)
  const baseTypeName = `${typePrefix}IntrinsicElementBaseAttributes`
  const attrs = [...component.attrs.values()].sort((a, b) => compareText(a.name, b.name))
  const usesEventHandler = attrs.some(attr => attr.type.kind === 'event')
  const usesQuotedProps = attrs.some(attr => !IDENTIFIER_RE.test(attr.name))
  const usesUnquotedProps = attrs.some(attr => IDENTIFIER_RE.test(attr.name))
  const lines = [
    `${GENERATED_FILE_HEADER} 来源：${catalogNames.join('、')}。`,
  ]
  if (usesQuotedProps && usesUnquotedProps) {
    lines.push('/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */')
  }
  lines.push('')
  if (usesEventHandler) {
    lines.push('import type { WevuJsxEventHandler } from \'../../jsx-runtime\'')
  }
  lines.push(`import type { ${baseTypeName} } from '../base'`, '', '/**')
  for (const docLink of component.docLinks) {
    lines.push(` * @see ${docLink}`)
  }
  lines.push(' */')
  if (attrs.length === 0) {
    lines.push(`export type ${typeName} = ${baseTypeName}`)
  }
  else {
    lines.push(`export type ${typeName} = ${baseTypeName} & {`)
    for (const attr of attrs) {
      lines.push(`  ${formatPropertyKey(attr.name)}?: ${renderType(attr.type)}`)
    }
    lines.push('}')
  }
  return {
    content: `${lines.join('\n')}\n`,
    fileName: `${component.name}.ts`,
    typeName,
  }
}

function renderCatalog(catalog, platform) {
  const output = new Map()
  const catalogNames = platform.catalogNames
  const outputDirectoryName = `${platform.id}IntrinsicElements`
  const baseTypeName = `${platform.typePrefix}IntrinsicElementBaseAttributes`
  const baseLines = [
    `${GENERATED_FILE_HEADER} 来源：${catalogNames.join('、')}。`,
    '',
    'import type { WevuJsxHostAttributes } from \'../jsx-runtime\'',
    '',
    `export type ${baseTypeName} = WevuJsxHostAttributes`,
    '',
  ]
  output.set(`src/${outputDirectoryName}/base.ts`, baseLines.join('\n'))
  const elementFiles = catalog.map(component => renderElementFile(component, platform.typePrefix, catalogNames))
  for (const file of elementFiles) {
    output.set(`src/${outputDirectoryName}/elements/${file.fileName}`, file.content)
  }
  const indexLines = [
    `${GENERATED_FILE_HEADER} 来源：${catalogNames.join('、')}。`,
    '/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */',
    '',
    ...elementFiles.map(file => `import type { ${file.typeName} } from './${outputDirectoryName}/elements/${file.fileName.replace(TS_EXT_RE, '')}'`),
    '',
    `export type { ${baseTypeName} } from './${outputDirectoryName}/base'`,
    '',
    `export interface ${platform.typePrefix}IntrinsicElements {`,
    ...elementFiles.map(file => `  ${formatPropertyKey(file.fileName.replace(TS_EXT_RE, ''))}: ${file.typeName}`),
    '}',
    '',
  ]
  output.set(`src/${outputDirectoryName}.ts`, indexLines.join('\n'))
  return output
}

async function collectFiles(directory) {
  if (!await pathExists(directory)) {
    return []
  }
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const entryPath = path.resolve(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectFiles(entryPath))
    }
    else {
      files.push(entryPath)
    }
  }
  return files
}

async function checkOutputs(expectedOutput, outputDirectories) {
  const drift = []
  for (const [relativePath, expectedContent] of expectedOutput) {
    const outputPath = path.resolve(packageRoot, relativePath)
    if (!await pathExists(outputPath)) {
      drift.push(`${relativePath} is missing`)
      continue
    }
    const actualContent = await readFile(outputPath, 'utf8')
    if (actualContent !== expectedContent) {
      drift.push(`${relativePath} differs`)
    }
  }
  const expectedPaths = new Set([...expectedOutput.keys()].map(relativePath => path.resolve(packageRoot, relativePath)))
  for (const directory of outputDirectories) {
    for (const filePath of await collectFiles(directory)) {
      if (!expectedPaths.has(filePath)) {
        drift.push(`${path.relative(packageRoot, filePath)} is stale`)
      }
    }
  }
  if (drift.length > 0) {
    throw new Error(`Generated intrinsic declarations are out of date:\n${drift.map(item => `- ${item}`).join('\n')}`)
  }
  console.log(`Checked ${expectedOutput.size} generated intrinsic declaration files.`)
}

async function writeOutputs(expectedOutput, outputDirectories) {
  for (const directory of outputDirectories) {
    await rm(directory, { recursive: true, force: true })
  }
  for (const [relativePath, content] of expectedOutput) {
    await outputFile(path.resolve(packageRoot, relativePath), content)
  }
  console.log(`Generated ${expectedOutput.size} intrinsic declaration files.`)
}

const rawCatalogs = await Promise.all(PLATFORM_CONFIGS.map(async platform =>
  JSON.parse(await readFile(platform.catalogPath, 'utf8')),
))
const preferredSourceEventNames = collectPreferredSourceEventNames(rawCatalogs)
const catalogs = rawCatalogs.map((catalog, index) => normalizeCatalog(catalog, PLATFORM_CONFIGS[index], preferredSourceEventNames))
const commonCatalog = deriveCommonCatalog(catalogs)
const renderConfigs = [
  ...PLATFORM_CONFIGS.map((platform, index) => ({
    ...platform,
    catalog: catalogs[index],
    catalogNames: [`components.${platform.id}.json`],
  })),
  {
    id: 'miniprogram',
    typePrefix: 'MiniProgram',
    catalog: commonCatalog,
    catalogNames: PLATFORM_CONFIGS.map(platform => `components.${platform.id}.json`),
  },
]
const expectedOutput = new Map()
for (const platform of renderConfigs) {
  for (const [relativePath, content] of renderCatalog(platform.catalog, platform)) {
    expectedOutput.set(relativePath, content)
  }
}
expectedOutput.set(COMPILER_EVENT_ALIASES_OUTPUT, renderCompilerEventAliases(rawCatalogs, preferredSourceEventNames))
const outputDirectories = renderConfigs.map(platform => path.resolve(packageRoot, `src/${platform.id}IntrinsicElements`))
if (CHECK_MODE) {
  await checkOutputs(expectedOutput, outputDirectories)
}
else {
  await writeOutputs(expectedOutput, outputDirectories)
  console.log(`Derived ${commonCatalog.length} common intrinsic elements from ${PLATFORM_CONFIGS.length} platform catalogs.`)
}
