import type { NodePath } from '@babel/traverse'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import generateModule from '@babel/generator'
import { parse as babelParse } from '@babel/parser'
import traverseModule from '@babel/traverse'
import * as t from '@babel/types'
import { removeExtensionDeep } from '@weapp-core/shared'
import fs from 'fs-extra'
import { LRUCache } from 'lru-cache'
import path from 'pathe'
import { BABEL_TS_MODULE_PLUGINS } from '../../utils/babel'
import { getSourceFromVirtualId } from '../vue/resolver'

const traverse: typeof traverseModule = (traverseModule as unknown as { default?: typeof traverseModule }).default ?? traverseModule
const generate: typeof generateModule = (generateModule as any).default ?? generateModule

const WE_VU_MODULE_ID = 'wevu'

const WE_VU_PAGE_HOOK_TO_FEATURE = {
  onPageScroll: 'enableOnPageScroll',
  onPullDownRefresh: 'enableOnPullDownRefresh',
  onReachBottom: 'enableOnReachBottom',
  onRouteDone: 'enableOnRouteDone',
  onTabItemTap: 'enableOnTabItemTap',
  onResize: 'enableOnResize',
  onShareAppMessage: 'enableOnShareAppMessage',
  onShareTimeline: 'enableOnShareTimeline',
  onAddToFavorites: 'enableOnAddToFavorites',
  onSaveExitState: 'enableOnSaveExitState',
} as const

export type WevuPageFeatureFlag = (typeof WE_VU_PAGE_HOOK_TO_FEATURE)[keyof typeof WE_VU_PAGE_HOOK_TO_FEATURE]
type WevuPageHookName = keyof typeof WE_VU_PAGE_HOOK_TO_FEATURE

type FunctionLike
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

interface ModuleAnalysis {
  id: string
  ast: t.File
  wevuNamedHookLocals: Map<string, WevuPageFeatureFlag>
  wevuNamespaceLocals: Set<string>
  importedBindings: Map<string, ImportBinding>
  localFunctions: Map<string, FunctionLike>
  exports: Map<string, ExportTarget>
}

export interface ModuleResolver {
  resolveId: (source: string, importer: string) => Promise<string | undefined>
  loadCode: (id: string) => Promise<string | undefined>
}

const externalModuleAnalysisCache = new LRUCache<
  string,
  { code: string, analysis: ModuleAnalysis }
>({
  max: 256,
})

function getOrCreateExternalModuleAnalysis(moduleId: string, code: string) {
  const cached = externalModuleAnalysisCache.get(moduleId)
  if (cached && cached.code === code) {
    return cached.analysis
  }
  const ast = parseJsLike(code)
  const analysis = createModuleAnalysis(moduleId, ast)
  externalModuleAnalysisCache.set(moduleId, { code, analysis })
  return analysis
}

function isStaticObjectKeyMatch(key: t.Expression | t.PrivateName, expected: string) {
  if (t.isIdentifier(key)) {
    return key.name === expected
  }
  if (t.isStringLiteral(key)) {
    return key.value === expected
  }
  return false
}

function getObjectPropertyByKey(node: t.ObjectExpression, key: string): t.ObjectProperty | null {
  for (const prop of node.properties) {
    if (!t.isObjectProperty(prop) || prop.computed) {
      continue
    }
    if (isStaticObjectKeyMatch(prop.key, key)) {
      return prop
    }
  }
  return null
}

function getObjectMemberIndexByKey(node: t.ObjectExpression, key: string): number {
  return node.properties.findIndex((prop) => {
    if (t.isObjectProperty(prop) && !prop.computed) {
      return isStaticObjectKeyMatch(prop.key, key)
    }
    if (t.isObjectMethod(prop) && !prop.computed) {
      return isStaticObjectKeyMatch(prop.key, key)
    }
    return false
  })
}

