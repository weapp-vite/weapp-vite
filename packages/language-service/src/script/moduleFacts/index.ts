import type * as t from '@weapp-vite/ast/babelTypes'
import type { ScriptExternalUse, ScriptImportBinding } from '../types'
import type { ModuleOrigin } from './helpers'
import { traverse } from '@weapp-vite/ast'
import { createOriginResolver, memberOrigin, nodeRange, staticName } from './helpers'

type ScriptAst = Parameters<typeof traverse>[0]

/** 在同一解析结果上收集导入绑定和外部符号使用，供编辑器跨文件导航与重命名。 */
export function collectModuleFacts(ast: ScriptAst) {
  const seeds = new WeakMap<t.Identifier, ModuleOrigin>()
  const imports = new Map<number, ScriptImportBinding>()
  const externalUses = new Map<string, ScriptExternalUse>()
  const resolve = createOriginResolver(seeds)
  const addUse = (use: ScriptExternalUse) => externalUses.set(`${use.source}:${use.targetScope}:${use.imported}:${use.kind}:${use.start}:${use.end}`, use)
  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.importKind === 'type') {
        return
      }
      for (const specifier of path.node.specifiers) {
        if (specifier.type === 'ImportSpecifier' && specifier.importKind === 'type') {
          continue
        }
        const kind = specifier.type === 'ImportDefaultSpecifier' ? 'default' : specifier.type === 'ImportNamespaceSpecifier' ? 'namespace' : 'named'
        const imported = specifier.type === 'ImportSpecifier' ? staticName(specifier.imported)! : kind === 'default' ? 'default' : '*'
        const isDefault = imported === 'default'
        const importedRange = specifier.type === 'ImportSpecifier' ? nodeRange(specifier.imported) : undefined
        const rename = specifier.type === 'ImportSpecifier' && !isDefault ? specifier.local.start === specifier.imported.start ? { kind: 'import-shorthand' as const, localName: specifier.local.name } : { kind: 'name' as const } : undefined
        const targetScope = isDefault ? 'default' : 'named'
        const origin: ModuleOrigin = { source: path.node.source.value, imported, kind, targetScope, namespace: isDefault || kind === 'namespace', localName: specifier.local.name, declaration: nodeRange(specifier.local), importedRange, rename }
        seeds.set(specifier.local, origin)
        imports.set(specifier.local.start ?? 0, { source: origin.source, imported, kind, targetScope, localName: specifier.local.name, ...nodeRange(specifier.local), ...(importedRange ? { importedRange } : {}), ...(rename ? { rename } : {}) })
      }
    },
    ExportNamedDeclaration(path) {
      if (!path.node.source || path.node.exportKind === 'type') {
        return
      }
      for (const specifier of path.node.specifiers) {
        if (specifier.type !== 'ExportSpecifier' || specifier.exportKind === 'type') {
          continue
        }
        const imported = staticName(specifier.local)
        if (imported !== undefined) {
          const localName = staticName(specifier.exported)!
          addUse({ source: path.node.source.value, imported, targetScope: imported === 'default' ? 'default' : 'named', localName, kind: 'reexport', ...nodeRange(specifier.local), rename: specifier.local.start === specifier.exported.start ? { kind: 'import-shorthand', localName } : { kind: 'name' } })
        }
      }
    },
  })
  traverse(ast, {
    VariableDeclarator(path) {
      for (const identifier of Object.values(path.getBindingIdentifiers())) {
        const origin = resolve(identifier, path.scope)
        if (origin) {
          imports.set(identifier.start ?? 0, { source: origin.source, imported: origin.imported, targetScope: origin.targetScope, ...(origin.targetPath ? { targetPath: [...origin.targetPath] } : {}), localName: identifier.name, kind: origin.kind, ...nodeRange(identifier), ...(origin.importedRange ? { importedRange: origin.importedRange } : {}), ...(origin.rename ? { rename: origin.rename } : {}) })
        }
      }
    },
    ReferencedIdentifier(path) {
      if (path.findParent(parent => parent.isTSType() || parent.isTSInterfaceDeclaration() || parent.isTSTypeAliasDeclaration())) {
        return
      }
      const origin = resolve(path.node, path.scope)
      if (origin) {
        addUse({ source: origin.source, imported: origin.imported, targetScope: origin.targetScope, ...(origin.targetPath ? { targetPath: [...origin.targetPath] } : {}), kind: 'binding', ...nodeRange(path.node), localName: path.node.name, ...(origin.declaration ? { declaration: origin.declaration } : {}) })
      }
    },
    'MemberExpression|OptionalMemberExpression': function (path) {
      const node = path.node
      if (node.type !== 'MemberExpression' && node.type !== 'OptionalMemberExpression') {
        return
      }
      const origin = resolve(node.object, path.scope)
      const imported = staticName(node.property, node.computed)
      if (origin?.namespace && imported !== undefined) {
        const member = memberOrigin(origin, imported, node.property)
        addUse({ source: origin.source, imported, targetScope: member.targetScope, ...(member.targetPath ? { targetPath: [...member.targetPath] } : {}), kind: 'member', ...nodeRange(node.property), ...(origin.localName ? { localName: origin.localName } : {}), ...(origin.declaration ? { declaration: origin.declaration } : {}), ...(member.rename ? { rename: member.rename } : {}) })
      }
    },
  })
  return { imports: [...imports.values()].sort((left, right) => left.start - right.start), externalUses: [...externalUses.values()].sort((left, right) => left.start - right.start || left.kind.localeCompare(right.kind)) }
}
