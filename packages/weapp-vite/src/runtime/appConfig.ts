import type { MpPlatform, WeappBuildScopeConfig, WeappRouteRules, WeappSubPackageConfig } from '../types'
import type { BuildScopeAppJson } from './buildScope'
import { applyPreloadRulesToAppJson, normalizeAppJson } from '../utils'
import { normalizeRoot } from '../utils/path'
import { applyBuildScopeToAppConfig, resolveBuildScope } from './buildScope'

export interface AppConfigBuildOptions {
  buildScope?: WeappBuildScopeConfig
  platform?: MpPlatform
  routeRules?: WeappRouteRules
  subPackages?: Record<string, WeappSubPackageConfig>
}

export function resolveSubPackageIndependent(
  subPackage: { independent?: boolean },
  config: WeappSubPackageConfig | undefined,
) {
  return subPackage.independent ?? config?.independent
}

export function finalizeAppConfigForBuild<T extends object>(
  config: T,
  options: AppConfigBuildOptions,
): T {
  const normalizedConfig = normalizeAppJson(config) as BuildScopeAppJson
  const subPackageConfigs = new Map(
    Object.entries(options.subPackages ?? {}).map(([root, value]) => [normalizeRoot(root), value]),
  )
  if (Array.isArray(normalizedConfig?.subPackages)) {
    normalizedConfig.subPackages = normalizedConfig.subPackages.map((subPackage) => {
      const independent = resolveSubPackageIndependent(subPackage, subPackageConfigs.get(normalizeRoot(subPackage.root ?? '')))
      return independent === undefined ? subPackage : { ...subPackage, independent }
    })
  }
  const finalizedConfig = applyBuildScopeToAppConfig(
    applyPreloadRulesToAppJson(
      normalizedConfig,
      options.routeRules,
      options.platform,
    ),
    resolveBuildScope(options.buildScope),
  )
  return finalizedConfig as T
}