export function collectWevuPageFeatureFlags(ast: t.File): Set<WevuPageFeatureFlag> {
  const namedHookLocals = new Map<string, WevuPageFeatureFlag>()
  const namespaceLocals = new Set<string>()

  for (const stmt of ast.program.body) {
    if (!t.isImportDeclaration(stmt) || stmt.source.value !== WE_VU_MODULE_ID) {
      continue
    }
    for (const specifier of stmt.specifiers) {
      if (t.isImportSpecifier(specifier) && t.isIdentifier(specifier.imported)) {
        const importedName = specifier.imported.name as WevuPageHookName
        const matched = WE_VU_PAGE_HOOK_TO_FEATURE[importedName]
        if (matched) {
          namedHookLocals.set(specifier.local.name, matched)
        }
      }
      else if (t.isImportNamespaceSpecifier(specifier)) {
        namespaceLocals.add(specifier.local.name)
      }
    }
  }

  if (namedHookLocals.size === 0 && namespaceLocals.size === 0) {
    return new Set()
  }

  const enabled = new Set<WevuPageFeatureFlag>()

  function consumeHookCallByName(name: string) {
    const matched = namedHookLocals.get(name)
    if (matched) {
      enabled.add(matched)
    }
  }

  function consumeNamespaceHookCall(namespace: string, hookName: string) {
    if (!namespaceLocals.has(namespace)) {
      return
    }
    const matched = (WE_VU_PAGE_HOOK_TO_FEATURE as any)[hookName] as WevuPageFeatureFlag | undefined
    if (matched) {
      enabled.add(matched)
    }
  }

  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee
      if (t.isIdentifier(callee)) {
        consumeHookCallByName(callee.name)
        return
      }
      if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.object)) {
        const property = callee.property
        if (t.isIdentifier(property)) {
          consumeNamespaceHookCall(callee.object.name, property.name)
        }
      }
    },
    OptionalCallExpression(path) {
      const callee = path.node.callee
      if (t.isIdentifier(callee)) {
        consumeHookCallByName(callee.name)
        return
      }
      if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.object)) {
        const property = callee.property
        if (t.isIdentifier(property)) {
          consumeNamespaceHookCall(callee.object.name, property.name)
        }
      }
    },
  })

  return enabled
}

export function injectWevuPageFeatureFlagsIntoOptionsObject(
  optionsObject: t.ObjectExpression,
  enabled: Set<WevuPageFeatureFlag>,
): boolean {
  if (!enabled.size) {
    return false
  }

  const expectedKeys = Array.from(enabled)
  const existingFeaturesProp = getObjectPropertyByKey(optionsObject, 'features')

  if (!existingFeaturesProp) {
    const featuresObject = t.objectExpression(
      expectedKeys.map((key) => {
        return t.objectProperty(t.identifier(key), t.booleanLiteral(true))
      }),
    )

    const setupIndex = getObjectMemberIndexByKey(optionsObject, 'setup')
    const insertAt = setupIndex >= 0 ? setupIndex : 0

    optionsObject.properties.splice(
      insertAt,
      0,
      t.objectProperty(t.identifier('features'), featuresObject),
    )
    return true
  }

  if (!t.isObjectExpression(existingFeaturesProp.value)) {
    return false
  }

  const featuresObject = existingFeaturesProp.value
  let changed = false

  for (const key of expectedKeys) {
    const existing = getObjectPropertyByKey(featuresObject, key)
    if (existing) {
      continue
    }
    featuresObject.properties.push(
      t.objectProperty(t.identifier(key), t.booleanLiteral(true)),
    )
    changed = true
  }

  return changed
}

function isTopLevel(path: NodePath<t.Node>) {
  return path.getFunctionParent() == null
}

