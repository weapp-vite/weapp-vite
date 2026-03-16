import type { AstEngineName } from '../../../ast/types'
import type { WevuPageFeatureFlag, WevuPageHookName } from './types'
import * as t from '@weapp-vite/ast/babelTypes'
import { parseJsLikeWithEngine } from '@weapp-vite/ast'
import path from 'pathe'
import { LRUCache } from 'lru-cache'
import { WE_VU_MODULE_ID, WE_VU_PAGE_HOOK_TO_FEATURE } from '../../../constants'
import { parseJsLike } from '../../../utils/babel'

export type FunctionLike
  = | t.FunctionDeclaration
    | t.FunctionExpression
    | t.ArrowFunctionExpression
    | t.ObjectMethod
    | { type: string, [key: string]: any }

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
  engine: AstEngineName
  ast?: t.File
  wevuNamedHookLocals: Map<string, WevuPageFeatureFlag>
  wevuNamespaceLocals: Set<string>
  importedBindings: Map<string, ImportBinding>
  localFunctions: Map<string, FunctionLike>
  exports: Map<string, ExportTarget>
}

export function createEmptyModuleAnalysis(id: string, engine: AstEngineName): ModuleAnalysis {
  return {
    id,
    engine,
    wevuNamedHookLocals: new Map(),
    wevuNamespaceLocals: new Set(),
    importedBindings: new Map(),
    localFunctions: new Map(),
    exports: new Map(),
  }
}

const externalModuleAnalysisCache = new LRUCache<
  string,
  { code: string, analysis: ModuleAnalysis }
>({
  max: 256,
})

const moduleAnalysisCache = new LRUCache<
  string,
  { code: string, analysis: ModuleAnalysis }
>({
  max: 512,
})

function createExternalModuleAnalysisCacheKey(moduleId: string, astEngine?: AstEngineName) {
  return `${astEngine ?? 'babel'}::${moduleId}`
}

function createModuleAnalysisCacheKey(moduleId: string, astEngine?: AstEngineName) {
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
    engine: 'babel',
    ast,
    wevuNamedHookLocals,
    wevuNamespaceLocals,
    importedBindings,
    localFunctions,
    exports,
  }
}

function isOxcFunctionLike(node: any): node is FunctionLike {
  return node?.type === 'FunctionDeclaration'
    || node?.type === 'FunctionExpression'
    || node?.type === 'ArrowFunctionExpression'
}

function getImportedSpecifierName(node: any) {
  if (node?.type === 'Identifier') {
    return node.name as string
  }
  if (
    (node?.type === 'StringLiteral' || node?.type === 'Literal')
    && typeof node.value === 'string'
  ) {
    return node.value as string
  }
  return undefined
}

function resolveOxcParseFilename(id: string) {
  const extension = path.extname(id)
  if (extension) {
    return id
  }
  return `${id}.js`
}

function createModuleAnalysisWithOxc(id: string, code: string): ModuleAnalysis {
  const ast = parseJsLikeWithEngine(code, {
    engine: 'oxc',
    filename: resolveOxcParseFilename(id),
  }) as any
  const localFunctions = new Map<string, FunctionLike>()
  const exports = new Map<string, ExportTarget>()
  const importedBindings = new Map<string, ImportBinding>()
  const wevuNamedHookLocals = new Map<string, WevuPageFeatureFlag>()
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

export function createModuleAnalysisFromCode(
  id: string,
  code: string,
  options?: {
    astEngine?: AstEngineName
  },
) {
  const engine = options?.astEngine ?? 'babel'
  const cacheKey = createModuleAnalysisCacheKey(id, engine)
  const cached = moduleAnalysisCache.get(cacheKey)
  if (cached && cached.code === code) {
    return cached.analysis
  }

  let analysis: ModuleAnalysis
  if (engine === 'oxc') {
    if (!code.includes('import') && !code.includes('export')) {
      analysis = createEmptyModuleAnalysis(id, 'oxc')
    }
    else {
      analysis = createModuleAnalysisWithOxc(id, code)
    }
  }
  else {
    const ast = parseJsLike(code)
    analysis = createModuleAnalysis(id, ast)
  }

  moduleAnalysisCache.set(cacheKey, { code, analysis })
  return analysis
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
