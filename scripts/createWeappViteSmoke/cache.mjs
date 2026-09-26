import path from 'node:path'

export function resolveSmokeCache(tmpRoot, configuredRoot) {
  const persistentRoot = configuredRoot?.trim()
  return {
    cacheRoot: persistentRoot ? path.resolve(persistentRoot) : path.join(tmpRoot, 'cache'),
    cacheMode: persistentRoot ? 'reused' : 'cold',
  }
}
