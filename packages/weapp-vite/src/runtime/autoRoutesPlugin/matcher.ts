import type { WeappAutoRoutesInclude, WeappAutoRoutesIncludePattern } from '../../types'
import path from 'pathe'
import picomatch from 'picomatch'
import { normalizePath, toPosixPath } from '../../utils/path'

export const DEFAULT_AUTO_ROUTE_INCLUDE = ['pages/**', '**/pages/**'] as const

interface AutoRoutesRule {
  pattern: WeappAutoRoutesIncludePattern
  match: (candidate: string) => boolean
}

const GLOB_MAGIC_PATTERN = /[*?[\]{}()!]/
const RELATIVE_PREFIX_PATTERN = /^\.?\//
const LEADING_SLASH_PATTERN = /^\/+/

function toArray(include?: WeappAutoRoutesInclude): WeappAutoRoutesIncludePattern[] {
  if (include == null) {
    return [...DEFAULT_AUTO_ROUTE_INCLUDE]
  }

  return Array.isArray(include)
    ? [...include]
    : [include]
}

function normalizeRuleCandidate(candidate: string) {
  return toPosixPath(candidate.replace(RELATIVE_PREFIX_PATTERN, '').replace(LEADING_SLASH_PATTERN, ''))
}

function createRule(pattern: WeappAutoRoutesIncludePattern): AutoRoutesRule {
  if (pattern instanceof RegExp) {
    return {
      pattern,
      match(candidate) {
        pattern.lastIndex = 0
        return pattern.test(candidate)
      },
    }
  }

  const matcher = picomatch(pattern, { dot: true })
  return {
    pattern,
    match: matcher,
  }
}

function isDefaultAutoRouteInclude(include: readonly WeappAutoRoutesIncludePattern[]) {
  return include.length === DEFAULT_AUTO_ROUTE_INCLUDE.length
    && include.every((pattern, index) => pattern === DEFAULT_AUTO_ROUTE_INCLUDE[index])
}

function extractStaticPrefix(pattern: string) {
  const normalized = normalizeRuleCandidate(pattern)
  if (!normalized) {
    return undefined
  }

  const segments = normalized.split('/')
  const staticSegments: string[] = []

  for (const segment of segments) {
    if (!segment || GLOB_MAGIC_PATTERN.test(segment)) {
      break
    }
    staticSegments.push(segment)
  }

  if (staticSegments.length === 0) {
    return undefined
  }

  return staticSegments.join('/')
}

export interface AutoRoutesMatcher {
  include: WeappAutoRoutesIncludePattern[]
  isDefault: boolean
  matches: (candidate: string) => boolean
  matchesRelativePath: (relativePath: string) => boolean
  getSearchRoots: (absoluteSrcRoot: string) => string[]
  getWatchRoots: (absoluteSrcRoot: string) => string[]
}

export function createAutoRoutesMatcher(include?: WeappAutoRoutesInclude): AutoRoutesMatcher {
  const normalizedInclude = toArray(include)
  const rules = normalizedInclude.map(createRule)
  const isDefault = isDefaultAutoRouteInclude(normalizedInclude)

  function matches(candidate: string) {
    const normalizedCandidate = normalizeRuleCandidate(candidate)
    if (!normalizedCandidate) {
      return false
    }

    return rules.some(rule => rule.match(normalizedCandidate))
  }

  function getRoots(absoluteSrcRoot: string) {
    if (isDefault) {
      return [path.join(absoluteSrcRoot, 'pages')]
    }

    const roots = new Set<string>()

    for (const rule of rules) {
      if (rule.pattern instanceof RegExp) {
        roots.add(absoluteSrcRoot)
        continue
      }

      const prefix = extractStaticPrefix(rule.pattern)
      if (!prefix) {
        roots.add(absoluteSrcRoot)
        continue
      }

      roots.add(path.resolve(absoluteSrcRoot, prefix))
    }

    if (roots.size === 0) {
      roots.add(absoluteSrcRoot)
    }

    return Array.from(roots, root => normalizePath(root))
  }

  return {
    include: normalizedInclude,
    isDefault,
    matches,
    matchesRelativePath(relativePath) {
      return matches(relativePath)
    },
    getSearchRoots(absoluteSrcRoot) {
      return getRoots(absoluteSrcRoot)
    },
    getWatchRoots(absoluteSrcRoot) {
      return getRoots(absoluteSrcRoot)
    },
  }
}
