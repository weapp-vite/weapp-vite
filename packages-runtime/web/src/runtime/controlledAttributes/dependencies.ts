import { resolveTemplateScopeSource } from '../templateScopeSources'

export type ControlledDataPath = readonly string[]
export type ControlledScope = Record<string, unknown>
export type ControlledReader = (scope: ControlledScope) => unknown

export function pathsIntersect(left: ControlledDataPath, right: ControlledDataPath) {
  const length = Math.min(left.length, right.length)
  return left.slice(0, length).every((segment, index) => segment === right[index])
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function findObjectPaths(root: ControlledScope, target: object) {
  const paths: string[][] = []
  const active = new WeakSet<object>()
  const visit = (value: unknown, path: string[]) => {
    if (!isObject(value) || active.has(value)) {
      return
    }
    if (value === target) {
      paths.push(path)
      return
    }
    active.add(value)
    for (const key of Object.keys(value)) {
      visit(value[key], [...path, key])
    }
    active.delete(value)
  }
  visit(root, [])
  return paths
}

/** 读取依赖留在运行时，不把编译器或 AST 解析依赖带入浏览器。 */
export function readControlledValue(read: ControlledReader, scope: ControlledScope, root: ControlledScope) {
  const paths = new Map<string, string[]>()
  const originals = new WeakMap<object, object>()
  const record = (path: string[]) => {
    for (const [key, previous] of paths) {
      if (pathsIntersect(previous, path)) {
        if (previous.length >= path.length) {
          return
        }
        paths.delete(key)
      }
    }
    paths.set(JSON.stringify(path), path)
  }
  const wrap = (value: unknown, parents: string[][]): unknown => {
    if (!isObject(value)) {
      for (const path of parents) {
        record(path)
      }
      return value
    }
    const prototype = Object.getPrototypeOf(value)
    if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
      for (const path of parents) {
        record(path)
      }
      return value
    }
    for (const path of parents) {
      record(path)
    }
    const proxy = new Proxy(value, {
      get(target, key, receiver) {
        const result = Reflect.get(target, key, receiver)
        return typeof key === 'string' ? wrap(result, parents.map(path => [...path, key])) : result
      },
    })
    originals.set(proxy, value)
    return proxy
  }
  const trackedScopes = new WeakMap<object, ControlledScope>()
  const trackScope = (current: ControlledScope): ControlledScope => {
    const previous = trackedScopes.get(current)
    if (previous) {
      return previous
    }
    const tracked = new Proxy(current, {
      get(target, key, receiver) {
        const value = Reflect.get(target, key, receiver)
        if (typeof key !== 'string') {
          return value
        }
        const source = resolveTemplateScopeSource(target, key)
        if (source) {
          return source.read(trackScope(source.scope))
        }
        const parents = key in root && Object.is(root[key], value)
          ? [[key]]
          : isObject(value) ? findObjectPaths(root, value) : []
        return wrap(value, parents)
      },
    })
    trackedScopes.set(current, tracked)
    return tracked
  }
  const value = read(trackScope(scope))
  return { value: isObject(value) ? originals.get(value) ?? value : value, paths: [...paths.values()] }
}
