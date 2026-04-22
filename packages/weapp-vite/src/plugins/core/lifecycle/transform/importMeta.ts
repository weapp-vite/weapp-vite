import type { ImportMetaDefineRegistry } from '../../../../utils/importMeta'
import { WEAPP_VITE_IMPORT_META_ENV_KEY } from '@weapp-core/constants'
import MagicString from 'magic-string'
import { parse as parseSfc } from 'vue/compiler-sfc'
import { parseJsLike, traverse } from '../../../../utils/babel'
import { createStaticImportMetaValues, resolveImportMetaEnvExpression } from '../../../../utils/importMeta'

function isImportMetaNode(node: any) {
  return node?.type === 'MetaProperty'
    && node.meta?.type === 'Identifier'
    && node.meta.name === 'import'
    && node.property?.type === 'Identifier'
    && node.property.name === 'meta'
}

function isImportMetaMemberAccess(node: any, propertyName: string) {
  if (!node || (node.type !== 'MemberExpression' && node.type !== 'OptionalMemberExpression')) {
    return false
  }

  if (!isImportMetaNode(node.object)) {
    return false
  }

  if (!node.computed) {
    return node.property?.type === 'Identifier' && node.property.name === propertyName
  }

  return node.property?.type === 'StringLiteral' && node.property.value === propertyName
}

function getImportMetaEnvPropertyName(node: any) {
  if (!node || (node.type !== 'MemberExpression' && node.type !== 'OptionalMemberExpression')) {
    return undefined
  }
  if (!isImportMetaMemberAccess(node.object, 'env')) {
    return undefined
  }

  if (!node.computed && node.property?.type === 'Identifier') {
    return node.property.name
  }
  if (node.property?.type === 'StringLiteral') {
    return node.property.value
  }
  return undefined
}

function wrapInlineExpression(expression: string) {
  const trimmed = expression.trim()
  return trimmed.startsWith('{') ? `(${trimmed})` : trimmed
}

function createSerializedEnvExpression(envObject: Record<string, any>) {
  return `JSON.parse(${JSON.stringify(JSON.stringify(envObject))})`
}

function createCachedImportMetaEnvExpression(rawExpression: string, envObject: Record<string, any>) {
  const trimmed = rawExpression.trim()
  const runtimeExpression = trimmed.startsWith('{') || trimmed.startsWith('JSON.parse(')
    ? createSerializedEnvExpression(envObject)
    : wrapInlineExpression(trimmed)
  const globalRef = `globalThis[${JSON.stringify(WEAPP_VITE_IMPORT_META_ENV_KEY)}]`
  return `(${globalRef}||(${globalRef}=${runtimeExpression}))`
}

function toInlineLiteral(value: any) {
  if (value === undefined) {
    return 'undefined'
  }
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
    || Array.isArray(value)
    || typeof value === 'object'
  ) {
    return JSON.stringify(value)
  }

  return 'undefined'
}

function createImportMetaObjectExpression(values: ReturnType<typeof createStaticImportMetaValues>, envExpression: string) {
  return `({"filename":${JSON.stringify(values.filename)},"url":${JSON.stringify(values.url)},"dirname":${JSON.stringify(values.dirname)},"env":${wrapInlineExpression(envExpression)}})`
}

function resolveNodeRange(node: any) {
  return typeof node?.start === 'number' && typeof node?.end === 'number'
    ? { start: node.start, end: node.end }
    : undefined
}

function intersectsReplacement(
  replacements: Array<{ start: number, end: number, value: string }>,
  start: number,
  end: number,
) {
  return replacements.some(replacement => !(end <= replacement.start || start >= replacement.end))
}

