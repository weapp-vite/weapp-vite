import { track } from '../core'
import {
  indexPatchNode,
  rawMultiParentSet,
  rawParentMap,
  rawParentsMap,
  rawPathMap,
  rawRootMap,
  rawVersionMap,
  recordParentLink,
  rootPatchNodesMap,
} from './patchState'
import { isObject, ReactiveFlags, toRaw, VERSION_KEY } from './shared'

export interface PrelinkReactiveTreeOptions {
  shouldIncludeTopKey?: (key: string) => boolean
  maxDepth?: number
  maxKeys?: number
}

/**
 * 预链接响应式树结构，供运行时差量路径追踪使用。
 * @internal
 */
export function prelinkReactiveTree(root: object, options?: PrelinkReactiveTreeOptions) {
  const rootRaw = toRaw(root as any) as object
  rawPathMap.set(rootRaw, '')
  indexPatchNode(rootRaw, rootRaw)

  const shouldIncludeTopKey = options?.shouldIncludeTopKey
  const maxDepth = typeof options?.maxDepth === 'number' ? Math.max(0, Math.floor(options!.maxDepth!)) : Number.POSITIVE_INFINITY
  const maxKeys = typeof options?.maxKeys === 'number' ? Math.max(0, Math.floor(options!.maxKeys!)) : Number.POSITIVE_INFINITY

  const visited = new WeakSet<object>()
  const stack: Array<{ current: object, path: string, depth: number }> = [{ current: rootRaw, path: '', depth: 0 }]
  let indexed = 0

  while (stack.length) {
    const node = stack.pop()!
    if (visited.has(node.current)) {
      continue
    }
    visited.add(node.current)
    rawPathMap.set(node.current, node.path)
    indexPatchNode(rootRaw, node.current)
    indexed += 1
    if (indexed >= maxKeys) {
      continue
    }

    if (node.depth >= maxDepth) {
      continue
    }
    if (Array.isArray(node.current)) {
      // 数组不预先展开子元素：大列表场景避免 O(n) 初始化开销。
      continue
    }

    const entries = Object.entries(node.current as any)
    for (const [key, value] of entries) {
      if (node.path === '' && shouldIncludeTopKey && !shouldIncludeTopKey(key)) {
        continue
      }
      if (!isObject(value)) {
        continue
      }
      if ((value as any)[ReactiveFlags.SKIP]) {
        continue
      }
      const childRaw = toRaw(value as any) as object
      if (!rawRootMap.has(childRaw)) {
        rawRootMap.set(childRaw, rootRaw)
      }
      recordParentLink(childRaw, node.current, key)
      if (!rawMultiParentSet.has(childRaw)) {
        const childPath = node.path ? `${node.path}.${key}` : key
        rawPathMap.set(childRaw, childPath)
      }
      indexPatchNode(rootRaw, childRaw)
      stack.push({ current: childRaw, path: node.path ? `${node.path}.${key}` : key, depth: node.depth + 1 })
    }
  }
}

/**
 * 清理预链接阶段建立的路径与父子索引。
 * @internal
 */
export function clearPatchIndices(root: object) {
  const rootRaw = toRaw(root as any) as object
  const nodes = rootPatchNodesMap.get(rootRaw)
  if (!nodes) {
    rawPathMap.delete(rootRaw)
    return
  }

  for (const node of nodes) {
    rawParentMap.delete(node)
    rawParentsMap.delete(node)
    rawPathMap.delete(node)
    rawMultiParentSet.delete(node)
    rawRootMap.delete(node)
    rawVersionMap.delete(node)
  }

  rootPatchNodesMap.delete(rootRaw)
}

/**
 * 让 effect 订阅整个对象的“版本号”，无需深度遍历即可对任何字段变化做出响应。
 * @internal
 */
export function touchReactive(target: object) {
  const raw = toRaw(target as any) as object
  track(raw, VERSION_KEY)
}
