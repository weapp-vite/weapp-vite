import type { App as AppJson } from '@weapp-core/schematics'
import type { WeappBuildScopeConfig } from '../types'
import type { AutoRoutes } from '../types/routes'
import { normalizeRoot } from '../utils/path'

export interface ResolvedBuildScope {
  enabled: boolean
  includeMainPackage: boolean
  subPackageRoots: string[]
  source: 'cli' | 'config'
}

type BuildScopeSubPackage = NonNullable<AppJson['subPackages']>[number]

export type BuildScopeAppJson = AppJson & {
  subpackages?: BuildScopeSubPackage[]
  subPackages?: BuildScopeSubPackage[]
  preloadRule?: Record<string, unknown>
}

const MAIN_SCOPE_TOKEN = 'main'
const BUILD_SCOPE_CLI_SOURCE = '__weappViteBuildScopeSource'

function normalizeScopeRoot(value: string) {
  return normalizeRoot(value.trim())
}

function parseScopeTokens(value: string | string[] | undefined) {
  const rawTokens = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  const tokens = rawTokens
    .map(token => normalizeScopeRoot(token))
    .filter(token => token.length > 0)
  return [...new Set(tokens)]
}

function normalizeBuildScopeConfig(
  config: WeappBuildScopeConfig | undefined,
  source: ResolvedBuildScope['source'],
): ResolvedBuildScope | undefined {
  if (!config) {
    return undefined
  }

  if (typeof config === 'string' || Array.isArray(config)) {
    const tokens = parseScopeTokens(config)
    if (tokens.length === 0) {
      return undefined
    }
    return {
      enabled: true,
      includeMainPackage: true,
      subPackageRoots: tokens.filter(token => token !== MAIN_SCOPE_TOKEN),
      source,
    }
  }

  const include = parseScopeTokens(config.include)
  const includeMainPackage = config.includeMainPackage ?? true
  const subPackageRoots = include.filter(token => token !== MAIN_SCOPE_TOKEN)
  if (!includeMainPackage && subPackageRoots.length === 0) {
    return undefined
  }

  return {
    enabled: true,
    includeMainPackage,
    subPackageRoots,
    source: (config as Record<string, unknown>)[BUILD_SCOPE_CLI_SOURCE] === true ? 'cli' : source,
  }
}

export function resolveBuildScope(config: WeappBuildScopeConfig | undefined) {
  return normalizeBuildScopeConfig(config, 'config')
}

export function createBuildScopeConfigFromCli(value: string | undefined): WeappBuildScopeConfig | undefined {
  const tokens = parseScopeTokens(value)
  if (tokens.length === 0) {
    return undefined
  }
  return {
    includeMainPackage: true,
    include: tokens.filter(token => token !== MAIN_SCOPE_TOKEN),
    [BUILD_SCOPE_CLI_SOURCE]: true,
  }
}

export function resolveBuildScopeFromCli(value: string | undefined) {
  return normalizeBuildScopeConfig(createBuildScopeConfigFromCli(value), 'cli')
}

function isSubPackageInScope(subPackage: { root?: string }, roots: ReadonlySet<string>) {
  const root = subPackage.root ? normalizeRoot(subPackage.root) : undefined
  return Boolean(root && roots.has(root))
}

function normalizeScopedSubPackage<T extends { root?: string, pages?: string[] }>(subPackage: T): T & { root: string, pages: string[] } {
  return {
    ...subPackage,
    root: normalizeRoot(subPackage.root ?? ''),
    pages: Array.isArray(subPackage.pages) ? subPackage.pages : [],
  }
}

function filterPreloadRule(
  preloadRule: Record<string, unknown> | undefined,
  scopedPages: ReadonlySet<string>,
  scopedPackageIdentifiers: ReadonlySet<string>,
  includeMainPackage: boolean,
) {
  if (!preloadRule || typeof preloadRule !== 'object') {
    return preloadRule
  }

  const scopedPreloadRule: Record<string, unknown> = {}
  for (const [pagePath, rule] of Object.entries(preloadRule)) {
    const normalizedPagePath = normalizeRoot(pagePath)
    if (!scopedPages.has(normalizedPagePath)) {
      continue
    }

    if (!rule || typeof rule !== 'object' || !('packages' in rule)) {
      scopedPreloadRule[pagePath] = rule
      continue
    }

    const packages = (rule as { packages?: unknown }).packages
    if (!Array.isArray(packages)) {
      scopedPreloadRule[pagePath] = rule
      continue
    }

    const filteredPackages = packages.filter((packageRoot) => {
      if (typeof packageRoot !== 'string') {
        return false
      }
      const normalizedPackageRoot = normalizeRoot(packageRoot)
      return normalizedPackageRoot === '__APP__'
        ? includeMainPackage
        : scopedPackageIdentifiers.has(normalizedPackageRoot)
    })
    if (filteredPackages.length > 0) {
      scopedPreloadRule[pagePath] = {
        ...rule,
        packages: filteredPackages,
      }
    }
  }

  return Object.keys(scopedPreloadRule).length > 0 ? scopedPreloadRule : undefined
}

