import type { AstEngineName } from '../../../ast/types'
import type { WevuPageFeatureFlag, WevuPageHookName } from './types'
import * as t from '@weapp-vite/ast/babelTypes'
import { LRUCache } from 'lru-cache'
import { WE_VU_MODULE_ID, WE_VU_PAGE_HOOK_TO_FEATURE } from '../../../constants'
import { parseJsLike } from '../../../utils/babel'

export type FunctionLike
  = | t.FunctionDeclaration
    | t.FunctionExpression
    | t.ArrowFunctionExpression
    | t.ObjectMethod

type ExportTarget
  = | { type: 'local', localName: string }
    | { type: 'reexport', source: string, importedName: string }
    | { type: 'inline', node: FunctionLike }

type ImportBinding
  = | { kind: 'named', source: string, importedName: string }
    | { kind: 'default', source: string }
    | { kind: 'namespace', source: string }

export interface ModuleAnalysis {
  id: string
  ast: t.File
  wevuNamedHookLocals: Map<string, WevuPageFeatureFlag>
  wevuNamespaceLocals: Set<string>
  importedBindings: Map<string, ImportBinding>
  localFunctions: Map<string, FunctionLike>
  exports: Map<string, ExportTarget>
}

const externalModuleAnalysisCache = new LRUCache<
  string,
  { code: string, analysis: ModuleAnalysis }
>({
  max: 256,
})

function createExternalModuleAnalysisCacheKey(moduleId: string, astEngine?: AstEngineName) {
  return `${astEngine ?? 'babel'}::${moduleId}`
}

function getFunctionLikeFromExpression(node: t.Expression | null | undefined): FunctionLike | null {
  if (!node) {
    return null
  }
  if (t.isFunctionExpression(node) || t.isArrowFunctionExpression(node)) {
    return node
  }
  return null
}

export function createModuleAnalysis(id: string, ast: t.File): ModuleAnalysis {
  const localFunctions = new Map<string, FunctionLike>()
  const exports = new Map<string, ExportTarget>()
  const importedBindings = new Map<string, ImportBinding>()
  const wevuNamedHookLocals = new Map<string, WevuPageFeatureFlag>()
  const wevuNamespaceLocals = new Set<string>()

  function registerFunctionDeclaration(node: t.FunctionDeclaration) {
    if (!node.id || !node.id.name) {
      return
    }
    localFunctions.set(node.id.name, node)
  }

  function registerVariableFunction(node: t.VariableDeclarator) {
    if (!t.isIdentifier(node.id)) {
      return
    }
    const fn = getFunctionLikeFromExpression(node.init as any)
    if (!fn) {
      return
    }
    localFunctions.set(node.id.name, fn)
  }

  for (const stmt of ast.program.body) {
    if (t.isFunctionDeclaration(stmt)) {
      registerFunctionDeclaration(stmt)
      continue
    }
    if (t.isVariableDeclaration(stmt)) {
      for (const decl of stmt.declarations) {
        registerVariableFunction(decl)
      }
      continue
    }
    if (t.isImportDeclaration(stmt)) {
      const source = stmt.source.value
      for (const specifier of stmt.specifiers) {
        if (t.isImportSpecifier(specifier)) {
          const imported = specifier.imported
          if (source === WE_VU_MODULE_ID && t.isIdentifier(imported)) {
            const importedName = imported.name as WevuPageHookName
            const matched = WE_VU_PAGE_HOOK_TO_FEATURE[importedName]
            if (matched) {
              wevuNamedHookLocals.set(specifier.local.name, matched)
            }
          }
          importedBindings.set(specifier.local.name, {
            kind: 'named',
            source,
            importedName: t.isIdentifier(imported) ? imported.name : String((imported as any).value),
          })
        }
        else if (t.isImportDefaultSpecifier(specifier)) {
          importedBindings.set(specifier.local.name, { kind: 'default', source })
        }
        else if (t.isImportNamespaceSpecifier(specifier)) {
          importedBindings.set(specifier.local.name, { kind: 'namespace', source })
          if (source === WE_VU_MODULE_ID) {
            wevuNamespaceLocals.add(specifier.local.name)
          }
        }
      }
      continue
    }
    if (t.isExportNamedDeclaration(stmt)) {
      if (stmt.declaration) {
        if (t.isFunctionDeclaration(stmt.declaration) && stmt.declaration.id) {
          registerFunctionDeclaration(stmt.declaration)
          exports.set(stmt.declaration.id.name, { type: 'local', localName: stmt.declaration.id.name })
        }
        else if (t.isVariableDeclaration(stmt.declaration)) {
          for (const decl of stmt.declaration.declarations) {
            registerVariableFunction(decl)
            if (t.isIdentifier(decl.id)) {
              exports.set(decl.id.name, { type: 'local', localName: decl.id.name })
            }
          }
        }
        continue
      }

      if (stmt.source) {
        const source = stmt.source.value
        for (const spec of stmt.specifiers) {
          if (!t.isExportSpecifier(spec)) {
            continue
          }
          const exportedName = t.isIdentifier(spec.exported) ? spec.exported.name : undefined
          const importedName = t.isIdentifier(spec.local) ? spec.local.name : undefined
          if (!exportedName || !importedName) {
            continue
          }
          exports.set(exportedName, { type: 'reexport', source, importedName })
        }
      }
      else {
        for (const spec of stmt.specifiers) {
          if (!t.isExportSpecifier(spec)) {
            continue
          }
          const exportedName = t.isIdentifier(spec.exported) ? spec.exported.name : undefined
          const localName = t.isIdentifier(spec.local) ? spec.local.name : undefined
          if (!exportedName || !localName) {
            continue
          }
          exports.set(exportedName, { type: 'local', localName })
        }
      }
      continue
    }
    if (t.isExportDefaultDeclaration(stmt)) {
      const decl = stmt.declaration
      if (t.isFunctionDeclaration(decl)) {
        registerFunctionDeclaration(decl)
        if (decl.id) {
          exports.set('default', { type: 'local', localName: decl.id.name })
        }
        else {
          exports.set('default', { type: 'inline', node: decl })
        }
      }
      else if (t.isIdentifier(decl)) {
        exports.set('default', { type: 'local', localName: decl.name })
      }
      else {
        const fn = getFunctionLikeFromExpression(decl as any)
        if (fn) {
          exports.set('default', { type: 'inline', node: fn })
        }
      }
    }
  }

  return {
    id,
    ast,
    wevuNamedHookLocals,
    wevuNamespaceLocals,
    importedBindings,
    localFunctions,
    exports,
  }
}

export function createModuleAnalysisFromCode(
  id: string,
  code: string,
  _options?: {
    astEngine?: AstEngineName
  },
) {
  // 这里仍返回 Babel AST 驱动的分析结果；`astEngine` 目前用于统一入口与缓存维度，
  // 后续若引入 Oxc 版结构化分析，可在此替换实现而不改调用方。
  const ast = parseJsLike(code)
  return createModuleAnalysis(id, ast)
}

export function getOrCreateExternalModuleAnalysis(
  moduleId: string,
  code: string,
  options?: {
    astEngine?: AstEngineName
  },
) {
  const cacheKey = createExternalModuleAnalysisCacheKey(moduleId, options?.astEngine)
  const cached = externalModuleAnalysisCache.get(cacheKey)
  if (cached && cached.code === code) {
    return cached.analysis
  }
  const analysis = createModuleAnalysisFromCode(moduleId, code, options)
  externalModuleAnalysisCache.set(cacheKey, { code, analysis })
  return analysis
}
