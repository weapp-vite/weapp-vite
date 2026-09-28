import type { JsonValue } from './types'

/** 解析 JSON Pointer，拒绝原型链键及不规范的转义。 */
export function parsePointer(path: string) {
  if (!path.startsWith('/') || /~(?![01])/u.test(path)) {
    throw new Error(`无效的 JSON Pointer：${path}`)
  }
  const parts = path.slice(1).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'))
  if (parts.some(part => ['__proto__', 'prototype', 'constructor'].includes(part))) {
    throw new Error('路径不能包含原型链键')
  }
  return parts
}

export function readState(state: object, path: string): unknown {
  let current: unknown = state
  for (const part of parsePointer(path)) {
    if (Array.isArray(current) && !/^(?:0|[1-9]\d*)$/.test(part)) {
      throw new Error(`数组路径必须使用索引：${path}`)
    }
    if (!current || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, part)) {
      throw new Error(`状态路径不存在：${path}`)
    }
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

/** 在进入宿主数据层之前拒绝函数、循环、非有限数及非普通对象。 */
export function assertJson(value: unknown, ancestors = new Set<object>()): asserts value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return
  }
  if (!value || typeof value !== 'object' || ancestors.has(value)) {
    throw new Error('值必须是可序列化的 JSON 数据')
  }
  const prototype = Object.getPrototypeOf(value)
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new Error('值必须是普通 JSON 对象')
  }
  const next = new Set(ancestors).add(value)
  for (const child of Object.values(value)) {
    assertJson(child, next)
  }
}

export function cloneJson<T>(value: T): T {
  assertJson(value)
  return JSON.parse(JSON.stringify(value)) as T
}

export function writeState(state: object, path: string, value: JsonValue) {
  readState(state, path)
  const parts = parsePointer(path)
  let parent = state as Record<string, unknown>
  for (const part of parts.slice(0, -1)) {
    parent = parent[part] as Record<string, unknown>
  }
  parent[parts[parts.length - 1]!] = cloneJson(value)
}
