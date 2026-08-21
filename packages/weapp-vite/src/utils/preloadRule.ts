import type { MpPlatform, WeappPreloadRule, WeappRouteRules } from '../types'
import { isObject } from '@weapp-core/shared'
import path from 'pathe'
import picomatch from 'picomatch'
import { normalizeRoot } from './path'
import { collectStaticRouteTargets } from './preloadScan'

export interface PreloadRuleAppJson {
  pages?: unknown
  subPackages?: unknown
  subpackages?: unknown
  preloadRule?: unknown
  [key: string]: unknown
}

export interface PreloadPage {
  route: string
  packageRoot?: string
  independent?: boolean
}

export interface PreloadRuleMatch {
  page: string
  rule: WeappPreloadRule
  pattern: string
}

const PRELOAD_RULE_GLOB_RE = /[*?[\]{}()!+@]/g

function normalizePagePath(value: string) {
  return normalizeRoot(value).replace(/^\/+/, '')
}

function normalizePackageRoot(value: string) {
  return normalizeRoot(value).replace(/^\/+|\/+$/g, '')
}

function normalizeRule(value: unknown, pattern: string) {
  if (!isObject(value)) {
    throw new TypeError(`routeRules.${pattern}.preload 必须是对象。`)
  }

  const packages = (value as { packages?: unknown }).packages
  if (!Array.isArray(packages) || packages.length === 0 || packages.some(item => typeof item !== 'string' || !item.trim())) {
    throw new TypeError(`routeRules.${pattern}.preload.packages 必须是非空字符串数组。`)
  }

  const network = (value as { network?: unknown }).network
  if (network !== undefined && network !== 'all' && network !== 'wifi') {
    throw new TypeError(`routeRules.${pattern}.preload.network 只能是 "all" 或 "wifi"。`)
  }

  const normalizedPackages = [...new Set(packages.map(item => normalizePackageRoot(item)).filter(Boolean))]
  if (normalizedPackages.length === 0) {
    throw new TypeError(`routeRules.${pattern}.preload.packages 必须包含有效的分包 root。`)
  }

  return {
    packages: normalizedPackages,
    ...(network === undefined ? {} : { network }),
  } satisfies WeappPreloadRule
}

function getRuleScore(pattern: string) {
  const segments = pattern.split('/').filter(Boolean)
  const wildcards = pattern.match(PRELOAD_RULE_GLOB_RE) ?? []
  PRELOAD_RULE_GLOB_RE.lastIndex = 0
  return [
    segments.filter((segment) => {
      PRELOAD_RULE_GLOB_RE.lastIndex = 0
      return !PRELOAD_RULE_GLOB_RE.test(segment)
    }).length,
    pattern.replace(PRELOAD_RULE_GLOB_RE, '').length,
    -wildcards.length,
    segments.length,
    pattern.length,
  ]
}

function compareScores(left: number[], right: number[]) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const leftValue = left[index] ?? 0
    const rightValue = right[index] ?? 0
    if (leftValue !== rightValue) {
      return leftValue > rightValue ? 1 : -1
    }
  }
  return 0
}

function pageCandidates(page: string) {
  const normalized = normalizePagePath(page)
  const withoutPagesPrefix = normalized.startsWith('pages/')
    ? normalized.slice('pages/'.length)
    : normalized
  const candidates = new Set<string>()
  for (const route of [normalized, withoutPagesPrefix]) {
    const withoutIndex = route.replace(/\/index$/, '') || route
    for (const value of [route, withoutIndex]) {
      candidates.add(value)
      candidates.add(`/${value}`)
    }
  }
  return [...candidates]
}

function findRouteRuleMatch(page: string, routeRules?: WeappRouteRules): PreloadRuleMatch | undefined {
  if (!routeRules) {
    return undefined
  }

  const candidates = pageCandidates(page)
  let matched: PreloadRuleMatch & { score: number[] } | undefined
  for (const [pattern, value] of Object.entries(routeRules)) {
    if (!value || value.preload === undefined) {
      continue
    }
    if (!candidates.some(candidate => picomatch(pattern)(candidate))) {
      continue
    }
    const rule = normalizeRule(value.preload, pattern)
    const score = getRuleScore(pattern)
    if (!matched || compareScores(score, matched.score) > 0) {
      matched = { page, rule, pattern, score }
    }
  }

  if (!matched) {
    return undefined
  }
  const { score: _score, ...result } = matched
  return result
}

