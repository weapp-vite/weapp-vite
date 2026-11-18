import { Buffer } from 'node:buffer'
import { parse } from '@babel/parser'
import postcss from 'postcss'
import valueParser from 'postcss-value-parser'

export const TYPE_OR_MAP_RE = /(?:\.d\.ts|\.map)$/i

const CODE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.wxs', '.sjs'])
const TEMPLATE_EXTENSIONS = new Set(['.wxml', '.axml', '.swan', '.ttml', '.qml'])
const STYLE_EXTENSIONS = new Set(['.wxss', '.acss', '.ttss', '.qss', '.css'])
const TEMPLATE_REFERENCE_TAGS = new Set(['import', 'include', 'wxs', 'sjs', 'filter', 'render', 'component-placeholder'])
const STATIC_RESOURCE_EXTENSIONS = new Set([
  '.aac',
  '.apng',
  '.avi',
  '.bmp',
  '.flac',
  '.gif',
  '.jpeg',
  '.jpg',
  '.json',
  '.m4a',
  '.m4v',
  '.mov',
  '.mp3',
  '.mp4',
  '.ogg',
  '.pdf',
  '.png',
  '.svg',
  '.ttf',
  '.wav',
  '.webm',
  '.webp',
  '.woff',
  '.woff2',
  '.wxml',
  '.wxss',
])
const RELATIVE_STRING_RE = /["'`]((?:\.{1,2}\/|\/)[^"'`\s]+)["'`]/g

export function textOf(source: string | Uint8Array) {
  return typeof source === 'string' ? source : Buffer.from(source).toString('utf8')
}

function collectCodeReferences(source: string, references: Set<string>) {
  let ast
  try {
    ast = parse(source, { sourceType: 'unambiguous', plugins: ['typescript', 'jsx', 'decorators-legacy'] })
  }
  catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return `无法解析 JavaScript (${detail})`
  }

  const visit = (value: unknown): string | undefined => {
    if (!value || typeof value !== 'object') {
      return
    }
    const node = value as Record<string, unknown>
    if (node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') {
      const sourceNode = node.source as { value?: unknown } | null
      if (typeof sourceNode?.value === 'string') {
        references.add(sourceNode.value)
      }
    }
    else if (node.type === 'ImportExpression') {
      const sourceNode = node.source as { value?: unknown, type?: string } | null
      if (typeof sourceNode?.value === 'string' && sourceNode.type === 'StringLiteral') {
        references.add(sourceNode.value)
      }
      else {
        return '包含无法静态确定的 dynamic import'
      }
    }
    else if (node.type === 'CallExpression') {
      const callee = node.callee as {
        name?: string
        type?: string
        object?: { name?: string, type?: string }
        property?: { name?: string, type?: string, value?: unknown }
      } | null
      const isRequire = callee?.type === 'Identifier' && callee.name === 'require'
      const isModuleRequire = callee?.type === 'MemberExpression'
        && callee.object?.type === 'Identifier'
        && callee.object.name === 'module'
        && (callee.property?.name === 'require' || callee.property?.value === 'require')
      if (isRequire || isModuleRequire) {
        const argument = (node.arguments as Array<{ type?: string, value?: unknown }> | undefined)?.[0]
        if (argument?.type === 'StringLiteral' && typeof argument.value === 'string') {
          references.add(argument.value)
        }
        else {
          return '包含无法静态确定的 require() 引用'
        }
      }
      const isRequireResolve = callee?.type === 'MemberExpression'
        && callee.object?.type === 'Identifier'
        && callee.object.name === 'require'
        && (callee.property?.name === 'resolve' || callee.property?.value === 'resolve')
      if (isRequireResolve) {
        const argument = (node.arguments as Array<{ type?: string, value?: unknown }> | undefined)?.[0]
        if (argument?.type === 'StringLiteral' && typeof argument.value === 'string') {
          references.add(argument.value)
        }
        else {
          return '包含无法静态确定的 require.resolve() 引用'
        }
      }
    }

    for (const child of Object.values(node)) {
      if (Array.isArray(child)) {
        for (const item of child) {
          const reason = visit(item)
          if (reason) {
            return reason
          }
        }
      }
      else {
        const reason = visit(child)
        if (reason) {
          return reason
        }
      }
    }
  }
  return visit(ast)
}

function findTagEnd(source: string, start: number) {
  let quote = ''
  for (let index = start; index < source.length; index += 1) {
    const character = source[index]!
    if (quote) {
      if (character === quote) {
        quote = ''
      }
    }
    else if (character === '"' || character === '\'') {
      quote = character
    }
    else if (character === '>') {
      return index
    }
  }
  return -1
}

function readTagName(source: string, start: number) {
  if (!/[A-Z]/i.test(source[start] ?? '')) {
    return
  }
  let end = start + 1
  while (/[\w:-]/.test(source[end] ?? '')) {
    end += 1
  }
  return { name: source.slice(start, end).toLowerCase(), end }
}

function collectTemplateReferences(source: string, references: Set<string>) {
  let cursor = 0
  while (cursor < source.length) {
    const opening = source.indexOf('<', cursor)
    if (opening < 0) {
      break
    }
    const tagStart = opening + 1
    const isClosingTag = source[tagStart] === '/'
    const nameStart = isClosingTag ? tagStart + 1 : tagStart
    const tag = readTagName(source, nameStart)
    if (!tag) {
      cursor = opening + 1
      continue
    }
    const end = findTagEnd(source, tag.end)
    if (end < 0) {
      if (TEMPLATE_REFERENCE_TAGS.has(tag.name)) {
        return `模板标签 <${tag.name}> 未闭合，无法静态解析 src`
      }
      break
    }
    cursor = end + 1
    if (isClosingTag || !TEMPLATE_REFERENCE_TAGS.has(tag.name)) {
      continue
    }
    const tagSource = source.slice(tag.end, end)
    let attributeCursor = 0
    while (attributeCursor < tagSource.length) {
      while (/\s|\//.test(tagSource[attributeCursor] ?? '')) {
        attributeCursor += 1
      }
      const attributeStart = attributeCursor
      while (attributeCursor < tagSource.length && !/[\s=/>]/.test(tagSource[attributeCursor]!)) {
        attributeCursor += 1
      }
      if (attributeCursor === attributeStart) {
        attributeCursor += 1
        continue
      }
      const attributeName = tagSource.slice(attributeStart, attributeCursor).toLowerCase()
      while (/\s/.test(tagSource[attributeCursor] ?? '')) {
        attributeCursor += 1
      }
      if (tagSource[attributeCursor] !== '=') {
        continue
      }
      attributeCursor += 1
      while (/\s/.test(tagSource[attributeCursor] ?? '')) {
        attributeCursor += 1
      }
      const quote = tagSource[attributeCursor] === '"' || tagSource[attributeCursor] === '\''
        ? tagSource[attributeCursor++]!
        : ''
      const valueStart = attributeCursor
      if (quote) {
        while (attributeCursor < tagSource.length && tagSource[attributeCursor] !== quote) {
          attributeCursor += 1
        }
      }
      else {
        while (attributeCursor < tagSource.length && !/[\s>]/.test(tagSource[attributeCursor]!)) {
          attributeCursor += 1
        }
      }
      const attributeValue = tagSource.slice(valueStart, attributeCursor)
      if (quote) {
        attributeCursor += 1
      }
      if (attributeName !== 'src') {
        continue
      }
      if (/\{\{/.test(attributeValue)) {
        return `模板标签 <${tag.name}> 的 src 是动态表达式`
      }
      references.add(attributeValue)
    }
  }
}

function collectStyleReferences(source: string, fileName: string, references: Set<string>) {
  let root
  try {
    root = postcss.parse(source, { from: fileName })
  }
  catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return `无法解析样式 (${detail})`
  }

  const addUrlReferences = (value: string) => {
    valueParser(value).walk((node) => {
      if (node.type !== 'function' || node.value.toLowerCase() !== 'url') {
        return
      }
      const url = node.nodes?.find(child => child.type === 'string' || child.type === 'word')
      if (url) {
        references.add(url.value)
      }
    })
  }

  root.walkAtRules('import', (rule) => {
    const parsed = valueParser(rule.params)
    const first = parsed.nodes.find(node => node.type === 'string' || node.type === 'word')
    if (first) {
      references.add(first.value)
    }
    else {
      addUrlReferences(rule.params)
    }
  })
  root.walkDecls((declaration) => {
    addUrlReferences(declaration.value)
  })
}

/** 从 npm 文件中提取小程序组件、模块、模板、样式和本地资源引用。 */
export function collectFileReferences(fileName: string, source: string, references: Set<string>): string | undefined {
  const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase()
  if (CODE_EXTENSIONS.has(extension)) {
    const reason = collectCodeReferences(source, references)
    if (reason) {
      return reason
    }
  }
  else if (extension === '.json') {
    let value: unknown
    try {
      value = JSON.parse(source)
    }
    catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      return `无法解析 JSON (${detail})`
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, unknown>
      const usingComponents = record.usingComponents
      if (usingComponents && typeof usingComponents === 'object' && !Array.isArray(usingComponents)) {
        for (const reference of Object.values(usingComponents)) {
          if (typeof reference !== 'string') {
            return 'usingComponents 含有无法静态确定的引用'
          }
          references.add(reference)
        }
      }
      const generics = record.componentGenerics ?? record.generics
      if (generics && typeof generics === 'object' && !Array.isArray(generics)) {
        for (const generic of Object.values(generics)) {
          if (!generic || typeof generic !== 'object' || Array.isArray(generic)) {
            continue
          }
          const defaultComponent = (generic as Record<string, unknown>).default
          if (typeof defaultComponent === 'string') {
            references.add(defaultComponent)
          }
          else if (defaultComponent !== undefined) {
            return 'componentGenerics 含有无法静态确定的引用'
          }
        }
      }
    }
  }
  else if (TEMPLATE_EXTENSIONS.has(extension)) {
    const reason = collectTemplateReferences(source, references)
    if (reason) {
      return reason
    }
  }
  else if (STYLE_EXTENSIONS.has(extension)) {
    const reason = collectStyleReferences(source, fileName, references)
    if (reason) {
      return reason
    }
  }

  for (const match of source.matchAll(RELATIVE_STRING_RE)) {
    const reference = match[1]!
    const value = reference.split(/[?#]/, 1)[0]!
    const extension = value.slice(value.lastIndexOf('.')).toLowerCase()
    if (STATIC_RESOURCE_EXTENSIONS.has(extension)) {
      references.add(reference)
    }
  }
}
