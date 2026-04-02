import type {
  RouteLocationNormalizedLoaded,
  RouteMeta,
  RouteParams,
} from '../router'
import type {
  MatchedRouteRecordResolveResult,
  NamedRouteLookup,
  RouteRecordNormalized,
} from './types'
import { decodeRouteParamSegment, parsePathParamToken } from './params'
import { isDynamicRoutePath } from './path'

function splitRoutePathSegments(path: string): string[] {
  return path.split('/').filter(Boolean)
}

function listRouteRecordMatchPaths(record: RouteRecordNormalized): readonly string[] {
  return [record.path, ...record.aliasPaths]
}

function resolveMatchedRouteRecordChain(
  record: RouteRecordNormalized,
  lookup: NamedRouteLookup,
): RouteRecordNormalized[] {
  const matchedRecords: RouteRecordNormalized[] = []
  const visitedNames = new Set<string>()
  let currentRecord: RouteRecordNormalized | undefined = record

  while (currentRecord) {
    if (visitedNames.has(currentRecord.name)) {
      break
    }
    visitedNames.add(currentRecord.name)
    matchedRecords.unshift(currentRecord)
    if (!currentRecord.parentName) {
      break
    }
    currentRecord = lookup.recordByName.get(currentRecord.parentName)
  }

  return matchedRecords
}

export function mergeMatchedRouteMeta(matchedRecords: readonly RouteRecordNormalized[]): RouteMeta | undefined {
  let mergedRouteMeta: RouteMeta | undefined
  for (const matchedRecord of matchedRecords) {
    if (!matchedRecord.meta) {
      continue
    }
    if (!mergedRouteMeta) {
      mergedRouteMeta = {}
    }
    Object.assign(mergedRouteMeta, matchedRecord.meta)
  }
  return mergedRouteMeta
}

export function collectRouteNamesForRemoval(
  routeName: string,
  recordByName: ReadonlyMap<string, RouteRecordNormalized>,
): Set<string> {
  const namesToRemove = new Set<string>()
  if (!recordByName.has(routeName)) {
    return namesToRemove
  }

  namesToRemove.add(routeName)
  let expanded = true
  while (expanded) {
    expanded = false
    for (const [name, record] of recordByName.entries()) {
      if (!record.parentName || namesToRemove.has(name)) {
        continue
      }
      if (namesToRemove.has(record.parentName)) {
        namesToRemove.add(name)
        expanded = true
      }
    }
  }

  return namesToRemove
}

function buildRouteParamsFromMatch(matchValues: ReadonlyMap<string, string[]>): RouteParams {
  const params: RouteParams = {}
  for (const [key, values] of matchValues.entries()) {
    if (values.length === 0) {
      continue
    }
    params[key] = values.length === 1 ? values[0] : values
  }
  return params
}

function matchRoutePathParams(pathTemplate: string, targetPath: string): RouteParams | undefined {
  const templateSegments = splitRoutePathSegments(pathTemplate)
  const targetSegments = splitRoutePathSegments(targetPath)
  const matchedValues = new Map<string, string[]>()

  const pushValue = (key: string, value: string) => {
    const previous = matchedValues.get(key)
    if (previous) {
      previous.push(value)
      return
    }
    matchedValues.set(key, [value])
  }

  const popValue = (key: string) => {
    const previous = matchedValues.get(key)
    if (!previous || previous.length === 0) {
      return
    }
    previous.pop()
    if (previous.length === 0) {
      matchedValues.delete(key)
    }
  }

  const consumeRepeatableToken = (key: string, startIndex: number, count: number): () => void => {
    for (let index = 0; index < count; index += 1) {
      pushValue(key, decodeRouteParamSegment(targetSegments[startIndex + index]))
    }
    return () => {
      for (let index = 0; index < count; index += 1) {
        popValue(key)
      }
    }
  }

  const matchRecursively = (templateIndex: number, targetIndex: number): boolean => {
    if (templateIndex >= templateSegments.length) {
      return targetIndex >= targetSegments.length
    }

    const templateSegment = templateSegments[templateIndex]
    const token = parsePathParamToken(templateSegment)
    if (!token) {
      if (targetIndex >= targetSegments.length || templateSegment !== targetSegments[targetIndex]) {
        return false
      }
      return matchRecursively(templateIndex + 1, targetIndex + 1)
    }

    if (token.modifier === '') {
      if (targetIndex >= targetSegments.length) {
        return false
      }
      pushValue(token.key, decodeRouteParamSegment(targetSegments[targetIndex]))
      const matched = matchRecursively(templateIndex + 1, targetIndex + 1)
      if (!matched) {
        popValue(token.key)
      }
      return matched
    }

    if (token.modifier === '?') {
      if (targetIndex < targetSegments.length) {
        pushValue(token.key, decodeRouteParamSegment(targetSegments[targetIndex]))
        const consumeMatched = matchRecursively(templateIndex + 1, targetIndex + 1)
        if (consumeMatched) {
          return true
        }
        popValue(token.key)
      }
      return matchRecursively(templateIndex + 1, targetIndex)
    }

    const minimumCount = token.modifier === '+' ? 1 : 0
    const maximumCount = targetSegments.length - targetIndex

    for (let count = maximumCount; count >= minimumCount; count -= 1) {
      const rollback = consumeRepeatableToken(token.key, targetIndex, count)
      const matched = matchRecursively(templateIndex + 1, targetIndex + count)
      if (matched) {
        return true
      }
      rollback()
    }

    return false
  }

  if (!matchRecursively(0, 0)) {
    return undefined
  }

  return buildRouteParamsFromMatch(matchedValues)
}

export function resolveMatchedRouteRecord(
  target: RouteLocationNormalizedLoaded,
  lookup: NamedRouteLookup,
): MatchedRouteRecordResolveResult | undefined {
  if (target.name) {
    const byName = lookup.recordByName.get(target.name)
    if (byName) {
      return {
        record: byName,
        matchedRecords: resolveMatchedRouteRecordChain(byName, lookup),
      }
    }
  }

  const staticNamedRoute = lookup.nameByStaticPath.get(target.path)
  if (staticNamedRoute) {
    const record = lookup.recordByName.get(staticNamedRoute)
    if (record) {
      return {
        record,
        matchedRecords: resolveMatchedRouteRecordChain(record, lookup),
        matchedPath: target.path,
      }
    }
  }

  for (const record of lookup.recordByName.values()) {
    for (const routePath of listRouteRecordMatchPaths(record)) {
      if (!isDynamicRoutePath(routePath)) {
        continue
      }
      const matchedParams = matchRoutePathParams(routePath, target.path)
      if (!matchedParams) {
        continue
      }
      return {
        record,
        matchedRecords: resolveMatchedRouteRecordChain(record, lookup),
        matchedPath: routePath,
        params: matchedParams,
      }
    }
  }

  return undefined
}
