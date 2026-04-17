import type { HeaderLike, HeaderMap, HeaderPair, MiniProgramRequestMethod } from './types'
import { isObject } from './shared'
import { REQUEST_METHODS } from './types'

export function normalizeMethod(method?: string): MiniProgramRequestMethod {
  const normalized = (method ?? 'GET').toUpperCase()
  if (REQUEST_METHODS.includes(normalized as MiniProgramRequestMethod)) {
    return normalized as MiniProgramRequestMethod
  }
  return 'GET'
}

export function setHeader(target: HeaderMap, key: string, value: unknown) {
  const headerName = key.trim()
  if (!headerName) {
    return
  }
  const normalizedValue = String(value)
  for (const existingKey of Object.keys(target)) {
    if (existingKey.toLowerCase() === headerName.toLowerCase() && existingKey !== headerName) {
      delete target[existingKey]
      break
    }
  }
  target[headerName] = normalizedValue
}

export function hasHeader(target: HeaderMap, key: string) {
  const normalized = key.toLowerCase()
  return Object.keys(target).some(item => item.toLowerCase() === normalized)
}

export function mergeHeaderSource(target: HeaderMap, source: unknown) {
  if (!source) {
    return
  }
  if (typeof (source as HeaderLike).forEach === 'function') {
    ;(source as HeaderLike).forEach((value, key) => {
      setHeader(target, key, value)
    })
    return
  }
  if (typeof (source as Iterable<HeaderPair>)[Symbol.iterator] === 'function') {
    for (const item of source as Iterable<HeaderPair>) {
      if (!item || item.length < 2) {
        continue
      }
      setHeader(target, item[0], item[1])
    }
    return
  }
  if (isObject(source)) {
    for (const [key, value] of Object.entries(source)) {
      if (Array.isArray(value)) {
        setHeader(target, key, value.join(', '))
        continue
      }
      setHeader(target, key, value)
    }
  }
}

export function toHeaderMap(source?: unknown) {
  const headers: HeaderMap = {}
  mergeHeaderSource(headers, source)
  return headers
}

class WevuHeadersFallback {
  private readonly store = new Map<string, { key: string, value: string }>()

  constructor(init?: HeaderMap) {
    if (!init) {
      return
    }
    for (const [key, value] of Object.entries(init)) {
      this.set(key, value)
    }
  }

  append(key: string, value: string) {
    const current = this.get(key)
    if (!current) {
      this.set(key, value)
      return
    }
    this.set(key, `${current}, ${value}`)
  }

  set(key: string, value: string) {
    const normalized = key.toLowerCase()
    this.store.set(normalized, { key, value })
  }

  get(key: string) {
    return this.store.get(key.toLowerCase())?.value ?? null
  }

  has(key: string) {
    return this.store.has(key.toLowerCase())
  }

  delete(key: string) {
    this.store.delete(key.toLowerCase())
  }

  forEach(callback: (value: string, key: string) => void) {
    for (const item of this.store.values()) {
      callback(item.value, item.key)
    }
  }

  entries() {
    return Array.from(this.store.values(), item => [item.key, item.value] as [string, string])[Symbol.iterator]()
  }

  keys() {
    return Array.from(this.store.values(), item => item.key)[Symbol.iterator]()
  }

  values() {
    return Array.from(this.store.values(), item => item.value)[Symbol.iterator]()
  }

  [Symbol.iterator]() {
    return this.entries()
  }
}

export type HeadersContainer = Headers | WevuHeadersFallback

export function createHeadersContainer(headers: HeaderMap): HeadersContainer {
  if (typeof Headers === 'function') {
    return new Headers(headers)
  }
  return new WevuHeadersFallback(headers)
}

export function cloneHeadersToMap(headers: HeadersContainer) {
  const result: HeaderMap = {}
  headers.forEach((value, key) => {
    setHeader(result, key, value)
  })
  return result
}
