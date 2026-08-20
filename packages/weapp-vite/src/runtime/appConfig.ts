import type { MpPlatform, WeappBuildScopeConfig, WeappRouteRules } from '../types'
import type { BuildScopeAppJson } from './buildScope'
import { applyPreloadRulesToAppJson, normalizeAppJson } from '../utils'
import { applyBuildScopeToAppConfig, resolveBuildScope } from './buildScope'

export interface AppConfigBuildOptions {
  buildScope?: WeappBuildScopeConfig
  platform?: MpPlatform
  routeRules?: WeappRouteRules
}

export function finalizeAppConfigForBuild(
  config: Record<string, any>,
  options: AppConfigBuildOptions,
) {
  const normalizedConfig = normalizeAppJson(config) as BuildScopeAppJson
  return applyBuildScopeToAppConfig(
    applyPreloadRulesToAppJson(
      normalizedConfig,
      options.routeRules,
      options.platform,
    ),
    resolveBuildScope(options.buildScope),
  )
}