function collectSubPackages(appJson: PreloadRuleAppJson) {
  const source = Array.isArray(appJson.subPackages)
    ? appJson.subPackages
    : Array.isArray(appJson.subpackages)
      ? appJson.subpackages
      : []
  return source.flatMap((item) => {
    if (!isObject(item) || typeof item.root !== 'string') {
      return []
    }
    const root = normalizePackageRoot(item.root)
    const pages = Array.isArray(item.pages)
      ? item.pages.filter((page): page is string => typeof page === 'string' && page.trim().length > 0)
      : []
    return pages.map(page => ({
      route: normalizePagePath(path.posix.join(root, page)),
      packageRoot: root,
      ...(item.independent === true ? { independent: true } : {}),
    }))
  })
}

export function collectPreloadPages(appJson: PreloadRuleAppJson): PreloadPage[] {
  const mainPages = Array.isArray(appJson.pages)
    ? appJson.pages
        .filter((page): page is string => typeof page === 'string' && page.trim().length > 0)
        .map(page => ({ route: normalizePagePath(page) }))
    : []
  return [...mainPages, ...collectSubPackages(appJson)]
}

export function findPreloadRuleKey(page: string, preloadRule: Record<string, unknown>) {
  const candidates = pageCandidates(page)
  const key = Object.keys(preloadRule).find(candidate => candidates.includes(normalizePagePath(candidate)))
  return key
}

export function resolvePreloadPackageIdentifier(
  value: string,
  appJson: PreloadRuleAppJson,
) {
  const normalized = value === '__APP__'
    ? value
    : normalizePackageRoot(value)
  if (!normalized || normalized === '__APP__') {
    return normalized || undefined
  }

  const source = Array.isArray(appJson.subPackages)
    ? appJson.subPackages
    : Array.isArray(appJson.subpackages)
      ? appJson.subpackages
      : []
  for (const item of source) {
    if (!isObject(item) || typeof item.root !== 'string') {
      continue
    }
    const root = normalizePackageRoot(item.root)
    if (root === normalized || (typeof item.name === 'string' && item.name === value)) {
      return root
    }
  }
  return normalized
}

function cloneRule(rule: unknown) {
  if (!isObject(rule)) {
    return rule
  }
  const packages = Array.isArray(rule.packages)
    ? rule.packages.filter((item): item is string => typeof item === 'string')
    : []
  return {
    ...rule,
    packages: [...packages],
  }
}

/**
 * @description 将 routeRules 中的 preload 声明合成为 app.json.preloadRule。
 * 手写的 preloadRule 保持优先，其他平台不生成微信专属字段。
 */
export function applyPreloadRulesToAppJson<T extends PreloadRuleAppJson>(
  appJson: T,
  routeRules: WeappRouteRules | undefined,
  platform: MpPlatform | undefined,
) {
  if (platform !== 'weapp' || !routeRules) {
    return appJson
  }

  const existing = isObject(appJson.preloadRule)
    ? appJson.preloadRule as Record<string, unknown>
    : {}
  const next = { ...existing }
  for (const page of collectPreloadPages(appJson)) {
    const match = findRouteRuleMatch(page.route, routeRules)
    if (!match || findPreloadRuleKey(page.route, existing) !== undefined) {
      continue
    }
    next[page.route] = cloneRule(match.rule)
  }

  if (Object.keys(next).length > 0) {
    appJson.preloadRule = next
  }
  return appJson
}

export interface PreloadRuleSuggestion {
  page: string
  packageRoot: string
  target: string
  source: 'template' | 'script'
}

export interface PreloadRuleSuggestions {
  pages: PreloadPage[]
  suggestions: PreloadRuleSuggestion[]
  uncovered: string[]
}

export function suggestPreloadRules(
  appJson: PreloadRuleAppJson,
  pageSources: ReadonlyMap<string, { template?: string, script?: string }>,
): PreloadRuleSuggestions {
  const pages = collectPreloadPages(appJson)
  const pageByRoute = new Map(pages.map(page => [page.route, page]))
  const suggestions: PreloadRuleSuggestion[] = []
  const uncovered = new Set<string>()

  for (const page of pages) {
    const source = pageSources.get(page.route)
    for (const kind of ['template', 'script'] as const) {
      for (const target of collectStaticRouteTargets(source?.[kind] ?? '', kind, page.route)) {
        const targetPage = pageByRoute.get(target)
        if (!targetPage) {
          continue
        }
        const packageRoot = targetPage.packageRoot ?? (page.independent ? '__APP__' : undefined)
        if (!packageRoot || packageRoot === page.packageRoot) {
          continue
        }
        const suggestion = { page: page.route, packageRoot, target, source: kind }
        suggestions.push(suggestion)
      }
    }
    if (source && !source.template && !source.script) {
      uncovered.add(page.route)
    }
  }

  return {
    pages,
    suggestions,
    uncovered: [...uncovered],
  }
}

export { findRouteRuleMatch }
