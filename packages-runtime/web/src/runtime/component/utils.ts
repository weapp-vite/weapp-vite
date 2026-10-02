import type { PropertyOption } from './types'

const ARRAY_INDEX_PATH_RE = /\[(\d+)\]/g
const ARRAY_INDEX_SEGMENT_RE = /^\d+$/
const UNSAFE_PATH_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype'])

export function hyphenate(name: string) {
  return name.replace(/([A-Z])/g, (_, char: string) => `-${char.toLowerCase()}`)
}

export function toCamelCase(name: string) {
  return name.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())
}

export function cloneValue(value: any) {
  if (Array.isArray(value)) {
    return value.slice()
  }
  if (value && typeof value === 'object') {
    return { ...value }
  }
  return value
}

export function cloneCommittedValue(value: unknown, snapshots = new WeakMap<object, Record<string, unknown>>()): unknown {
  if (value === null || typeof value !== 'object') {
    return value
  }
  if (!Array.isArray(value)) {
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      return value
    }
  }
  const existing = snapshots.get(value)
  if (existing) {
    return existing
  }
  const snapshot: Record<string, unknown> = cloneValue(value)
  snapshots.set(value, snapshot)
  for (const key of Object.keys(snapshot)) {
    snapshot[key] = cloneCommittedValue(snapshot[key], snapshots)
  }
  return snapshot
}

export function parseDataPath(path: string) {
  return path
    .replace(ARRAY_INDEX_PATH_RE, '.$1')
    .split('.')
    .map(segment => segment.trim())
    .filter(segment => segment && !UNSAFE_PATH_SEGMENTS.has(segment))
}

function normalizePathSegment(segment: string) {
  return ARRAY_INDEX_SEGMENT_RE.test(segment) ? Number(segment) : segment
}

function createPathContainer(nextSegment: string | undefined) {
  return nextSegment && ARRAY_INDEX_SEGMENT_RE.test(nextSegment) ? [] : {}
}

export function resolveDataPath(target: Record<string, any>, segments: string[]) {
  let current: any = target
  for (const segment of segments) {
    if (current == null) {
      return undefined
    }
    current = current[normalizePathSegment(segment)]
  }
  return current
}

export function assignDataPath(target: Record<string, any>, segments: string[], value: unknown, copiedContainers?: WeakSet<object>) {
  if (!segments.length) {
    return
  }
  let current: any = target
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = normalizePathSegment(segments[index]!)
    const nextSegment = segments[index + 1]
    const next = current[segment]
    if (next == null || typeof next !== 'object') {
      current[segment] = createPathContainer(nextSegment)
      copiedContainers?.add(current[segment])
    }
    else if (!copiedContainers?.has(next)) {
      // 保留已传给子组件的输入快照，每批只复制一次变更路径上的容器。
      current[segment] = cloneValue(next)
      copiedContainers?.add(current[segment])
    }
    current = current[segment]
  }
  current[normalizePathSegment(segments[segments.length - 1]!)] = value
}

export function coerceValue(value: any, type?: PropertyOption['type']) {
  if (type === Boolean) {
    if (value === '' || value === true) {
      return true
    }
    if (value === undefined || value === null || value === false) {
      return false
    }
    if (typeof value === 'string') {
      return value !== 'false'
    }
    return Boolean(value)
  }

  if (type === Number) {
    if (value === undefined || value === null) {
      return value
    }
    const numeric = Number(value)
    return Number.isNaN(numeric) ? value : numeric
  }

  if (type === Object || type === Array) {
    if (value === undefined || value === null) {
      return value
    }
    if (typeof value === 'string') {
      try {
        return JSON.parse(value)
      }
      catch {
        return value
      }
    }
    return value
  }

  return value
}
