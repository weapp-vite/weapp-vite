import type { MutableCompilerContext } from '../../context'
import { WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE } from '@weapp-core/constants'
import MagicString from 'magic-string'
import path from 'pathe'
import { matchesSubPackageDependency, toRelativeRuntimeNpmImport } from '../../plugins/core/lifecycle/emit/rewrite'
import { parseJsLike, traverse } from '../../utils/babel'
import { resolveNpmBuildCandidateDependencyRecordSync } from '../npmPlugin/service'

export interface StatefulHmrPatchImports {
  filename: string
  resolveImport: (specifier: string, importers: string[]) => string
}

/** 将 DevEngine 的外置模块导入转换为宿主 require，保持首包相同的 namespace/default 互操作。 */
export function transformStatefulHmrPatchImports(code: string, options: StatefulHmrPatchImports): string {
  const ast = parseJsLike(code)
  const transformed = new MagicString(code)
  const ownersByBinding = new Map<string, string[]>()
  traverse(ast, {
    ImportDeclaration(importPath) {
      for (const binding of importPath.node.specifiers) {
        const owners = new Set<string>()
        const references = importPath.scope.getBinding(binding.local.name)?.referencePaths ?? []
        for (const reference of references) {
          const factory = reference.findParent((candidate) => {
            if (!candidate.isCallExpression()) {
              return false
            }
            const callee = candidate.node.callee
            return callee.type === 'MemberExpression'
              && callee.object.type === 'Identifier' && callee.object.name === '__rolldown_runtime__'
              && callee.property.type === 'Identifier' && callee.property.name === 'registerFactory'
          })
          if (!factory?.isCallExpression() || factory.node.arguments[0]?.type !== 'StringLiteral') {
            owners.add('')
            continue
          }
          owners.add(factory.node.arguments[0].value)
        }
        ownersByBinding.set(binding.local.name, [...owners])
      }
    },
  })
  for (const statement of ast.program.body) {
    if (statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportDefaultDeclaration' || statement.type === 'ExportAllDeclaration') {
      throw new Error(`Stateful HMR patch must register exports through the runtime: ${options.filename}`)
    }
    if (statement.type !== 'ImportDeclaration') {
      continue
    }
    const [binding] = statement.specifiers
    if (statement.specifiers.length > 1 || (binding && binding.type !== 'ImportNamespaceSpecifier')) {
      throw new Error(`Unsupported Stateful HMR external import in ${options.filename}`)
    }
    const specifier = options.resolveImport(statement.source.value, binding ? ownersByBinding.get(binding.local.name) ?? [] : [])
    const requireExpression = `require(${JSON.stringify(specifier)})`
    const replacement = binding
      ? `const ${binding.local.name} = __rolldown_runtime__.__toESM(${requireExpression});`
      : `${requireExpression};`
    transformed.update(statement.start!, statement.end!, replacement)
  }
  return transformed.toString()
}

/** 从实际引用 external 的 factory 模块和 npm 策略确定宿主路径，不以触发失效的文件代替导入方。 */
export function createStatefulHmrPatchImportResolver(
  ctx: MutableCompilerContext,
  filename: string,
): StatefulHmrPatchImports['resolveImport'] {
  const config = ctx.configService!
  const dependencies = resolveNpmBuildCandidateDependencyRecordSync(ctx, config.packageJson)
  const localPackages = [...ctx.scanService?.subPackageMap.values() ?? []]
    .map(meta => meta.subPackage)
    .filter(meta => Array.isArray(meta.dependencies) && meta.dependencies.length > 0)
    .sort((a, b) => b.root.length - a.root.length)

  return (specifier, importers) => {
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
      const target = specifier.startsWith('/')
        ? specifier.slice(1)
        : path.join(path.dirname(filename), specifier)
      const relative = path.relative(path.dirname(WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE), target)
      return relative.startsWith('.') ? relative : `./${relative}`
    }
    if ((!importers.length || importers.includes('')) && localPackages.some(meta => matchesSubPackageDependency(meta.dependencies, specifier))) {
      throw new Error(`Stateful HMR external import has no unambiguous factory owner: ${specifier}`)
    }
    const sourcePackages = new Set(importers.map((file) => {
      const source = path.resolve(config.cwd, file.split('?', 1)[0])
      const relative = path.relative(config.absoluteSrcRoot, source)
      return localPackages.find(meta => relative.startsWith(`${meta.root}/`))
    }))
    const roots = new Set([...sourcePackages].map((meta) => {
      return meta && matchesSubPackageDependency(meta.dependencies, specifier)
        ? meta.root
        : ''
    }))
    if (roots.size > 1) {
      throw new Error(`Stateful HMR external import spans different npm roots: ${specifier}`)
    }
    const root = [...roots][0] ?? ''
    if (root || matchesSubPackageDependency(undefined, specifier, dependencies)) {
      return toRelativeRuntimeNpmImport(WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE, root, specifier, config.cwd)
    }
    return specifier
  }
}
