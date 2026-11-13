import type { OutputBundle, OutputChunk } from 'rolldown'
import type { SubpackageNamingContext } from './ownership'
import path from 'pathe'
import postcss from 'postcss'
import valueParser from 'postcss-value-parser'

interface AssetConsumerChunk extends OutputChunk {
  referencedFiles?: string[]
}

function outputPackage(fileName: string, context: SubpackageNamingContext) {
  return Array.from(context.roots(), root => root.replaceAll('\\', '/').replace(/\/+$/, ''))
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
    .find(root => fileName.startsWith(`${root}/`)) ?? ''
}

function assertReferenceAccess(consumer: string, target: string, context: SubpackageNamingContext) {
  const destination = outputPackage(target, context)
  const owner = outputPackage(consumer, context)
  if ((destination && destination !== owner)
    || (context.independentRoot && destination !== context.independentRoot)) {
    throw new Error(`[weapp-vite] [subpackage] 跨分包资源 "${target}" 无法由 "${consumer}" 访问；请为共享资源设置不含占位符的主包 assetFileNames，独立分包资源必须保留在包内。`)
  }
}

function resolveStyleReference(value: string, consumer: string, base: string) {
  if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/|[?#])/i.test(value)) {
    return
  }
  try {
    const file = decodeURIComponent(value.split(/[?#]/, 1)[0]!)
    if (file.startsWith('/')) {
      return file.startsWith(base) ? file.slice(base.length) : file.slice(1)
    }
    return path.normalize(path.join(path.dirname(consumer), file))
  }
  catch {
    return undefined
  }
}

/** 使用最终消费者及资源路径验证可见性，来源目录不能替代引用关系。 */
export function assertBundleAssetAccess(bundle: OutputBundle, context: SubpackageNamingContext, base: string) {
  const assets = new Set(Object.values(bundle).filter(item => item.type === 'asset').map(item => item.fileName))
  const assertTarget = (consumer: string, target: string) => {
    if (assets.has(target)) {
      assertReferenceAccess(consumer, target, context)
    }
  }
  for (const item of Object.values(bundle)) {
    if (item.type === 'chunk') {
      const chunk = item as AssetConsumerChunk
      const pending = [chunk]
      const visited = new Set<string>()
      while (pending.length) {
        const dependency = pending.pop()!
        if (visited.has(dependency.fileName)) {
          continue
        }
        visited.add(dependency.fileName)
        for (const target of [...dependency.referencedFiles ?? [], ...dependency.viteMetadata?.importedAssets ?? []]) {
          assertTarget(chunk.fileName, target)
        }
        // 同步共享 chunk 的资产也由其静态引用方消费；动态导航不提前消费目标分包。
        for (const imported of dependency.imports) {
          const output = bundle[imported]
          if (output?.type === 'chunk') {
            pending.push(output as AssetConsumerChunk)
          }
        }
      }
      continue
    }
    if (!/\.(?:css|wxss|acss|ttss|qss|jxss)$/.test(item.fileName)) {
      continue
    }
    const checkValue = (value: string) => {
      const target = resolveStyleReference(value, item.fileName, base)
      if (target) {
        assertTarget(item.fileName, target)
      }
    }
    const css = postcss.parse(item.source.toString(), { from: item.fileName })
    const checkExpression = (value: string) => {
      valueParser(value).walk((node) => {
        if (node.type !== 'function') {
          return
        }
        if (node.value.toLowerCase() === 'url') {
          for (const argument of node.nodes) {
            if (argument.type === 'word' || argument.type === 'string') {
              checkValue(argument.value)
            }
          }
          return false
        }
        if (/^(?:-webkit-)?image-set$/i.test(node.value)) {
          for (const argument of node.nodes) {
            if (argument.type === 'string') {
              checkValue(argument.value)
            }
          }
        }
      })
    }
    css.walkDecls(declaration => checkExpression(declaration.value))
    css.walkAtRules((rule) => {
      checkExpression(rule.params)
      if (rule.name.toLowerCase() === 'import') {
        const first = valueParser(rule.params).nodes[0]
        if (first?.type === 'string') {
          checkValue(first.value)
        }
      }
    })
  }
}
