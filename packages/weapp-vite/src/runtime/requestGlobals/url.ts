type URLSearchParamValue = string | readonly string[]
const PLUS_REGEXP = /\+/g
const LEADING_QUERY_REGEXP = /^\?/
const ABSOLUTE_URL_REGEXP = /^([a-z][a-z\d+.-]*:)?\/\/([^/?#]+)(\/[^?#]*)?(\?[^#]*)?(#.*)?$/i
const ABSOLUTE_URL_PREFIX_REGEXP = /^[a-z][a-z\d+.-]*:\/\//i
const ENCODED_SPACE_REGEXP = /%20/g
const HOST_WITH_PORT_REGEXP = /^([^:]*)(?::(.*))?$/

function encodeSearchParam(value: string) {
  return encodeURIComponent(value).replace(ENCODED_SPACE_REGEXP, '+')
}

function decodeSearchParam(value: string) {
  return decodeURIComponent(value.replace(PLUS_REGEXP, ' '))
}

function normalizeSearchSource(input: string) {
  return input.replace(LEADING_QUERY_REGEXP, '')
}

function parseSearchEntries(input: string) {
  if (!input) {
    return [] as Array<[string, string]>
  }

  return normalizeSearchSource(input)
    .split('&')
    .filter(Boolean)
    .map((segment) => {
      const separatorIndex = segment.indexOf('=')
      if (separatorIndex === -1) {
        return [decodeSearchParam(segment), ''] as [string, string]
      }
      return [
        decodeSearchParam(segment.slice(0, separatorIndex)),
        decodeSearchParam(segment.slice(separatorIndex + 1)),
      ] as [string, string]
    })
}

function serializeSearchEntries(entries: Array<[string, string]>) {
  return entries
    .map(([key, value]) => `${encodeSearchParam(key)}=${encodeSearchParam(value)}`)
    .join('&')
}

function parseAbsoluteUrl(input: string) {
  const match = input.match(ABSOLUTE_URL_REGEXP)
  if (!match) {
    return null
  }

  const protocol = match[1] ?? ''
  const host = match[2] ?? ''
  const pathname = match[3] || '/'
  const search = match[4] ?? ''
  const hash = match[5] ?? ''
  const hostnameMatch = host.match(HOST_WITH_PORT_REGEXP)
  const hostname = hostnameMatch?.[1] ?? host
  const port = hostnameMatch?.[2] ?? ''

  return {
    protocol,
    host,
    hostname,
    port,
    pathname,
    search,
    hash,
    origin: protocol && host ? `${protocol}//${host}` : '',
    href: `${protocol}//${host}${pathname}${search}${hash}`,
  }
}

function resolveRelativeUrl(input: string, base: string) {
  const parsedBase = parseAbsoluteUrl(base)
  if (!parsedBase) {
    throw new TypeError(`Failed to construct URL from base ${base}`)
  }

  if (input.startsWith('//')) {
    return `${parsedBase.protocol}${input}`
  }
  if (input.startsWith('/')) {
    return `${parsedBase.origin}${input}`
  }
  if (input.startsWith('?') || input.startsWith('#')) {
    const pathname = parsedBase.pathname || '/'
    const prefix = `${parsedBase.origin}${pathname}`
    return `${prefix}${input}`
  }

  const basePathSegments = parsedBase.pathname.split('/').slice(0, -1)
  for (const segment of input.split('/')) {
    if (!segment || segment === '.') {
      continue
    }
    if (segment === '..') {
      basePathSegments.pop()
      continue
    }
    basePathSegments.push(segment)
  }
  return `${parsedBase.origin}/${basePathSegments.join('/')}`
}

export class URLSearchParamsPolyfill {
  private readonly entriesStore: Array<[string, string]> = []

  constructor(
    init?: string | URLSearchParamsPolyfill | Record<string, URLSearchParamValue> | Iterable<[string, string]>,
    private readonly onChange?: () => void,
  ) {
    if (!init) {
      return
    }

    if (typeof init === 'string') {
      this.entriesStore.push(...parseSearchEntries(init))
      return
    }

    if (typeof (init as Iterable<[string, string]>)[Symbol.iterator] === 'function') {
      for (const [key, value] of init as Iterable<[string, string]>) {
        this.append(key, value)
      }
      return
    }

    for (const [key, value] of Object.entries(init)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          this.append(key, item)
        }
        continue
      }
      this.append(key, value)
    }
  }

  append(key: string, value: string) {
    this.entriesStore.push([String(key), String(value)])
    this.onChange?.()
  }

  delete(key: string) {
    const normalizedKey = String(key)
    let changed = false
    for (let i = this.entriesStore.length - 1; i >= 0; i--) {
      if (this.entriesStore[i]?.[0] === normalizedKey) {
        this.entriesStore.splice(i, 1)
        changed = true
      }
    }
    if (changed) {
      this.onChange?.()
    }
  }

  get(key: string) {
    const normalizedKey = String(key)
    const found = this.entriesStore.find(([entryKey]) => entryKey === normalizedKey)
    return found?.[1] ?? null
  }

  getAll(key: string) {
    const normalizedKey = String(key)
    return this.entriesStore
      .filter(([entryKey]) => entryKey === normalizedKey)
      .map(([, value]) => value)
  }

  has(key: string) {
    return this.entriesStore.some(([entryKey]) => entryKey === String(key))
  }

  set(key: string, value: string) {
    this.delete(key)
    this.append(key, value)
  }

  forEach(callback: (value: string, key: string) => void) {
    for (const [key, value] of this.entriesStore) {
      callback(value, key)
    }
  }

  entries() {
    return this.entriesStore[Symbol.iterator]()
  }

  keys() {
    return this.entriesStore.map(([key]) => key)[Symbol.iterator]()
  }

  values() {
    return this.entriesStore.map(([, value]) => value)[Symbol.iterator]()
  }

  toString() {
    return serializeSearchEntries(this.entriesStore)
  }

  [Symbol.iterator]() {
    return this.entries()
  }
}

