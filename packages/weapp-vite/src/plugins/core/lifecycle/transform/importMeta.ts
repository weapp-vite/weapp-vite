import * as t from '@babel/types'
import MagicString from 'magic-string'
import { parse as parseSfc } from 'vue/compiler-sfc'
import { generate, parseJsLike, traverse } from '../../../../utils/babel'
import { createStaticImportMetaValues } from '../../../../utils/importMeta'

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

export function replaceImportMetaAccess(code: string, options: {
  defineImportMetaEnv?: Record<string, any>
  extension: string
  relativePath: string
}) {
  if (!code.includes('import.meta')) {
    return code
  }

  const values = createStaticImportMetaValues(options)
  const ast = parseJsLike(code)
  let mutated = false
  const importMetaObjectNode = t.objectExpression([
    t.objectProperty(t.identifier('filename'), t.stringLiteral(values.filename)),
    t.objectProperty(t.identifier('url'), t.stringLiteral(values.url)),
    t.objectProperty(t.identifier('dirname'), t.stringLiteral(values.dirname)),
    t.objectProperty(t.identifier('env'), t.valueToNode(values.env)),
  ])

  traverse(ast as any, {
    MemberExpression(path: any) {
      const envPropertyName = getImportMetaEnvPropertyName(path.node)
      if (envPropertyName) {
        const envValue = Object.hasOwn(values.envAccess, envPropertyName)
          ? values.envAccess[envPropertyName]
          : undefined
        path.replaceWith(t.valueToNode(envValue))
        mutated = true
        return
      }

      if (isImportMetaMemberAccess(path.node, 'env')) {
        path.replaceWith(t.valueToNode(values.env))
        mutated = true
        return
      }

      if (isImportMetaMemberAccess(path.node, 'url')) {
        path.replaceWith(t.stringLiteral(values.url))
        mutated = true
        return
      }

      if (isImportMetaMemberAccess(path.node, 'filename')) {
        path.replaceWith(t.stringLiteral(values.filename))
        mutated = true
        return
      }

      if (isImportMetaMemberAccess(path.node, 'dirname')) {
        path.replaceWith(t.stringLiteral(values.dirname))
        mutated = true
      }
    },
    OptionalMemberExpression(path: any) {
      const envPropertyName = getImportMetaEnvPropertyName(path.node)
      if (envPropertyName) {
        const envValue = Object.hasOwn(values.envAccess, envPropertyName)
          ? values.envAccess[envPropertyName]
          : undefined
        path.replaceWith(t.valueToNode(envValue))
        mutated = true
        return
      }

      if (isImportMetaMemberAccess(path.node, 'env')) {
        path.replaceWith(t.valueToNode(values.env))
        mutated = true
        return
      }

      if (isImportMetaMemberAccess(path.node, 'url')) {
        path.replaceWith(t.stringLiteral(values.url))
        mutated = true
        return
      }

      if (isImportMetaMemberAccess(path.node, 'filename')) {
        path.replaceWith(t.stringLiteral(values.filename))
        mutated = true
        return
      }

      if (isImportMetaMemberAccess(path.node, 'dirname')) {
        path.replaceWith(t.stringLiteral(values.dirname))
        mutated = true
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

      path.replaceWith(t.cloneNode(importMetaObjectNode, true))
      mutated = true
    },
  })

  if (!mutated) {
    return code
  }

  return generate(ast as any).code
}

export function replaceImportMetaAccessInSfc(source: string, options: {
  defineImportMetaEnv?: Record<string, any>
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
