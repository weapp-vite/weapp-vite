import type { WevuPageHookName } from '../types'
import type { ModuleAnalysis } from './types'
import { parseJsLikeWithEngine } from '@weapp-vite/ast'
import path from 'pathe'
import { WE_VU_MODULE_ID, WE_VU_PAGE_HOOK_TO_FEATURE } from '../../../../constants'
import { getImportedSpecifierName, isOxcFunctionLike } from './shared'

function resolveOxcParseFilename(id: string) {
  const extension = path.extname(id)
  if (extension) {
    return id
  }
  return `${id}.js`
}

export function createModuleAnalysisWithOxc(id: string, code: string): ModuleAnalysis {
  const ast = parseJsLikeWithEngine(code, {
    engine: 'oxc',
    filename: resolveOxcParseFilename(id),
  }) as any
  const localFunctions = new Map()
  const exports = new Map()
  const importedBindings = new Map()
  const wevuNamedHookLocals = new Map()
  const wevuNamespaceLocals = new Set<string>()

  function registerFunctionDeclaration(node: any) {
    if (node?.id?.type === 'Identifier') {
      localFunctions.set(node.id.name, node)
    }
  }

  function registerVariableFunction(node: any) {
    if (node?.id?.type !== 'Identifier' || !isOxcFunctionLike(node.init)) {
      return
    }
    localFunctions.set(node.id.name, node.init)
  }

  for (const stmt of ast.body ?? []) {
    if (stmt?.type === 'FunctionDeclaration') {
      registerFunctionDeclaration(stmt)
      continue
    }

    if (stmt?.type === 'VariableDeclaration') {
      for (const decl of stmt.declarations ?? []) {
        registerVariableFunction(decl)
      }
      continue
    }

    if (stmt?.type === 'ImportDeclaration') {
      const source = getImportedSpecifierName(stmt.source)
      if (!source) {
        continue
      }
      for (const specifier of stmt.specifiers ?? []) {
        if (specifier.type === 'ImportSpecifier' && specifier.local?.type === 'Identifier') {
          const importedName = getImportedSpecifierName(specifier.imported)
          if (!importedName) {
            continue
          }
          if (source === WE_VU_MODULE_ID) {
            const matched = WE_VU_PAGE_HOOK_TO_FEATURE[importedName as WevuPageHookName]
            if (matched) {
              wevuNamedHookLocals.set(specifier.local.name, matched)
            }
          }
          importedBindings.set(specifier.local.name, {
            kind: 'named',
            source,
            importedName,
          })
        }
        else if (specifier.type === 'ImportDefaultSpecifier' && specifier.local?.type === 'Identifier') {
          importedBindings.set(specifier.local.name, { kind: 'default', source })
        }
        else if (specifier.type === 'ImportNamespaceSpecifier' && specifier.local?.type === 'Identifier') {
          importedBindings.set(specifier.local.name, { kind: 'namespace', source })
          if (source === WE_VU_MODULE_ID) {
            wevuNamespaceLocals.add(specifier.local.name)
          }
        }
      }
      continue
    }

    if (stmt?.type === 'ExportNamedDeclaration') {
      if (stmt.declaration?.type === 'FunctionDeclaration') {
        registerFunctionDeclaration(stmt.declaration)
        if (stmt.declaration.id?.type === 'Identifier') {
          exports.set(stmt.declaration.id.name, { type: 'local', localName: stmt.declaration.id.name })
        }
        continue
      }

      if (stmt.declaration?.type === 'VariableDeclaration') {
        for (const decl of stmt.declaration.declarations ?? []) {
          registerVariableFunction(decl)
          if (decl.id?.type === 'Identifier') {
            exports.set(decl.id.name, { type: 'local', localName: decl.id.name })
          }
        }
        continue
      }

      const source = getImportedSpecifierName(stmt.source)
      for (const spec of stmt.specifiers ?? []) {
        if (spec?.type !== 'ExportSpecifier') {
          continue
        }
        const exportedName = getImportedSpecifierName(spec.exported)
        const localName = getImportedSpecifierName(spec.local)
        if (!exportedName || !localName) {
          continue
        }
        if (source) {
          exports.set(exportedName, { type: 'reexport', source, importedName: localName })
        }
        else {
          exports.set(exportedName, { type: 'local', localName })
        }
      }
      continue
    }

    if (stmt?.type === 'ExportDefaultDeclaration') {
      const decl = stmt.declaration
      if (decl?.type === 'FunctionDeclaration') {
        registerFunctionDeclaration(decl)
        if (decl.id?.type === 'Identifier') {
          exports.set('default', { type: 'local', localName: decl.id.name })
        }
        else {
          exports.set('default', { type: 'inline', node: decl })
        }
      }
      else if (decl?.type === 'Identifier') {
        exports.set('default', { type: 'local', localName: decl.name })
      }
      else if (isOxcFunctionLike(decl)) {
        exports.set('default', { type: 'inline', node: decl })
      }
    }
  }

  return {
    id,
    engine: 'oxc',
    wevuNamedHookLocals,
    wevuNamespaceLocals,
    importedBindings,
    localFunctions,
    exports,
  }
}
