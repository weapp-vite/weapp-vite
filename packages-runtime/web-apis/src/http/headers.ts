import { normalizeHeaderName } from '../shared'

type HeaderTuple = readonly [string, string]
type HeaderRecord = Record<string, string>
const SET_COOKIE_HEADER_NAME = 'set-cookie'

function isIterableHeaders(input: unknown): input is Iterable<HeaderTuple> {
  return Boolean(input) && typeof (input as Iterable<HeaderTuple>)[Symbol.iterator] === 'function'
}

function isHeaderObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null
}

export class HeadersPolyfill {
  private readonly store = new Map<string, { key: string, values: string[] }>()

  constructor(init?: unknown) {
    if (!init) {
      return
    }

    if (isIterableHeaders(init)) {
      for (const [key, value] of init) {
        this.append(key, value)
      }
      return
    }

    if (typeof (init as { forEach?: unknown }).forEach === 'function') {
      ;(init as { forEach: (callback: (value: string, key: string) => void) => void }).forEach((value, key) => {
        this.set(key, value)
      })
      return
    }

    if (isHeaderObject(init)) {
      for (const [key, value] of Object.entries(init)) {
        this.append(key, Array.isArray(value) ? value.join(', ') : String(value))
      }
    }
  }

  append(key: string, value: string) {
    const normalized = normalizeHeaderName(key)
    if (!normalized) {
      return
    }

    const item = this.store.get(normalized)
    if (item) {
      item.values.push(String(value))
      return
    }

    this.store.set(normalized, {
      key,
      values: [String(value)],
    })
  }

  set(key: string, value: string) {
    const normalized = normalizeHeaderName(key)
    if (!normalized) {
      return
    }
    this.store.set(normalized, {
      key,
      values: [String(value)],
    })
  }

  get(key: string) {
    return this.store.get(normalizeHeaderName(key))?.values.join(', ') ?? null
  }

  getSetCookie() {
    return this.store.get(SET_COOKIE_HEADER_NAME)?.values.slice() ?? []
  }

  has(key: string) {
    return this.store.has(normalizeHeaderName(key))
  }

  delete(key: string) {
    this.store.delete(normalizeHeaderName(key))
  }

  forEach(callback: (value: string, key: string, parent: HeadersPolyfill) => void, thisArg?: unknown) {
    for (const { key, values } of this.store.values()) {
      callback.call(thisArg, values.join(', '), key, this)
    }
  }

  entries() {
    return Array.from(this.store.values(), item => [item.key, item.values.join(', ')] as [string, string])[Symbol.iterator]()
  }

  keys() {
    return Array.from(this.store.values(), item => item.key)[Symbol.iterator]()
  }

  values() {
    return Array.from(this.store.values(), item => item.values.join(', '))[Symbol.iterator]()
  }

  [Symbol.iterator]() {
    return this.entries()
  }
}

export function headersToObject(headers: HeadersPolyfill | Headers) {
  const result: HeaderRecord = {}
  headers.forEach((value, key) => {
    result[key] = value
  })
  return result
}