function parseJsLike(source: string): t.File {
  return babelParse(source, {
    sourceType: 'module',
    plugins: [
      ...BABEL_TS_MODULE_PLUGINS,
      'dynamicImport',
      'optionalChaining',
      'nullishCoalescingOperator',
    ],
  }) as unknown as t.File
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

function createModuleAnalysis(id: string, ast: t.File): ModuleAnalysis {
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

function getCallCalleeName(callee: t.CallExpression['callee']): { type: 'ident', name: string } | { type: 'member', object: string, property: string } | null {
  if (t.isV8IntrinsicIdentifier(callee)) {
    return null
  }
  if (t.isIdentifier(callee)) {
    return { type: 'ident', name: callee.name }
  }
  if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.object) && t.isIdentifier(callee.property)) {
    return { type: 'member', object: callee.object.name, property: callee.property.name }
  }
  return null
}

function collectCalledBindingsFromFunctionBody(
  fn: FunctionLike,
): Array<{ type: 'ident', name: string } | { type: 'member', object: string, property: string }> {
  const called: Array<{ type: 'ident', name: string } | { type: 'member', object: string, property: string }> = []
  t.traverseFast(fn, (node) => {
    if (t.isCallExpression(node)) {
      const name = getCallCalleeName(node.callee)
      if (name) {
        called.push(name)
      }
    }
    else if (t.isOptionalCallExpression(node)) {
      const name = getCallCalleeName(node.callee)
      if (name) {
        called.push(name)
      }
    }
  })
  return called
}

function collectWevuHookCallsInFunctionBody(module: ModuleAnalysis, fn: FunctionLike): Set<WevuPageFeatureFlag> {
  const enabled = new Set<WevuPageFeatureFlag>()

  t.traverseFast(fn, (node) => {
    if (t.isCallExpression(node)) {
      const callee = node.callee
      if (t.isIdentifier(callee)) {
        const matched = module.wevuNamedHookLocals.get(callee.name)
        if (matched) {
          enabled.add(matched)
        }
        return
      }
      if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.object) && t.isIdentifier(callee.property)) {
        if (!module.wevuNamespaceLocals.has(callee.object.name)) {
          return
        }
        const hook = callee.property.name as WevuPageHookName
        const matched = WE_VU_PAGE_HOOK_TO_FEATURE[hook]
        if (matched) {
          enabled.add(matched)
        }
      }
    }
    else if (t.isOptionalCallExpression(node)) {
      const callee = node.callee
      if (t.isIdentifier(callee)) {
        const matched = module.wevuNamedHookLocals.get(callee.name)
        if (matched) {
          enabled.add(matched)
        }
        return
      }
      if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.object) && t.isIdentifier(callee.property)) {
        if (!module.wevuNamespaceLocals.has(callee.object.name)) {
          return
        }
        const hook = callee.property.name as WevuPageHookName
        const matched = WE_VU_PAGE_HOOK_TO_FEATURE[hook]
        if (matched) {
          enabled.add(matched)
        }
      }
    }
  })

  return enabled
}

function resolveExportedFunctionNode(module: ModuleAnalysis, exportName: string): ExportTarget | null {
  const target = module.exports.get(exportName)
  if (!target) {
    return null
  }
  if (target.type === 'local') {
    const fn = module.localFunctions.get(target.localName)
    return fn ? { type: 'inline', node: fn } : null
  }
  return target
}

type ResolvedFunctionRef
  = | { moduleId: string, fn: FunctionLike, module: ModuleAnalysis }
    | { moduleId: string, reexport: { source: string, importedName: string } }
    | null

async function resolveExternalFunction(
  resolver: ModuleResolver,
  importerId: string,
  source: string,
  exportName: string,
  moduleCache: Map<string, ModuleAnalysis>,
): Promise<ResolvedFunctionRef> {
  if (source === WE_VU_MODULE_ID) {
    return null
  }

  const resolvedId = await resolver.resolveId(source, importerId)
  if (!resolvedId) {
    return null
  }

  const code = await resolver.loadCode(resolvedId)
  if (!code) {
    return null
  }

  let analysis = moduleCache.get(resolvedId)
  if (!analysis) {
    analysis = getOrCreateExternalModuleAnalysis(resolvedId, code)
    moduleCache.set(resolvedId, analysis)
  }

  const target = resolveExportedFunctionNode(analysis, exportName)
  if (!target) {
    return null
  }

  if (target.type === 'reexport') {
    return { moduleId: resolvedId, reexport: { source: target.source, importedName: target.importedName } }
  }

  if (target.type === 'inline') {
    return { moduleId: resolvedId, fn: target.node, module: analysis }
  }

  return null
}

