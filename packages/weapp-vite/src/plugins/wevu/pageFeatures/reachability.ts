import type { FunctionLike, ModuleAnalysis } from './moduleAnalysis'
import type { ModuleResolver, WevuPageFeatureFlag, WevuPageHookName } from './types'
import * as t from '@babel/types'
import { WE_VU_PAGE_HOOK_TO_FEATURE } from 'wevu/compiler'
import { getOrCreateExternalModuleAnalysis } from './moduleAnalysis'
import { WE_VU_MODULE_ID } from './types'

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

function resolveExportedFunctionNode(module: ModuleAnalysis, exportName: string): { type: 'reexport', source: string, importedName: string } | { type: 'inline', node: FunctionLike } | null {
  const target = module.exports.get(exportName)
  if (!target) {
    return null
  }
  if (target.type === 'local') {
    const fn = module.localFunctions.get(target.localName)
    return fn ? { type: 'inline', node: fn } : null
  }
  if (target.type === 'reexport') {
    return target
  }
  if (target.type === 'inline') {
    return target
  }
  return null
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
