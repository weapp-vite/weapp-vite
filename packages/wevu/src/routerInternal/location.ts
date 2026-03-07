import type {
  LocationQuery,
  LocationQueryRaw,
  RouteLocationNormalizedLoaded,
  RouteParams,
  RouteQueryStringifier,
} from '../router'
import type { MiniProgramPageLike, RouteResolveCodec } from './types'
import { createAbsoluteRoutePath, resolvePath } from './path'
import { normalizeHash, normalizeQuery, parseQuery, stringifyQuery } from './query'

const DEFAULT_ROUTE_RESOLVE_CODEC: RouteResolveCodec = {
  parseQuery,
  stringifyQuery,
}

export function parsePathInput(
  input: string,
  codec: RouteResolveCodec = DEFAULT_ROUTE_RESOLVE_CODEC,
): { path: string, query: LocationQuery, hash: string } {
  const hashIndex = input.indexOf('#')
  const withoutHash = hashIndex >= 0 ? input.slice(0, hashIndex) : input
  const hash = hashIndex >= 0 ? normalizeHash(input.slice(hashIndex + 1)) : ''
  const queryIndex = withoutHash.indexOf('?')

  if (queryIndex < 0) {
    return {
      path: withoutHash,
      query: {},
      hash,
    }
  }

  return {
    path: withoutHash.slice(0, queryIndex),
    query: normalizeQuery(codec.parseQuery(withoutHash.slice(queryIndex + 1))),
    hash,
  }
}

export function createRouteLocation(
  path: string,
  query: LocationQuery,
  hash = '',
  name?: string,
  params: RouteParams = {},
  queryStringifier: RouteQueryStringifier = stringifyQuery,
): RouteLocationNormalizedLoaded {
  const normalizedPath = resolvePath(path, '')
  const queryString = queryStringifier(query)
  const fullPathBase = createAbsoluteRoutePath(normalizedPath)
  const normalizedHash = normalizeHash(hash)
  const fullPath = queryString ? `${fullPathBase}?${queryString}` : fullPathBase
  const location: RouteLocationNormalizedLoaded = {
    path: normalizedPath,
    fullPath: normalizedHash ? `${fullPath}${normalizedHash}` : fullPath,
    query,
    hash: normalizedHash,
    params,
  }
  if (name !== undefined) {
    location.name = name
  }

  return location
}

function getCurrentMiniProgramPage(): MiniProgramPageLike | undefined {
  const getCurrentPagesFn = (globalThis as Record<string, unknown>).getCurrentPages
  if (typeof getCurrentPagesFn !== 'function') {
    return undefined
  }

  try {
    const pages = getCurrentPagesFn() as MiniProgramPageLike[]
    if (!Array.isArray(pages) || pages.length === 0) {
      return undefined
    }
    return pages[pages.length - 1]
  }
  catch {
    return undefined
  }
}

export function resolveCurrentRoute(queryOverride?: LocationQueryRaw): RouteLocationNormalizedLoaded {
  const currentPage = getCurrentMiniProgramPage()
  if (!currentPage) {
    return createRouteLocation('', {})
  }

  const rawPath = typeof currentPage.route === 'string'
    ? currentPage.route
    : typeof currentPage.__route__ === 'string'
      ? currentPage.__route__
      : ''

  const querySource = queryOverride ?? ((currentPage.options ?? {}) as LocationQueryRaw)
  const query = normalizeQuery(querySource)
  return createRouteLocation(rawPath, query, '', undefined, {})
}
