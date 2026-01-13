import { mutationRecorders } from './mutation'

export const rawRootMap = new WeakMap<object, object>()
export const rawVersionMap = new WeakMap<object, number>()
export const rawParentMap = new WeakMap<object, { parent: object, key: PropertyKey }>()
export const rawParentsMap = new WeakMap<object, Map<object, Set<PropertyKey>>>()
export const rawMultiParentSet = new WeakSet<object>()
export const rawPathMap = new WeakMap<object, string>()
export const rootPatchNodesMap = new WeakMap<object, Set<object>>()

function getRootPatchNodes(root: object) {
  let nodes = rootPatchNodesMap.get(root)
  if (!nodes) {
    nodes = new Set()
    rootPatchNodesMap.set(root, nodes)
  }
  return nodes
}

export function indexPatchNode(root: object, node: object) {
  getRootPatchNodes(root).add(node)
}

export function bumpRawVersion(target: object) {
  rawVersionMap.set(target, (rawVersionMap.get(target) ?? 0) + 1)
}

export function getRawVersion(target: object) {
  return rawVersionMap.get(target) ?? 0
}

export function bumpAncestorVersions(target: object) {
  const visited = new Set<object>()
  const stack: object[] = [target]
  for (let i = 0; i < 2000 && stack.length; i++) {
    const current = stack.pop()!
    const parents = rawParentsMap.get(current)
    if (!parents) {
      continue
    }
    for (const parent of parents.keys()) {
      if (visited.has(parent)) {
        continue
      }
      visited.add(parent)
      bumpRawVersion(parent)
      stack.push(parent)
    }
  }
}

export function recordParentLink(child: object, parent: object, key: PropertyKey) {
  if (typeof key !== 'string') {
    rawMultiParentSet.add(child)
    rawParentMap.delete(child)
    return
  }

  if (mutationRecorders.size) {
    const root = rawRootMap.get(parent) ?? parent
    indexPatchNode(root, parent)
    indexPatchNode(root, child)
  }

  let parents = rawParentsMap.get(child)
  if (!parents) {
    parents = new Map()
    rawParentsMap.set(child, parents)
  }

  let keys = parents.get(parent)
  if (!keys) {
    keys = new Set()
    parents.set(parent, keys)
  }

  keys.add(key)
  refreshPathUniqueness(child)
}

export function removeParentLink(child: object, parent: object, key: PropertyKey) {
  const parents = rawParentsMap.get(child)
  if (!parents) {
    return
  }
  const keys = parents.get(parent)
  if (!keys) {
    return
  }
  keys.delete(key)
  if (!keys.size) {
    parents.delete(parent)
  }
  if (!parents.size) {
    rawParentsMap.delete(child)
  }
  refreshPathUniqueness(child)
}

function refreshPathUniqueness(child: object) {
  const parents = rawParentsMap.get(child)
  if (!parents) {
    rawMultiParentSet.delete(child)
    rawParentMap.delete(child)
    return
  }

  let uniqueParent: object | undefined
  let uniqueKey: PropertyKey | undefined
  let total = 0
  for (const [parent, keys] of parents) {
    for (const k of keys) {
      total += 1
      if (total > 1) {
        break
      }
      uniqueParent = parent
      uniqueKey = k
    }
    if (total > 1) {
      break
    }
  }

  if (total === 1 && uniqueParent && uniqueKey) {
    rawMultiParentSet.delete(child)
    rawParentMap.set(child, { parent: uniqueParent, key: uniqueKey })
    return
  }

  rawMultiParentSet.add(child)
  rawParentMap.delete(child)
}

export function resolvePathToTarget(root: object, target: object): string[] | undefined {
  if (target === root) {
    return []
  }
  if (rawMultiParentSet.has(target)) {
    return undefined
  }
  const segments: string[] = []
  let current: object = target
  for (let i = 0; i < 2000; i++) {
    if (current === root) {
      return segments.reverse()
    }
    if (rawMultiParentSet.has(current)) {
      return undefined
    }
    const info = rawParentMap.get(current)
    if (!info) {
      return undefined
    }
    if (typeof info.key !== 'string') {
      return undefined
    }
    segments.push(info.key)
    current = info.parent
  }
  return undefined
}
