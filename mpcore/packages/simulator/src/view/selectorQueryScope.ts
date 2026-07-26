function isScopeCandidate(value: unknown): value is Record<string, any> {
  return (typeof value === 'object' && value !== null) || typeof value === 'function'
}

function resolveScopeCandidates(scope: Record<string, any>) {
  return [scope, scope.$, scope.$el].filter(isScopeCandidate)
}

export function resolveSelectorQueryNativeScope(
  scope: Record<string, any> | undefined,
  page: Record<string, any>,
  components: Iterable<Record<string, any>>,
) {
  if (!scope) {
    return undefined
  }

  const nativeScopes = new Set<Record<string, any>>([page, ...components])
  return resolveScopeCandidates(scope).find(candidate => nativeScopes.has(candidate)) ?? null
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