async function collectWevuFeaturesFromSetupReachableImports(
  pageModule: ModuleAnalysis,
  setupFn: FunctionLike,
  resolver: ModuleResolver,
  moduleCache: Map<string, ModuleAnalysis>,
): Promise<Set<WevuPageFeatureFlag>> {
  const enabled = new Set<WevuPageFeatureFlag>()

  // seed: calls inside setup()
  const seedCalls = collectCalledBindingsFromFunctionBody(setupFn)

  type QueueItem
    = | { kind: 'local', moduleId: string, name: string }
      | { kind: 'external', importerId: string, source: string, exportName: string }

  const queue: QueueItem[] = []
  const visitedLocal = new Set<string>()
  const visitedExternal = new Set<string>()

  const enqueueLocal = (moduleId: string, name: string) => {
    const key = `${moduleId}::${name}`
    if (visitedLocal.has(key)) {
      return
    }
    visitedLocal.add(key)
    queue.push({ kind: 'local', moduleId, name })
  }

  const enqueueExternal = (importerId: string, source: string, exportName: string) => {
    const key = `${importerId}::${source}::${exportName}`
    if (visitedExternal.has(key)) {
      return
    }
    visitedExternal.add(key)
    queue.push({ kind: 'external', importerId, source, exportName })
  }

  const seedFromCall = (call: { type: 'ident', name: string } | { type: 'member', object: string, property: string }) => {
    if (call.type === 'ident') {
      const binding = pageModule.importedBindings.get(call.name)
      if (binding?.kind === 'named') {
        enqueueExternal(pageModule.id, binding.source, binding.importedName)
      }
      else if (binding?.kind === 'default') {
        enqueueExternal(pageModule.id, binding.source, 'default')
      }
      else if (!binding && pageModule.localFunctions.has(call.name)) {
        enqueueLocal(pageModule.id, call.name)
      }
      return
    }

    const binding = pageModule.importedBindings.get(call.object)
    if (binding?.kind === 'namespace') {
      enqueueExternal(pageModule.id, binding.source, call.property)
    }
  }

  for (const call of seedCalls) {
    seedFromCall(call)
  }

  // depth guard (avoid pathological graphs)
  let steps = 0
  const MAX_STEPS = 128

  while (queue.length && steps < MAX_STEPS) {
    steps += 1
    const item = queue.shift()!

    if (item.kind === 'local') {
      if (item.moduleId !== pageModule.id) {
        continue
      }
      const fn = pageModule.localFunctions.get(item.name)
      if (!fn) {
        continue
      }

      for (const f of collectWevuHookCallsInFunctionBody(pageModule, fn)) {
        enabled.add(f)
      }

      const calls = collectCalledBindingsFromFunctionBody(fn)
      for (const call of calls) {
        seedFromCall(call)
      }
      continue
    }

    const resolved = await resolveExternalFunction(resolver, item.importerId, item.source, item.exportName, moduleCache)
    if (!resolved) {
      continue
    }
    if ('reexport' in resolved) {
      enqueueExternal(resolved.moduleId, resolved.reexport.source, resolved.reexport.importedName)
      continue
    }

    for (const f of collectWevuHookCallsInFunctionBody(resolved.module, resolved.fn)) {
      enabled.add(f)
    }

    // Continue walking inside imported function: follow local and imported calls in that module
    const calls = collectCalledBindingsFromFunctionBody(resolved.fn)
    for (const call of calls) {
      if (call.type === 'ident') {
        const binding = resolved.module.importedBindings.get(call.name)
        if (binding?.kind === 'named') {
          enqueueExternal(resolved.moduleId, binding.source, binding.importedName)
        }
        else if (binding?.kind === 'default') {
          enqueueExternal(resolved.moduleId, binding.source, 'default')
        }
        else if (!binding && resolved.module.localFunctions.has(call.name)) {
          // local helper in imported module: inline scan by treating as re-exported local
          const key = `${resolved.moduleId}::${call.name}`
          if (!visitedLocal.has(key)) {
            visitedLocal.add(key)
            const localFn = resolved.module.localFunctions.get(call.name)
            if (localFn) {
              for (const f of collectWevuHookCallsInFunctionBody(resolved.module, localFn)) {
                enabled.add(f)
              }
              for (const inner of collectCalledBindingsFromFunctionBody(localFn)) {
                if (inner.type === 'ident') {
                  const innerBinding = resolved.module.importedBindings.get(inner.name)
                  if (innerBinding?.kind === 'named') {
                    enqueueExternal(resolved.moduleId, innerBinding.source, innerBinding.importedName)
                  }
                  else if (innerBinding?.kind === 'default') {
                    enqueueExternal(resolved.moduleId, innerBinding.source, 'default')
                  }
                }
              }
            }
          }
        }
      }
      else {
        const binding = resolved.module.importedBindings.get(call.object)
        if (binding?.kind === 'namespace') {
          enqueueExternal(resolved.moduleId, binding.source, call.property)
        }
      }
    }
  }

  return enabled
}

