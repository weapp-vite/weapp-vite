import type { RouteResolveCodec } from '../routerInternal/shared'
import type { RouteLocationNormalizedLoaded, RouteLocationRaw } from './types'
import {
  createRouteLocation,
  normalizeHash,
  normalizeQuery,
  normalizeRouteParams,
  parsePathInput,
  parseQuery,
  resolvePath,
  stringifyQuery,
} from '../routerInternal/shared'

export const DEFAULT_ROUTE_RESOLVE_CODEC: RouteResolveCodec = {
  parseQuery,
  stringifyQuery,
}

export function resolveRouteLocation(
  to: RouteLocationRaw,
  currentPath = '',
  codec: RouteResolveCodec = DEFAULT_ROUTE_RESOLVE_CODEC,
): RouteLocationNormalizedLoaded {
  if (typeof to === 'string') {
    const parsed = parsePathInput(to, codec)
    const path = resolvePath(parsed.path, currentPath)
    return createRouteLocation(path, parsed.query, parsed.hash, undefined, {}, codec.stringifyQuery)
  }

  const parsedFromFullPath = typeof to.fullPath === 'string'
    ? parsePathInput(to.fullPath, codec)
    : undefined

  const rawPath = to.path ?? parsedFromFullPath?.path ?? currentPath
  const path = resolvePath(rawPath, currentPath)
  const query = to.query
    ? normalizeQuery(to.query)
    : parsedFromFullPath?.query ?? {}
  const hash = normalizeHash(to.hash ?? parsedFromFullPath?.hash)
  const name = typeof to.name === 'string' ? to.name : undefined
  const params = to.params
    ? normalizeRouteParams(to.params)
    : {}

  return createRouteLocation(path, query, hash, name, params, codec.stringifyQuery)
}
