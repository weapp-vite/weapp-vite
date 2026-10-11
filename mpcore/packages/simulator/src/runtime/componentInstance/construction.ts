import type { HeadlessComponentInstance } from './types'

interface ComponentConstructionState {
  depth: number
  created: Map<string, HeadlessComponentInstance>
}

const constructionStates = new WeakMap<Map<string, HeadlessComponentInstance>, ComponentConstructionState>()
const constructingInstances = new WeakSet<HeadlessComponentInstance>()

export function isComponentConstructing(instance: HeadlessComponentInstance | undefined): boolean {
  return instance !== undefined && constructingInstances.has(instance)
}

export function hasPendingComponentConstruction(componentCache: Map<string, HeadlessComponentInstance>) {
  return constructionStates.has(componentCache)
}

export function beginComponentConstruction(
  componentCache: Map<string, HeadlessComponentInstance>,
  scopeId: string,
  instance: HeadlessComponentInstance,
) {
  let state = constructionStates.get(componentCache)
  if (!state) {
    state = { depth: 0, created: new Map() }
    constructionStates.set(componentCache, state)
  }
  state.depth++
  state.created.set(scopeId, instance)
  constructingInstances.add(instance)
}

export function discardComponentConstruction(
  componentCache: Map<string, HeadlessComponentInstance>,
  componentScopes: Pick<Map<string, unknown>, 'delete'>,
  scopeId: string,
) {
  const state = constructionStates.get(componentCache)!
  const prefix = `${scopeId}/`
  // 只回收本次构造新增的子树，保留重入前已经存在的实例和作用域。
  for (const [createdScopeId, instance] of state.created) {
    if (createdScopeId !== scopeId && !createdScopeId.startsWith(prefix)) {
      continue
    }
    if (componentCache.get(createdScopeId) === instance) {
      componentCache.delete(createdScopeId)
      componentScopes.delete(createdScopeId)
    }
    state.created.delete(createdScopeId)
  }
}

export function finishComponentConstruction(
  componentCache: Map<string, HeadlessComponentInstance>,
  instance: HeadlessComponentInstance,
) {
  constructingInstances.delete(instance)
  const state = constructionStates.get(componentCache)!
  if (--state.depth === 0) {
    constructionStates.delete(componentCache)
  }
}
