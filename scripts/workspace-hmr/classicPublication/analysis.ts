import traverseModule from '@babel/traverse'
import { Parser } from 'htmlparser2'
import postcss from 'postcss'
import { assertNoStatefulInstallationsAst, parseClassicJavaScript } from '../../../packages/weapp-vite/scripts/consumerHmr/installedRuntime.mjs'
import { inspectClassicEmittedScript } from '../classicRuntimeInspection'

const traverse = (traverseModule as unknown as { default?: typeof traverseModule }).default ?? traverseModule

export interface ClassicPublicationExtensions {
  template: string
  style: string
  module: string
}

type ContentKind = 'script' | 'configuration' | 'template' | 'style'
type TemplateDependency = Readonly<{ target: string, template: boolean }>
export type ClassicContentAnalysis
  = Readonly<{ kind: 'script', dependencies: readonly string[] }>
    | Readonly<{ kind: 'configuration', dependencies: readonly string[] }>
    | Readonly<{ kind: 'template', dependencies: readonly TemplateDependency[] }>
    | Readonly<{ kind: 'style', dependencies: readonly string[] }>

export function classicContentKind(file: string, extensions: ClassicPublicationExtensions): ContentKind | undefined {
  if (file.endsWith('.js') || file.endsWith(extensions.module)) {
    return 'script'
  }
  if (file.endsWith('.json') && !file.endsWith('.map.json')) {
    return 'configuration'
  }
  if (file.endsWith(extensions.template)) {
    return 'template'
  }
  if (file.endsWith(extensions.style)) {
    return 'style'
  }
}

/** 缓存只保存与内容有关的不可变摘要，文件存在性及依赖解析必须每轮重新检查。 */
export function analyzeClassicContent(kind: ContentKind, file: string, source: string): ClassicContentAnalysis {
  if (kind === 'script') {
    const ast = parseClassicJavaScript(file, source)
    assertNoStatefulInstallationsAst(file, ast)
    inspectClassicEmittedScript(ast)
    if (/^\/\/ weapp-vite-stateful-build:/m.test(source)) {
      throw new Error(`Classic publication retained a stateful client: ${file}`)
    }
    const dependencies: string[] = []
    traverse(ast, {
      CallExpression(nodePath) {
        const { callee, arguments: args } = nodePath.node
        if (callee.type === 'Identifier' && callee.name === 'require' && !nodePath.scope.hasBinding('require') && args[0]?.type === 'StringLiteral') {
          dependencies.push(args[0].value)
        }
        if (callee.type === 'Import' && args[0]?.type === 'StringLiteral') {
          dependencies.push(args[0].value)
        }
      },
      ImportExpression(nodePath) {
        if (nodePath.node.source.type !== 'StringLiteral') {
          throw new Error(`Classic publication has an unsupported dynamic import: ${file}`)
        }
        dependencies.push(nodePath.node.source.value)
      },
      ImportDeclaration(nodePath) { dependencies.push(nodePath.node.source.value) },
      ExportNamedDeclaration(nodePath) {
        if (nodePath.node.source) {
          dependencies.push(nodePath.node.source.value)
        }
      },
      ExportAllDeclaration(nodePath) { dependencies.push(nodePath.node.source.value) },
    })
    return Object.freeze({ kind, dependencies: Object.freeze(dependencies) })
  }
  if (kind === 'configuration') {
    const config = JSON.parse(source) as unknown
    let dependencies: string[] = []
    if (config && typeof config === 'object' && !Array.isArray(config) && 'usingComponents' in config) {
      const components = config.usingComponents
      if (!components || typeof components !== 'object' || Array.isArray(components)) {
        throw new Error('Classic publication contains a non-object mini-program configuration.')
      }
      const targets = Object.values(components)
      if (targets.some(target => typeof target !== 'string')) {
        throw new TypeError(`Classic publication has an invalid component path: ${file}`)
      }
      dependencies = targets as string[]
    }
    return Object.freeze({ kind, dependencies: Object.freeze(dependencies) })
  }
  if (kind === 'template') {
    const dependencies: TemplateDependency[] = []
    const parser = new Parser({
      onopentag(name, attributes) {
        const target = attributes.src ?? (name === 'import-sjs' ? attributes.from : undefined)
        if (['import', 'include', 'wxs', 'sjs', 'import-sjs'].includes(name) && target) {
          dependencies.push(Object.freeze({ target, template: ['import', 'include'].includes(name) }))
        }
      },
    }, { xmlMode: true })
    parser.end(source)
    return Object.freeze({ kind, dependencies: Object.freeze(dependencies) })
  }
  const dependencies: string[] = []
  postcss.parse(source).walkAtRules('import', (rule) => {
    const match = rule.params.trim().match(/^(?:"([^"\\]*)"|'([^'\\]*)'|url\(\s*(?:"([^"\\]*)"|'([^'\\]*)'|([^'"\s()\\]+))\s*\))(?:\s+\S.*)?$/i)
    const target = match?.slice(1).find(value => value !== undefined)
    if (!target) {
      throw new Error(`Classic publication has an unsupported stylesheet import: ${file}`)
    }
    if (!/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target)) {
      dependencies.push(target)
    }
  })
  return Object.freeze({ kind, dependencies: Object.freeze(dependencies) })
}
