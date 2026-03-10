import type {
  RouteLocationRaw,
  RouteParams,
  RouteParamsMode,
  RouteParamValue,
} from '../router'
import type {
  NamedRouteLookup,
  NamedRoutePathResolveResult,
  PathParamToken,
} from './types'
import { normalizeRouteParams } from './query'

const PATH_PARAM_TOKEN_RE = /^:(\w+)(?:\([^)]*\))?([+*?])?$/

export function parsePathParamToken(segment: string): PathParamToken | undefined {
  const match = PATH_PARAM_TOKEN_RE.exec(segment)
  if (!match) {
    return undefined
  }

  return {
    key: match[1],
    modifier: (match[2] ?? '') as PathParamToken['modifier'],
  }
}

function normalizePathParamValues(value: RouteParamValue | RouteParamValue[] | undefined): RouteParamValue[] {
  if (value === undefined) {
    return []
  }
  if (Array.isArray(value)) {
    return value
  }
  return [value]
}

function stringifyPathParamSegment(value: RouteParamValue): string {
  return encodeURIComponent(value)
}

export function decodeRouteParamSegment(value: string): string {
  try {
    return decodeURIComponent(value)
  }
  catch {
    return value
  }
}

function resolveNamedRoutePath(pathTemplate: string, params: RouteParams, routeName: string): NamedRoutePathResolveResult {
  const resolvedSegments: string[] = []
  const consumedKeys = new Set<string>()
  for (const rawSegment of pathTemplate.split('/')) {
    if (!rawSegment) {
      continue
    }

    const token = parsePathParamToken(rawSegment)
    if (!token) {
      resolvedSegments.push(rawSegment)
      continue
    }

    const values = normalizePathParamValues(params[token.key])
    if (token.modifier === '') {
      if (values.length !== 1) {
        throw new Error(`Missing required param "${token.key}" for named route "${routeName}"`)
      }
      consumedKeys.add(token.key)
      resolvedSegments.push(stringifyPathParamSegment(values[0]))
      continue
    }

    if (token.modifier === '?') {
      if (values.length === 0) {
        continue
      }
      if (values.length > 1) {
        throw new Error(`Param "${token.key}" for named route "${routeName}" must be a single value`)
      }
      consumedKeys.add(token.key)
      resolvedSegments.push(stringifyPathParamSegment(values[0]))
      continue
    }

    if (token.modifier === '+') {
      if (values.length === 0) {
        throw new Error(`Missing required repeatable param "${token.key}" for named route "${routeName}"`)
      }
      consumedKeys.add(token.key)
      for (const value of values) {
        resolvedSegments.push(stringifyPathParamSegment(value))
      }
      continue
    }

    if (values.length > 0) {
      consumedKeys.add(token.key)
    }
    for (const value of values) {
      resolvedSegments.push(stringifyPathParamSegment(value))
    }
  }

  return {
    path: resolvedSegments.join('/'),
    consumedKeys,
  }
}

function hasNonEmptyRouteParamValue(value: RouteParamValue | RouteParamValue[] | undefined): boolean {
  if (value === undefined) {
    return false
  }
  if (Array.isArray(value)) {
    return value.length > 0
  }
  return true
}

function assertNoUnexpectedNamedRouteParams(
  params: RouteParams,
  consumedKeys: ReadonlySet<string>,
  routeName: string,
) {
  const unexpectedKeys = Object.keys(params)
    .filter(key => !consumedKeys.has(key))
    .filter(key => hasNonEmptyRouteParamValue(params[key]))

  if (unexpectedKeys.length === 0) {
    return
  }

  throw new Error(`Unexpected params for named route "${routeName}": ${unexpectedKeys.join(', ')}`)
}

export function resolveNamedRouteLocation(
  to: Extract<RouteLocationRaw, Record<string, unknown>>,
  lookup: NamedRouteLookup,
  paramsMode: RouteParamsMode,
): Extract<RouteLocationRaw, Record<string, unknown>> {
  const routeName = to.name
  if (typeof routeName !== 'string' || !routeName) {
    return to
  }
  if (to.path !== undefined || to.fullPath !== undefined) {
    return to
  }

  const routeRecord = lookup.recordByName.get(routeName)
  if (!routeRecord) {
    throw new Error(`Named route "${routeName}" is not defined in useRouter({ routes | namedRoutes })`)
  }

  const params = to.params
    ? normalizeRouteParams(to.params)
    : {}
  const resolvedResult = resolveNamedRoutePath(routeRecord.path, params, routeName)
  if (paramsMode === 'strict') {
    assertNoUnexpectedNamedRouteParams(params, resolvedResult.consumedKeys, routeName)
  }

  return {
    ...to,
    path: resolvedResult.path ? `/${resolvedResult.path}` : '/',
    params,
  }
}