export class URLPolyfill {
  private hashValue = ''
  private hrefValue = ''
  private searchValue = ''
  host = ''
  hostname = ''
  origin = ''
  password = ''
  pathname = '/'
  port = ''
  protocol = ''
  username = ''
  readonly searchParams: URLSearchParamsPolyfill

  constructor(input: string | URLPolyfill, base?: string | URLPolyfill) {
    const inputString = typeof input === 'string' ? input : input.toString()
    const baseString = typeof base === 'string'
      ? base
      : base
        ? base.toString()
        : undefined
    const absoluteInput = ABSOLUTE_URL_PREFIX_REGEXP.test(inputString)
      ? inputString
      : baseString
        ? resolveRelativeUrl(inputString, baseString)
        : inputString
    const parsed = parseAbsoluteUrl(absoluteInput)

    if (!parsed) {
      throw new TypeError(`Failed to construct URL from ${inputString}`)
    }

    this.protocol = parsed.protocol
    this.host = parsed.host
    this.hostname = parsed.hostname
    this.port = parsed.port
    this.pathname = parsed.pathname
    this.searchValue = parsed.search
    this.hashValue = parsed.hash
    this.origin = parsed.origin
    this.searchParams = new URLSearchParamsPolyfill(parsed.search, () => {
      this.syncSearchFromParams()
    })
    this.updateHref()
  }

  get hash() {
    return this.hashValue
  }

  set hash(value: string) {
    this.hashValue = value ? (value.startsWith('#') ? value : `#${value}`) : ''
    this.updateHref()
  }

  get href() {
    return this.hrefValue
  }

  get search() {
    return this.searchValue
  }

  set search(value: string) {
    this.searchValue = value ? (value.startsWith('?') ? value : `?${value}`) : ''
    this.resetSearchParams(this.searchValue)
    this.updateHref()
  }

  toString() {
    return this.hrefValue
  }

  toJSON() {
    return this.toString()
  }

  private resetSearchParams(value: string) {
    const nextParams = new URLSearchParamsPolyfill(value)
    ;(this.searchParams as any).entriesStore.splice(0, (this.searchParams as any).entriesStore.length)
    nextParams.forEach((entryValue, entryKey) => {
      ;(this.searchParams as any).entriesStore.push([entryKey, entryValue])
    })
  }

  private updateHref() {
    this.hrefValue = `${this.protocol}//${this.host}${this.pathname}${this.searchValue}${this.hashValue}`
  }

  private syncSearchFromParams() {
    const search = this.searchParams.toString()
    this.searchValue = search ? `?${search}` : ''
    this.updateHref()
  }
}