export function replaceImportMetaAccess(code: string, options: {
  importMetaDefineRegistry?: ImportMetaDefineRegistry
  extension: string
  relativePath: string
}) {
  if (!code.includes('import.meta')) {
    return code
  }

  const values = createStaticImportMetaValues(options)
  const envExpression = createCachedImportMetaEnvExpression(
    resolveImportMetaEnvExpression(options.importMetaDefineRegistry?.defineEntries, values.env),
    values.env,
  )
  const importMetaObjectExpression = createImportMetaObjectExpression(values, envExpression)
  const ast = parseJsLike(code)
  const replacements: Array<{ start: number, end: number, value: string }> = []

  function addReplacement(node: any, value: string) {
    const range = resolveNodeRange(node)
    if (!range || intersectsReplacement(replacements, range.start, range.end)) {
      return
    }
    replacements.push({
      start: range.start,
      end: range.end,
      value,
    })
  }

  traverse(ast as any, {
    MemberExpression(path: any) {
      const envPropertyName = getImportMetaEnvPropertyName(path.node)
      if (envPropertyName) {
        const envValue = Object.hasOwn(values.envAccess, envPropertyName)
          ? values.envAccess[envPropertyName]
          : undefined
        addReplacement(path.node, toInlineLiteral(envValue))
        return
      }

      if (isImportMetaMemberAccess(path.node, 'env')) {
        addReplacement(path.node, wrapInlineExpression(envExpression))
        return
      }

      if (isImportMetaMemberAccess(path.node, 'url')) {
        addReplacement(path.node, JSON.stringify(values.url))
        return
      }

      if (isImportMetaMemberAccess(path.node, 'filename')) {
        addReplacement(path.node, JSON.stringify(values.filename))
        return
      }

      if (isImportMetaMemberAccess(path.node, 'dirname')) {
        addReplacement(path.node, JSON.stringify(values.dirname))
      }
    },
    OptionalMemberExpression(path: any) {
      const envPropertyName = getImportMetaEnvPropertyName(path.node)
      if (envPropertyName) {
        const envValue = Object.hasOwn(values.envAccess, envPropertyName)
          ? values.envAccess[envPropertyName]
          : undefined
        addReplacement(path.node, toInlineLiteral(envValue))
        return
      }

      if (isImportMetaMemberAccess(path.node, 'env')) {
        addReplacement(path.node, wrapInlineExpression(envExpression))
        return
      }

      if (isImportMetaMemberAccess(path.node, 'url')) {
        addReplacement(path.node, JSON.stringify(values.url))
        return
      }

      if (isImportMetaMemberAccess(path.node, 'filename')) {
        addReplacement(path.node, JSON.stringify(values.filename))
        return
      }

      if (isImportMetaMemberAccess(path.node, 'dirname')) {
        addReplacement(path.node, JSON.stringify(values.dirname))
      }
    },
    MetaProperty(path: any) {
      const parent = path.parent
      if (
        (parent?.type === 'MemberExpression' || parent?.type === 'OptionalMemberExpression')
        && parent.object === path.node
      ) {
        return
      }
      if (!isImportMetaNode(path.node)) {
        return
      }

      addReplacement(path.node, importMetaObjectExpression)
    },
  })

  if (replacements.length === 0) {
    return code
  }

  const ms = new MagicString(code)
  for (const replacement of replacements.sort((left, right) => left.start - right.start)) {
    ms.update(replacement.start, replacement.end, replacement.value)
  }

  return ms.toString()
}

export function replaceImportMetaAccessInSfc(source: string, options: {
  importMetaDefineRegistry?: ImportMetaDefineRegistry
  extension: string
  relativePath: string
}) {
  if (!source.includes('import.meta')) {
    return source
  }

  const { descriptor, errors } = parseSfc(source, {
    filename: 'import-meta.vue',
    ignoreEmpty: false,
  })

  if (errors.length > 0) {
    return source
  }

  const blocks = [descriptor.script, descriptor.scriptSetup].filter((block): block is NonNullable<typeof descriptor.script> => {
    return Boolean(block && !block.src)
  })
  if (blocks.length === 0) {
    return source
  }

  const ms = new MagicString(source)
  let mutated = false
  for (const block of blocks) {
    const nextContent = replaceImportMetaAccess(block.content, options)
    if (nextContent === block.content) {
      continue
    }
    ms.update(block.loc.start.offset, block.loc.end.offset, nextContent)
    mutated = true
  }

  return mutated ? ms.toString() : source
}