function getSetupFunctionFromOptionsObject(options: t.ObjectExpression): FunctionLike | null {
  for (const prop of options.properties) {
    if (t.isObjectProperty(prop) && !prop.computed && isStaticObjectKeyMatch(prop.key, 'setup')) {
      if (t.isFunctionExpression(prop.value) || t.isArrowFunctionExpression(prop.value)) {
        return prop.value
      }
    }
    else if (t.isObjectMethod(prop) && !prop.computed && isStaticObjectKeyMatch(prop.key, 'setup')) {
      return prop
    }
  }
  return null
}

function collectTargetOptionsObjects(
  ast: t.File,
  moduleId: string,
): { optionsObjects: t.ObjectExpression[], module: ModuleAnalysis } {
  const module = createModuleAnalysis(moduleId, ast)

  const optionsObjects: t.ObjectExpression[] = []
  const constObjectBindings = new Map<string, t.ObjectExpression>()
  const pendingConstObjectRefs: string[] = []
  traverse(ast, {
    VariableDeclarator(path) {
      if (!isTopLevel(path)) {
        return
      }
      if (!t.isIdentifier(path.node.id)) {
        return
      }
      const init = path.node.init
      if (t.isObjectExpression(init)) {
        constObjectBindings.set(path.node.id.name, init)
      }
    },

    CallExpression(path) {
      if (!isTopLevel(path)) {
        return
      }
      const node = path.node
      if (t.isV8IntrinsicIdentifier(node.callee)) {
        return
      }

      const first = node.arguments[0]
      if (!first || !t.isExpression(first)) {
        return
      }

      const binding = t.isIdentifier(node.callee)
        ? module.importedBindings.get(node.callee.name)
        : undefined

      if (t.isIdentifier(node.callee)) {
        if (binding?.kind !== 'named' || binding.source !== WE_VU_MODULE_ID) {
          return
        }
        if (binding.importedName !== 'defineComponent' && binding.importedName !== 'createWevuComponent') {
          return
        }
      }
      else if (t.isMemberExpression(node.callee) && !node.callee.computed && t.isIdentifier(node.callee.object) && t.isIdentifier(node.callee.property)) {
        const objectBinding = module.importedBindings.get(node.callee.object.name)
        if (objectBinding?.kind !== 'namespace' || objectBinding.source !== WE_VU_MODULE_ID) {
          return
        }
        if (node.callee.property.name !== 'defineComponent' && node.callee.property.name !== 'createWevuComponent') {
          return
        }
      }
      else {
        return
      }

      if (t.isObjectExpression(first)) {
        optionsObjects.push(first)
      }
      else if (t.isIdentifier(first)) {
        const target = constObjectBindings.get(first.name)
        if (target) {
          optionsObjects.push(target)
        }
        else {
          pendingConstObjectRefs.push(first.name)
        }
      }
    },
    OptionalCallExpression(path) {
      if (!isTopLevel(path)) {
        return
      }
      const node = path.node
      const callee = node.callee
      if (t.isV8IntrinsicIdentifier(callee)) {
        return
      }

      const first = node.arguments[0]
      if (!first || !t.isExpression(first)) {
        return
      }

      if (t.isIdentifier(callee)) {
        const binding = module.importedBindings.get(callee.name)
        if (binding?.kind !== 'named' || binding.source !== WE_VU_MODULE_ID) {
          return
        }
        if (binding.importedName !== 'defineComponent' && binding.importedName !== 'createWevuComponent') {
          return
        }
      }
      else if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.object) && t.isIdentifier(callee.property)) {
        const objectBinding = module.importedBindings.get(callee.object.name)
        if (objectBinding?.kind !== 'namespace' || objectBinding.source !== WE_VU_MODULE_ID) {
          return
        }
        if (callee.property.name !== 'defineComponent' && callee.property.name !== 'createWevuComponent') {
          return
        }
      }
      else {
        return
      }

      if (t.isObjectExpression(first)) {
        optionsObjects.push(first)
      }
      else if (t.isIdentifier(first)) {
        const target = constObjectBindings.get(first.name)
        if (target) {
          optionsObjects.push(target)
        }
        else {
          pendingConstObjectRefs.push(first.name)
        }
      }
    },
  })

  for (const name of pendingConstObjectRefs) {
    const target = constObjectBindings.get(name)
    if (target) {
      optionsObjects.push(target)
    }
  }

  return { optionsObjects, module }
}

