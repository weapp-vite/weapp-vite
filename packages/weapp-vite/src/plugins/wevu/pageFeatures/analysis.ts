import type { ModuleResolver, WevuPageFeatureFlag, WevuPageHookName } from './types'
import * as t from '@babel/types'
import { LRUCache } from 'lru-cache'
import { WE_VU_PAGE_HOOK_TO_FEATURE } from 'wevu/compiler'
import { isStaticObjectKeyMatch, isTopLevel } from './astUtils'
import { parseJsLike, traverse } from './babel'
import { WE_VU_MODULE_ID } from './types'

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

export async function collectWevuFeaturesFromSetupReachableImports(
  pageModule: ModuleAnalysis,
  setupFn: FunctionLike,
  resolver: ModuleResolver,
  moduleCache: Map<string, ModuleAnalysis>,
): Promise<Set<WevuPageFeatureFlag>> {
  const enabled = new Set<WevuPageFeatureFlag>()

  // 初始：先收集 setup() 内的调用点
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

  // 深度上限（避免依赖图极端情况下退化）
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

    // 继续在导入函数内部向下追踪：跟随该模块中的本地调用与导入调用
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
          // 导入模块中的本地 helper：直接内联扫描其函数体
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

export function getSetupFunctionFromOptionsObject(options: t.ObjectExpression): FunctionLike | null {
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

export function collectTargetOptionsObjects(
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
