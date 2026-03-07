import type {
  LocationQuery,
  LocationQueryRaw,
  LocationQueryValue,
  LocationQueryValueRaw,
  RouteParams,
  RouteParamsRaw,
  RouteParamValue,
  RouteParamValueRaw,
} from '../router'

function decodeQuerySegment(value: string): string {
  return decodeURIComponent(value.replace(/\+/g, ' '))
}

function encodeQuerySegment(value: string): string {
  return encodeURIComponent(value)
}

function pushQueryValue(target: LocationQuery, key: string, value: LocationQueryValue) {
  const previous = target[key]
  if (previous === undefined) {
    target[key] = value
    return
  }
  if (Array.isArray(previous)) {
    previous.push(value)
    return
  }
  target[key] = [previous, value]
}

function pushRouteParamValue(target: RouteParams, key: string, value: RouteParamValue) {
  const previous = target[key]
  if (previous === undefined) {
    target[key] = value
    return
  }
  if (Array.isArray(previous)) {
    previous.push(value)
    return
  }
  target[key] = [previous, value]
}

function normalizeQueryValue(value: LocationQueryValueRaw): LocationQueryValue | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value === null) {
    return null
  }
  return String(value)
}

export function normalizeQuery(query: LocationQueryRaw | LocationQuery): LocationQuery {
  const normalized: LocationQuery = {}
  for (const key of Object.keys(query)) {
    const rawValue = (query as Record<string, LocationQueryValueRaw | LocationQueryValueRaw[]>)[key]
    if (Array.isArray(rawValue)) {
      for (const item of rawValue) {
        const next = normalizeQueryValue(item)
        if (next !== undefined) {
          pushQueryValue(normalized, key, next)
        }
      }
      continue
    }
    const next = normalizeQueryValue(rawValue)
    if (next !== undefined) {
      pushQueryValue(normalized, key, next)
    }
  }
  return normalized
}

function normalizeRouteParamValue(value: RouteParamValueRaw): RouteParamValue | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  return String(value)
}

export function normalizeRouteParams(params: RouteParamsRaw | RouteParams): RouteParams {
  const normalized: RouteParams = {}
  for (const key of Object.keys(params)) {
    const rawValue = (params as Record<string, RouteParamValueRaw | RouteParamValueRaw[]>)[key]
    if (Array.isArray(rawValue)) {
      for (const item of rawValue) {
        const next = normalizeRouteParamValue(item)
        if (next !== undefined) {
          pushRouteParamValue(normalized, key, next)
        }
      }
      continue
    }
    const next = normalizeRouteParamValue(rawValue)
    if (next !== undefined) {
      pushRouteParamValue(normalized, key, next)
    }
  }
  return normalized
}

export function normalizeHash(rawHash?: string): string {
  if (!rawHash) {
    return ''
  }
  return rawHash.startsWith('#') ? rawHash : `#${rawHash}`
}

export function parseQuery(search: string): LocationQuery {
  const normalizedSearch = search.startsWith('?') ? search.slice(1) : search
  const query: LocationQuery = {}

  if (!normalizedSearch) {
    return query
  }

  for (const segment of normalizedSearch.split('&')) {
    if (!segment) {
      continue
    }

    const equalIndex = segment.indexOf('=')
    const rawKey = equalIndex >= 0 ? segment.slice(0, equalIndex) : segment
    if (!rawKey) {
      continue
    }

    const key = decodeQuerySegment(rawKey)
    const value = equalIndex >= 0
      ? decodeQuerySegment(segment.slice(equalIndex + 1))
      : null

    pushQueryValue(query, key, value)
  }

  return query
}

export function stringifyQuery(query: LocationQueryRaw | LocationQuery = {}): string {
  const normalizedQuery = normalizeQuery(query)
  const segments: string[] = []

  for (const key of Object.keys(normalizedQuery)) {
    const encodedKey = encodeQuerySegment(key)
    const rawValue = normalizedQuery[key]

    if (Array.isArray(rawValue)) {
      for (const item of rawValue) {
        if (item === null) {
          segments.push(encodedKey)
        }
        else {
          segments.push(`${encodedKey}=${encodeQuerySegment(item)}`)
        }
      }
      continue
    }

    if (rawValue === null) {
      segments.push(encodedKey)
      continue
    }

    segments.push(`${encodedKey}=${encodeQuerySegment(rawValue)}`)
  }

  return segments.join('&')
}
