import type { PreloadPage, PreloadRuleAppJson, PreloadRuleSuggestions } from '../../utils/preloadRule'
import type { AnalyzeSubpackagesResult } from '../subpackages'
import {
  findPreloadRuleKey,
  resolvePreloadPackageIdentifier,
} from '../../utils/preloadRule'

const PRELOAD_LIMIT_BYTES = 2 * 1024 * 1024

export interface PreloadAnalyzeBudgetTarget {
  packageRoot: string
  bytes?: number
  configured: boolean
  suggested: boolean
}

export interface PreloadAnalyzeBudget {
  sourcePackage: string
  sourceType: 'main' | 'subpackage' | 'independent'
  limitBytes: number
  estimatedBytes: number
  remainingBytes?: number
  status: 'ok' | 'unknown' | 'exceeded'
  targets: PreloadAnalyzeBudgetTarget[]
  unknownPackages: string[]
}

function createPackageSizeMap(result?: AnalyzeSubpackagesResult) {
  return new Map((result?.packages ?? []).map(pkg => [
    pkg.id,
    pkg.files.reduce((total, file) => total + (file.size ?? 0), 0),
  ]))
}

function getConfiguredPackages(rule: unknown, appJson: PreloadRuleAppJson) {
  if (!rule || typeof rule !== 'object' || !('packages' in rule)) {
    return []
  }
  const packages = (rule as { packages?: unknown }).packages
  if (!Array.isArray(packages)) {
    return []
  }
  return packages.flatMap(item => typeof item === 'string'
    ? [resolvePreloadPackageIdentifier(item, appJson)]
    : []).filter((item): item is string => Boolean(item))
}

export function createPreloadBudgets(
  appJson: PreloadRuleAppJson,
  result: PreloadRuleSuggestions,
  configuredRules: Record<string, unknown>,
  packageAnalysis?: AnalyzeSubpackagesResult,
) {
  const packageSizes = createPackageSizeMap(packageAnalysis)
  const bySourcePackage = new Map<string, {
    sourceType: PreloadAnalyzeBudget['sourceType']
    targets: Map<string, { configured: boolean, suggested: boolean }>
  }>()

  const ensureSourcePackage = (page: PreloadPage) => {
    const sourcePackage = page.packageRoot ?? '__main__'
    let entry = bySourcePackage.get(sourcePackage)
    if (!entry) {
      entry = {
        sourceType: page.packageRoot
          ? page.independent ? 'independent' : 'subpackage'
          : 'main',
        targets: new Map(),
      }
      bySourcePackage.set(sourcePackage, entry)
    }
    return entry
  }

  for (const page of result.pages) {
    const configuredKey = findPreloadRuleKey(page.route, configuredRules)
    if (configuredKey === undefined) {
      continue
    }
    const entry = ensureSourcePackage(page)
    for (const packageRoot of getConfiguredPackages(configuredRules[configuredKey], appJson)) {
      const target = entry.targets.get(packageRoot) ?? { configured: false, suggested: false }
      target.configured = true
      entry.targets.set(packageRoot, target)
    }
  }

  const pageByRoute = new Map(result.pages.map(page => [page.route, page]))
  for (const suggestion of result.suggestions) {
    const page = pageByRoute.get(suggestion.page)
    if (!page) {
      continue
    }
    const entry = ensureSourcePackage(page)
    const target = entry.targets.get(suggestion.packageRoot) ?? { configured: false, suggested: false }
    target.suggested = true
    entry.targets.set(suggestion.packageRoot, target)
  }

  return [...bySourcePackage.entries()].map(([sourcePackage, entry]) => {
    const targets = [...entry.targets.entries()].map(([packageRoot, state]) => {
      const packageId = packageRoot === '__APP__' ? '__main__' : packageRoot
      return {
        packageRoot,
        bytes: packageSizes.get(packageId),
        ...state,
      }
    }).sort((left, right) => left.packageRoot.localeCompare(right.packageRoot))
    const unknownPackages = targets.filter(target => target.bytes === undefined).map(target => target.packageRoot)
    const estimatedBytes = targets.reduce((total, target) => total + (target.bytes ?? 0), 0)
    const status = estimatedBytes > PRELOAD_LIMIT_BYTES
      ? 'exceeded' as const
      : unknownPackages.length > 0
        ? 'unknown' as const
        : 'ok' as const
    return {
      sourcePackage,
      sourceType: entry.sourceType,
      limitBytes: PRELOAD_LIMIT_BYTES,
      estimatedBytes,
      remainingBytes: unknownPackages.length === 0
        ? Math.max(0, PRELOAD_LIMIT_BYTES - estimatedBytes)
        : undefined,
      status,
      targets,
      unknownPackages,
    }
  }).sort((left, right) => left.sourcePackage.localeCompare(right.sourcePackage))
}
