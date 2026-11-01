import type { Scope } from '@weapp-vite/ast/babelTraverse'
import type * as t from '@weapp-vite/ast/babelTypes'
import type { SourceRange } from '../../types'
import type { ScriptExportScope, ScriptImportBinding, ScriptImportRename } from '../types'

export interface ModuleOrigin {
  source: string
  imported: string
  namespace: boolean
  kind: ScriptImportBinding['kind']
  targetScope: ScriptExportScope
  targetPath?: string[]
  localName?: string
  declaration?: SourceRange
  importedRange?: SourceRange
  rename?: ScriptImportRename
}

export function nodeRange(node: t.Node): SourceRange {
  const quoted = node.type === 'StringLiteral' || node.type === 'TemplateLiteral'
  return { start: (node.start ?? 0) + (quoted ? 1 : 0), end: (node.end ?? 0) - (quoted ? 1 : 0) }
}

export function staticName(node: t.Node | null | undefined, computed = false): string | undefined {
  if (node?.type === 'Identifier' && !computed) {
    return node.name
  }
  if (node?.type === 'StringLiteral') {
    return node.value
  }
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis.map(part => part.value.cooked ?? part.value.raw).join('')
  }
  return undefined
}

type Binding = NonNullable<ReturnType<Scope['getBinding']>>

export function memberOrigin(origin: ModuleOrigin, imported: string, property: t.Node): ModuleOrigin {
  const isDefault = origin.targetScope === 'named' && imported === 'default'
  const commonjs = origin.targetScope === 'commonjs'
  return {
    ...origin,
    imported,
    namespace: isDefault || commonjs,
    targetScope: isDefault ? 'default' : origin.targetScope === 'default' ? 'default-member' : origin.targetScope,
    importedRange: nodeRange(property),
    ...(commonjs ? { targetPath: [...origin.targetPath ?? [], imported] } : {}),
    rename: isDefault ? undefined : { kind: 'name' },
  }
}

/** 仅追踪未重赋值的静态绑定；不把动态数据流或局部同名变量当成外部模块。 */
export function createOriginResolver(seeds: WeakMap<t.Identifier, ModuleOrigin>) {
  function resolve(node: t.Node | null | undefined, scope: Scope, visited = new Set<Binding>()): ModuleOrigin | undefined {
    if (!node) {
      return
    }
    if (node.type === 'TSAsExpression' || node.type === 'TSTypeAssertion' || node.type === 'TSNonNullExpression' || node.type === 'ParenthesizedExpression') {
      return resolve(node.expression, scope, visited)
    }
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'require' && !scope.getBinding('require')) {
      const argument = node.arguments[0]
      const source = argument?.type === 'StringLiteral' || argument?.type === 'TemplateLiteral' ? staticName(argument, true) : undefined
      return source === undefined ? undefined : { source, imported: '*', namespace: true, kind: 'require', targetScope: 'commonjs', targetPath: [] }
    }
    if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') {
      const origin = resolve(node.object, scope, visited)
      const imported = staticName(node.property, node.computed)
      return origin?.namespace && imported !== undefined ? memberOrigin(origin, imported, node.property) : undefined
    }
    if (node.type !== 'Identifier') {
      return
    }
    const binding = scope.getBinding(node.name)
    if (!binding || visited.has(binding) || binding.constantViolations.length) {
      return
    }
    visited.add(binding)
    const seeded = seeds.get(binding.identifier)
    if (seeded) {
      return { ...seeded, localName: node.name, declaration: nodeRange(binding.identifier) }
    }
    const declaration = binding.path.node
    if (declaration.type !== 'VariableDeclarator' || !declaration.init) {
      return
    }
    const origin = resolve(declaration.init, binding.path.scope, visited)
    if (!origin) {
      return
    }
    if (declaration.id.type === 'Identifier') {
      const member = declaration.init.type === 'MemberExpression' || declaration.init.type === 'OptionalMemberExpression'
      return { ...origin, localName: node.name, declaration: nodeRange(binding.identifier), importedRange: member ? origin.importedRange : undefined, rename: member ? origin.rename : undefined }
    }
    if (declaration.id.type !== 'ObjectPattern' || !origin.namespace) {
      return
    }
    for (const property of declaration.id.properties) {
      if (property.type !== 'ObjectProperty') {
        continue
      }
      const local = property.value.type === 'AssignmentPattern' ? property.value.left : property.value
      if (local.type !== 'Identifier' || local.start !== binding.identifier.start) {
        continue
      }
      const imported = staticName(property.key, property.computed)
      if (imported !== undefined) {
        const member = memberOrigin(origin, imported, property.key)
        return { ...member, localName: local.name, declaration: nodeRange(local), rename: member.targetScope === 'default' ? undefined : property.shorthand ? { kind: 'property-shorthand', localName: local.name } : { kind: 'name' } }
      }
    }
  }
  return resolve
}
