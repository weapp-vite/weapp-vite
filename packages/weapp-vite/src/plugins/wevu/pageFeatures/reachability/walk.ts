import type { FunctionLike, ModuleAnalysis } from '../moduleAnalysis'
import type { ModuleResolver, WevuPageFeatureFlag } from '../types'
import { collectCalledBindingsFromFunctionBody } from './calls'
import { collectWevuHookCallsInFunctionBody } from './hooks'
import { resolveExternalFunction } from './resolve'

type QueueItem
  = | { kind: 'local', moduleId: string, name: string }
    | { kind: 'external', importerId: string, source: string, exportName: string }

interface WalkOptions {
  pageModule: ModuleAnalysis
  setupFn: FunctionLike
  resolver: ModuleResolver
  moduleCache: Map<string, ModuleAnalysis>
}

export async function walkReachableWevuFeatures(options: WalkOptions): Promise<Set<WevuPageFeatureFlag>> {
  const { pageModule, setupFn, resolver, moduleCache } = options
  const enabled = new Set<WevuPageFeatureFlag>()

  // 初始：先收集 setup() 内的调用点
  const seedCalls = collectCalledBindingsFromFunctionBody(setupFn)

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