export function injectWevuPageFeaturesInJs(
  source: string,
): { code: string, transformed: boolean } {
  const ast = parseJsLike(source)

  const enabled = collectWevuPageFeatureFlags(ast)
  if (!enabled.size) {
    return { code: source, transformed: false }
  }

  const { optionsObjects } = collectTargetOptionsObjects(ast, '<inline>')
  if (!optionsObjects.length) {
    return { code: source, transformed: false }
  }

  let changed = false
  for (const target of optionsObjects) {
    changed = injectWevuPageFeatureFlagsIntoOptionsObject(target, enabled) || changed
  }

  if (!changed) {
    return { code: source, transformed: false }
  }

  const generated = generate(ast, { retainLines: true })
  return { code: generated.code, transformed: true }
}

export async function injectWevuPageFeaturesInJsWithResolver(
  source: string,
  options: { id: string, resolver: ModuleResolver },
): Promise<{ code: string, transformed: boolean }> {
  const ast = parseJsLike(source)
  const { optionsObjects, module } = collectTargetOptionsObjects(ast, options.id)
  if (!optionsObjects.length) {
    return { code: source, transformed: false }
  }

  const enabled = new Set<WevuPageFeatureFlag>()
  for (const flag of collectWevuPageFeatureFlags(ast)) {
    enabled.add(flag)
  }

  const moduleCache = new Map<string, ModuleAnalysis>()
  moduleCache.set(options.id, module)

  for (const optionsObject of optionsObjects) {
    const setupFn = getSetupFunctionFromOptionsObject(optionsObject)
    if (!setupFn) {
      continue
    }
    const fromImports = await collectWevuFeaturesFromSetupReachableImports(module, setupFn, options.resolver, moduleCache)
    for (const flag of fromImports) {
      enabled.add(flag)
    }
  }

  if (!enabled.size) {
    return { code: source, transformed: false }
  }

  let changed = false
  for (const optionsObject of optionsObjects) {
    changed = injectWevuPageFeatureFlagsIntoOptionsObject(optionsObject, enabled) || changed
  }
  if (!changed) {
    return { code: source, transformed: false }
  }

  const generated = generate(ast, { retainLines: true })
  return { code: generated.code, transformed: true }
}

