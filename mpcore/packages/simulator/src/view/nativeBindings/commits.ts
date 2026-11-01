type DataPath = readonly string[]

interface ScopeCommits {
  revision: number
  paths: Map<string, { path: DataPath, revision: number }>
}

const commits = new WeakMap<object, ScopeCommits>()

function parsePath(path: string) {
  return path.replace(/\[(\d+)\]/g, '.$1').split('.').map(segment => segment.trim()).filter(Boolean)
}

export function pathsIntersect(left: DataPath, right: DataPath) {
  return left.slice(0, Math.min(left.length, right.length)).every((segment, index) => segment === right[index])
}

/** 记录实例显式写入，保留同值与同批次多次 patch；祖先覆盖可压缩旧的后代记录。 */
export function recordNativeDataCommit(owner: object, keys: readonly string[]) {
  if (keys.length === 0) {
    return
  }
  let state = commits.get(owner)
  if (!state) {
    state = { revision: 0, paths: new Map() }
    commits.set(owner, state)
  }
  const revision = ++state.revision
  for (const key of keys) {
    const path = parsePath(key)
    for (const [previousKey, previous] of state.paths) {
      if (previous.path.length >= path.length && pathsIntersect(previous.path, path)) {
        state.paths.delete(previousKey)
      }
    }
    state.paths.set(JSON.stringify(path), { path, revision })
  }
}

export function getNativeDataRevision(owner: object) {
  return commits.get(owner)?.revision ?? 0
}

export function hasNativeDataCommit(owner: object, dependencies: readonly DataPath[], after: number, through: number) {
  for (const entry of commits.get(owner)?.paths.values() ?? []) {
    if (entry.revision > after && entry.revision <= through && dependencies.some(path => pathsIntersect(path, entry.path))) {
      return true
    }
  }
  return false
}
