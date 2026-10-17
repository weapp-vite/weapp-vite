import type { HeadlessComponentInstance } from './types'
import { isComponentAttached } from './attachment'
import { scheduleDiscardedComponentReady } from './discardedReady'
import { runComponentLifecycle } from './index'
import { syncComponentRelations } from './relations'

/** 用户卸载钩子失败也要完成关系与缓存收尾，避免下一次渲染重复卸载同一实例。 */
export function reconcileRemovedComponents<TScope>(
  cache: Map<string, HeadlessComponentInstance>,
  scopes: Map<string, TScope>,
  activeScopeIds: Set<string>,
  pageScopeId: string,
) {
  const removed = [...cache].filter(([scopeId]) => scopeId.startsWith(`${pageScopeId}/`) && !activeScopeIds.has(scopeId))
  let failure: { error: unknown } | undefined
  for (const [scopeId, instance] of removed) {
    try {
      if (isComponentAttached(instance)) {
        runComponentLifecycle(instance, 'detached')
      }
      else {
        scheduleDiscardedComponentReady(cache, scopeId, instance)
      }
    }
    catch (error) {
      failure ??= { error }
    }
  }
  let relationsChanged = false
  try {
    relationsChanged = syncComponentRelations(cache, activeScopeIds, pageScopeId)
  }
  catch (error) {
    failure ??= { error }
  }
  finally {
    for (const [scopeId] of removed) {
      cache.delete(scopeId)
      scopes.delete(scopeId)
    }
  }
  if (failure) {
    throw failure.error
  }
  return relationsChanged
}
