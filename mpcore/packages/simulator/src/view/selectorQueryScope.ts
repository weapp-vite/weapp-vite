import { WEVU_NATIVE_INSTANCE_KEY } from '@weapp-core/constants'

const MPCORE_COMPONENT_SCOPE_ID = '__mpcoreComponentScopeId'

function isScopeCandidate(value: unknown): value is Record<string, any> {
  return (typeof value === 'object' && value !== null) || typeof value === 'function'
}

function resolveScopeCandidates(scope: Record<string, any>) {
  const candidates: Record<string, any>[] = []
  const visited = new Set<Record<string, any>>()
  const queue: unknown[] = [scope]

  while (queue.length > 0) {
    const candidate = queue.shift()
    if (!isScopeCandidate(candidate) || visited.has(candidate)) {
      continue
    }
    visited.add(candidate)
    candidates.push(candidate)
    queue.push(
      candidate.$,
      candidate.$el,
      candidate.$state,
      candidate[WEVU_NATIVE_INSTANCE_KEY],
    )
  }

  return candidates
}

export function resolveSelectorQueryNativeScope(
  scope: Record<string, any> | undefined,
  page: Record<string, any>,
  components: Iterable<Record<string, any>>,
) {
  if (!scope) {
    return undefined
  }

  const nativeScopes = [page, ...components]
  const nativeScopeSet = new Set<Record<string, any>>(nativeScopes)
  for (const candidate of resolveScopeCandidates(scope)) {
    if (nativeScopeSet.has(candidate)) {
      return candidate
    }
    const scopeId = candidate[MPCORE_COMPONENT_SCOPE_ID]
    if (typeof scopeId !== 'string' || !scopeId) {
      continue
    }
    const currentScope = nativeScopes.find(nativeScope => nativeScope[MPCORE_COMPONENT_SCOPE_ID] === scopeId)
    if (currentScope) {
      return currentScope
    }
  }
  return null
}

export function setSelectorQueryScopeId(scope: Record<string, any>, scopeId: string) {
  Object.defineProperty(scope, MPCORE_COMPONENT_SCOPE_ID, {
    configurable: true,
    enumerable: false,
    value: scopeId,
    writable: false,
  })
}

export function resolveSelectorQueryScopeId(scope: Record<string, any> | undefined) {
  if (!scope) {
    return null
  }
  for (const candidate of resolveScopeCandidates(scope)) {
    const scopeId = candidate[MPCORE_COMPONENT_SCOPE_ID]
    if (typeof scopeId === 'string' && scopeId) {
      return scopeId
    }
  }
  return null
}

export function resolveSelectorQueryScopeSnapshot<T>(
  scope: Record<string, any> | undefined,
  snapshots: WeakMap<Record<string, any>, T>,
) {
  if (!scope) {
    return null
  }

  for (const candidate of resolveScopeCandidates(scope)) {
    const snapshot = snapshots.get(candidate)
    if (snapshot) {
      return {
        nativeScope: candidate,
        snapshot,
      }
    }
  }
  return null
}