export function createPageEntryMatcher(ctx: CompilerContext) {
  let cached: Set<string> | undefined

  async function ensure() {
    const { configService, scanService } = ctx
    if (!configService || !scanService) {
      return new Set<string>()
    }
    if (cached) {
      return cached
    }

    const set = new Set<string>()
    const appEntry = await scanService.loadAppEntry()
    for (const pageEntry of appEntry.json?.pages ?? []) {
      const normalized = String(pageEntry).replace(/^[\\/]+/, '')
      if (!normalized) {
        continue
      }
      set.add(path.resolve(configService.absoluteSrcRoot, normalized))
    }

    for (const meta of scanService.loadSubPackages()) {
      const root = meta.subPackage.root ?? ''
      for (const pageEntry of meta.subPackage.pages ?? []) {
        const normalized = String(pageEntry).replace(/^[\\/]+/, '')
        if (!normalized) {
          continue
        }
        set.add(path.resolve(configService.absoluteSrcRoot, root, normalized))
      }
    }

    if (scanService.pluginJson) {
      const pluginPages = Object.values((scanService.pluginJson as any).pages ?? {})
      for (const entry of pluginPages) {
        const normalized = String(entry).replace(/^[\\/]+/, '')
        if (!normalized) {
          continue
        }
        set.add(path.resolve(configService.absoluteSrcRoot, removeExtensionDeep(normalized)))
      }
    }

    cached = set
    return set
  }

  return {
    markDirty() {
      cached = undefined
    },
    async isPageFile(filePath: string) {
      const pages = await ensure()
      const normalized = removeExtensionDeep(filePath)
      return pages.has(normalized)
    },
  }
}

export function createWevuAutoPageFeaturesPlugin(ctx: CompilerContext): Plugin {
  const matcher = createPageEntryMatcher(ctx)

  return {
    name: 'weapp-vite:wevu:page-features',
    enforce: 'pre',
    async transform(code, id) {
      const configService = ctx.configService
      const scanService = ctx.scanService
      if (!configService || !scanService) {
        return null
      }

      // app.json 变更会影响 pages 列表，这里直接跟随 scanService 的 dirty 标记。
      if (ctx.runtimeState.scan.isDirty) {
        matcher.markDirty()
      }

      const sourceId = getSourceFromVirtualId(id).split('?', 1)[0]
      if (!sourceId) {
        return null
      }
      if (sourceId.endsWith('.vue')) {
        return null
      }
      if (!/\.[cm]?[jt]sx?$/.test(sourceId)) {
        return null
      }

      const filename = path.isAbsolute(sourceId)
        ? sourceId
        : path.resolve(configService.cwd, sourceId)

      if (!(await matcher.isPageFile(filename))) {
        return null
      }

      const result = await injectWevuPageFeaturesInJsWithResolver(code, {
        id: filename,
        resolver: {
          resolveId: async (source, importer) => {
            const resolved = await this.resolve(source, importer)
            return resolved ? resolved.id : undefined
          },
          loadCode: async (id) => {
            const clean = getSourceFromVirtualId(id).split('?', 1)[0]
            if (!clean || clean.startsWith('\0') || clean.startsWith('node:')) {
              return undefined
            }
            try {
              if (await fs.pathExists(clean)) {
                return await fs.readFile(clean, 'utf8')
              }
              return undefined
            }
            catch {
              return undefined
            }
          },
        },
      })
      if (!result.transformed) {
        return null
      }

      return {
        code: result.code,
        map: null,
      }
    },
  }
}
