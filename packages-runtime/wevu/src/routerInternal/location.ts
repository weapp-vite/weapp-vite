import type {
  LocationQuery,
  LocationQueryRaw,
  RouteLocationNormalizedLoaded,
  RouteParams,
  RouteQueryStringifier,
} from '../router'
import type { MiniProgramPageLike, RouteResolveCodec } from './types'
import { getCurrentMiniProgramPages } from '../runtime/platform'
import { getCurrentPageInstance } from '../runtime/register/component/lifecycle/platform'
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

function hasPageRoute(page: MiniProgramPageLike | undefined): page is MiniProgramPageLike {
  return (typeof page?.route === 'string' && page.route.length > 0)
    || (typeof page?.__route__ === 'string' && page.__route__.length > 0)
}

function getCurrentMiniProgramPage(fallbackPage?: MiniProgramPageLike): MiniProgramPageLike | undefined {
  const pages = getCurrentMiniProgramPages() as MiniProgramPageLike[]
  if (Array.isArray(pages) && pages.length > 0) {
    const currentPage = pages[pages.length - 1]
    if (hasPageRoute(currentPage)) {
      return currentPage
    }
  }

  const currentPageInstance = getCurrentPageInstance() as MiniProgramPageLike | undefined
  return hasPageRoute(currentPageInstance) ? currentPageInstance : fallbackPage
}

export function resolvePageRoute(
  page: MiniProgramPageLike | undefined,
  queryOverride?: LocationQueryRaw,
): RouteLocationNormalizedLoaded {
  if (!page) {
    return createRouteLocation('', {})
  }

  const rawPath = typeof page.route === 'string'
    ? page.route
    : typeof page.__route__ === 'string'
      ? page.__route__
      : ''

  const querySource = queryOverride ?? ((page.options ?? {}) as LocationQueryRaw)
  const query = normalizeQuery(querySource)
  return createRouteLocation(rawPath, query, '', undefined, {})
}

export function resolveCurrentRoute(
  queryOverride?: LocationQueryRaw,
  fallbackPage?: MiniProgramPageLike,
): RouteLocationNormalizedLoaded {
  const currentPage = getCurrentMiniProgramPage(fallbackPage)
  return resolvePageRoute(currentPage, queryOverride)
}
