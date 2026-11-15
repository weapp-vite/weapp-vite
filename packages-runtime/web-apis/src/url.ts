import { decodeSearchParam } from './url/decodeSearchParam'

type URLSearchParamValue = string | readonly string[]
const LEADING_QUERY_REGEXP = /^\?/
const ABSOLUTE_URL_REGEXP = /^([a-z][a-z\d+.-]*:)?\/\/([^/?#]+)(\/[^?#]*)?(\?[^#]*)?(#.*)?$/i
const ABSOLUTE_URL_PREFIX_REGEXP = /^[a-z][a-z\d+.-]*:\/\//i
const ENCODED_SPACE_REGEXP = /%20/g

interface ParsedUrl {
  protocol: string
  username: string
  password: string
  host: string
  hostname: string
  port: string
  pathname: string
  search: string
  hash: string
  origin: string
}

function encodeSearchParam(value: string) {
  return encodeURIComponent(value).replace(ENCODED_SPACE_REGEXP, '+')
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

function normalizePathname(pathname: string) {
  const segments: string[] = []
  const hasTrailingSlash = pathname.endsWith('/') || pathname.endsWith('/.') || pathname.endsWith('/..')
  for (const segment of pathname.split('/')) {
    if (!segment || segment === '.') {
      continue
    }
    if (segment === '..') {
      segments.pop()
      continue
    }
    segments.push(segment)
  }

  let normalized = `/${segments.join('/')}`
  if (hasTrailingSlash && normalized !== '/' && !normalized.endsWith('/')) {
    normalized += '/'
  }
  return normalized
}

function getDefaultPort(protocol: string) {
  return {
    'http:': '80',
    'https:': '443',
    'ws:': '80',
    'wss:': '443',
  }[protocol]
}

function parseAuthority(authority: string, protocol: string) {
  const atIndex = authority.lastIndexOf('@')
  const userInfo = atIndex === -1 ? '' : authority.slice(0, atIndex)
  const hostSource = atIndex === -1 ? authority : authority.slice(atIndex + 1)
  const userInfoSeparator = userInfo.indexOf(':')
  const username = userInfoSeparator === -1 ? userInfo : userInfo.slice(0, userInfoSeparator)
  const password = userInfoSeparator === -1 ? '' : userInfo.slice(userInfoSeparator + 1)

  let hostname = hostSource
  let port = ''
  if (hostSource.startsWith('[')) {
    const closingBracket = hostSource.indexOf(']')
    if (closingBracket === -1) {
      return null
    }
    hostname = hostSource.slice(0, closingBracket + 1)
    if (hostSource[closingBracket + 1] === ':') {
      port = hostSource.slice(closingBracket + 2)
    }
  }
  else {
    const portSeparator = hostSource.lastIndexOf(':')
    if (portSeparator !== -1 && /^\d*$/.test(hostSource.slice(portSeparator + 1))) {
      hostname = hostSource.slice(0, portSeparator)
      port = hostSource.slice(portSeparator + 1)
    }
  }

  const normalizedProtocol = protocol.toLowerCase()
  if (port === getDefaultPort(normalizedProtocol)) {
    port = ''
  }
  const host = `${hostname}${port ? `:${port}` : ''}`
  return {
    username,
    password,
    hostname,
    port,
    host,
  }
}

function parseAbsoluteUrl(input: string): ParsedUrl | null {
  const match = input.match(ABSOLUTE_URL_REGEXP)
  if (!match) {
    return null
  }

  const protocol = (match[1] ?? '').toLowerCase()
  const authority = match[2]
  const parsedAuthority = parseAuthority(authority, protocol)
  if (!parsedAuthority) {
    return null
  }
  const pathname = normalizePathname(match[3] || '/')
  const search = match[4] ?? ''
  const hash = match[5] ?? ''
  const origin = protocol && parsedAuthority.host ? `${protocol}//${parsedAuthority.host}` : ''

  return {
    protocol,
    ...parsedAuthority,
    pathname,
    search,
    hash,
    origin,
  }
}

function serializeAuthority(parsed: ParsedUrl) {
  const userInfo = parsed.username || parsed.password
    ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ''}@`
    : ''
  return `${userInfo}${parsed.host}`
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
    return `${parsedBase.protocol}//${serializeAuthority(parsedBase)}${input}`
  }
  if (input.startsWith('?')) {
    return `${parsedBase.protocol}//${serializeAuthority(parsedBase)}${parsedBase.pathname}${input}`
  }
  if (input.startsWith('#')) {
    return `${parsedBase.protocol}//${serializeAuthority(parsedBase)}${parsedBase.pathname}${input}`
  }

  const queryStart = input.search(/[?#]/)
  const inputPathname = queryStart === -1 ? input : input.slice(0, queryStart)
  const inputSuffix = queryStart === -1 ? '' : input.slice(queryStart)
  const baseDirectory = parsedBase.pathname.slice(0, parsedBase.pathname.lastIndexOf('/') + 1)
  const pathname = normalizePathname(`${baseDirectory}${inputPathname}`)
  return `${parsedBase.protocol}//${serializeAuthority(parsedBase)}${pathname}${inputSuffix}`
}

export class URLSearchParamsPolyfill {
  private readonly entriesStore: Array<[string, string]> = []

  constructor(
    init?: string | URLSearchParamsPolyfill | Record<string, URLSearchParamValue> | Iterable<[string, string]>,
    private readonly onChange?: () => void,
  ) {
    if (init == null) {
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

  delete(key: string, value?: string) {
    const normalizedKey = String(key)
    const normalizedValue = value === undefined ? undefined : String(value)
    let changed = false
    for (let i = this.entriesStore.length - 1; i >= 0; i--) {
      if (
        this.entriesStore[i]?.[0] === normalizedKey
        && (normalizedValue === undefined || this.entriesStore[i]?.[1] === normalizedValue)
      ) {
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
    return found ? found[1] : null
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

  get size() {
    return this.entriesStore.length
  }

  set(key: string, value: string) {
    const normalizedKey = String(key)
    const normalizedValue = String(value)
    const firstIndex = this.entriesStore.findIndex(([entryKey]) => entryKey === normalizedKey)
    if (firstIndex === -1) {
      this.entriesStore.push([normalizedKey, normalizedValue])
      this.onChange?.()
      return
    }

    this.entriesStore[firstIndex]![1] = normalizedValue
    for (let i = this.entriesStore.length - 1; i > firstIndex; i--) {
      if (this.entriesStore[i]?.[0] === normalizedKey) {
        this.entriesStore.splice(i, 1)
      }
    }
    this.onChange?.()
  }

  sort() {
    this.entriesStore.sort(([leftKey], [rightKey]) => {
      if (leftKey < rightKey) {
        return -1
      }
      if (leftKey > rightKey) {
        return 1
      }
      return 0
    })
    this.onChange?.()
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

  static canParse(input: string | URLPolyfill, base?: string | URLPolyfill) {
    return URLPolyfill.parse(input, base) !== null
  }

  static parse(input: string | URLPolyfill, base?: string | URLPolyfill) {
    try {
      return new URLPolyfill(input, base)
    }
    catch {
      return null
    }
  }

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
    this.username = parsed.username
    this.password = parsed.password
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
    const userInfo = this.username || this.password
      ? `${this.username}${this.password ? `:${this.password}` : ''}@`
      : ''
    this.hrefValue = `${this.protocol}//${userInfo}${this.host}${this.pathname}${this.searchValue}${this.hashValue}`
  }

  private syncSearchFromParams() {
    const search = this.searchParams.toString()
    this.searchValue = search ? `?${search}` : ''
    this.updateHref()
  }
}