function collectScopedAppGraph(
  pages: string[],
  subPackages: BuildScopeSubPackage[],
) {
  const mainPages = new Set(pages.map(page => normalizeRoot(page)))
  const allPages = new Set(mainPages)
  const packageIdentifiers = new Set<string>()

  for (const subPackage of subPackages) {
    const root = normalizeRoot(subPackage.root ?? '')
    if (!root) {
      continue
    }
    packageIdentifiers.add(root)
    if (typeof subPackage.name === 'string' && subPackage.name.trim()) {
      packageIdentifiers.add(normalizeRoot(subPackage.name))
    }
    for (const page of subPackage.pages ?? []) {
      allPages.add(normalizeRoot(`${root}/${page}`))
    }
  }

  return {
    allPages,
    mainPages,
    packageIdentifiers,
  }
}

function filterTabBar(tabBar: AppJson['tabBar'], mainPages: ReadonlySet<string>) {
  if (!tabBar || !Array.isArray(tabBar.list)) {
    return tabBar
  }

  const list = tabBar.list.filter((item) => {
    return typeof item.pagePath === 'string' && mainPages.has(normalizeRoot(item.pagePath))
  })
  if (list.length < 2) {
    return undefined
  }

  return {
    ...tabBar,
    list,
  } as NonNullable<AppJson['tabBar']>
}

export function applyBuildScopeToAppConfig(
  config: BuildScopeAppJson,
  scope: ResolvedBuildScope | undefined,
) {
  if (!scope?.enabled) {
    return config
  }

  const scopedRoots = new Set(scope.subPackageRoots)
  const sourceSubPackages = Array.isArray(config.subPackages)
    ? config.subPackages
    : Array.isArray(config.subpackages)
      ? config.subpackages
      : []
  const scopedSubPackages = sourceSubPackages
    .filter(subPackage => isSubPackageInScope(subPackage, scopedRoots))
    .map(normalizeScopedSubPackage)

  config.pages = scope.includeMainPackage && Array.isArray(config.pages)
    ? config.pages
    : []
  ;(config as { subPackages: BuildScopeSubPackage[] }).subPackages = scopedSubPackages
  delete config.subpackages

  const scopedGraph = collectScopedAppGraph(config.pages, scopedSubPackages)
  const preloadRule = filterPreloadRule(
    config.preloadRule,
    scopedGraph.allPages,
    scopedGraph.packageIdentifiers,
    scope.includeMainPackage,
  )
  if (preloadRule) {
    config.preloadRule = preloadRule
  }
  else {
    delete config.preloadRule
  }

  const tabBar = filterTabBar(config.tabBar, scopedGraph.mainPages)
  if (tabBar) {
    config.tabBar = tabBar
  }
  else {
    delete config.tabBar
  }

  if (
    typeof config.entryPagePath === 'string'
    && !scopedGraph.mainPages.has(normalizeRoot(config.entryPagePath))
  ) {
    delete config.entryPagePath
  }

  return config
}

export function applyBuildScopeToAutoRoutes(
  routes: AutoRoutes,
  scope: ResolvedBuildScope | undefined,
) {
  if (!scope?.enabled) {
    return routes
  }

  const scopedRoots = new Set(scope.subPackageRoots)
  const subPackages = routes.subPackages
    .filter(subPackage => scopedRoots.has(normalizeRoot(subPackage.root)))
    .map(subPackage => ({
      ...subPackage,
      root: normalizeRoot(subPackage.root),
    }))
  const scopedEntries = new Set([
    ...scope.includeMainPackage ? routes.pages : [],
    ...subPackages.flatMap(subPackage => subPackage.pages.map(page => `${subPackage.root}/${page}`)),
  ])

  return {
    pages: scope.includeMainPackage ? routes.pages : [],
    entries: routes.entries.filter(entry => scopedEntries.has(entry)),
    subPackages,
  }
}
