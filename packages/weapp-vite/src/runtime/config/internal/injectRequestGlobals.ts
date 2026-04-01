import type { PackageJson } from 'pkg-types'
import type { WeappInjectRequestGlobalsConfig, WeappInjectRequestGlobalsTarget } from '../../../types'

const DEFAULT_REQUEST_GLOBAL_DEPENDENCIES = ['axios', 'graphql-request']

export interface ResolvedInjectRequestGlobalsOptions {
  mode: 'auto' | 'explicit'
  targets: WeappInjectRequestGlobalsTarget[]
  dependencyPatterns: (string | RegExp)[]
}

function hasMatchedDependency(
  packageJson: PackageJson | undefined,
  patterns: readonly (string | RegExp)[],
) {
  const dependencyNames = new Set<string>([
    ...Object.keys(packageJson?.dependencies ?? {}),
    ...Object.keys(packageJson?.devDependencies ?? {}),
    ...Object.keys(packageJson?.peerDependencies ?? {}),
  ])

  return [...dependencyNames].some((dependency) => {
    return patterns.some((pattern) => {
      if (typeof pattern === 'string') {
        return pattern === dependency
      }
      pattern.lastIndex = 0
      return pattern.test(dependency)
    })
  })
}

function resolveTargets(config?: boolean | WeappInjectRequestGlobalsConfig): WeappInjectRequestGlobalsTarget[] {
  if (config && typeof config === 'object' && Array.isArray(config.targets) && config.targets.length > 0) {
    return [...new Set(config.targets)]
  }

  return [
    'fetch',
    'Headers',
    'Request',
    'Response',
    'AbortController',
    'AbortSignal',
    'XMLHttpRequest',
  ]
}

function resolveDependencyPatterns(config?: boolean | WeappInjectRequestGlobalsConfig) {
  if (config && typeof config === 'object' && Array.isArray(config.dependencies) && config.dependencies.length > 0) {
    return config.dependencies
  }

  return DEFAULT_REQUEST_GLOBAL_DEPENDENCIES
}

/**
 * @description 解析按需注入请求相关全局对象的最终配置。
 */
export function resolveInjectRequestGlobalsOptions(
  config: boolean | WeappInjectRequestGlobalsConfig | undefined,
  packageJson: PackageJson | undefined,
): ResolvedInjectRequestGlobalsOptions | null {
  if (config === false) {
    return null
  }

  if (config && typeof config === 'object' && config.enabled === false) {
    return null
  }

  const enabled = config && typeof config === 'object'
    ? config.enabled
    : config

  if (enabled === true) {
    return {
      mode: 'explicit',
      targets: resolveTargets(config),
      dependencyPatterns: resolveDependencyPatterns(config),
    }
  }

  const dependencyPatterns = resolveDependencyPatterns(config)
  if (!hasMatchedDependency(packageJson, dependencyPatterns)) {
    return null
  }

  return {
    mode: 'auto',
    targets: resolveTargets(config),
    dependencyPatterns,
  }
}

/**
 * @description 生成入口文件用的请求全局对象注入代码。
 */
export function createInjectRequestGlobalsCode(targets: WeappInjectRequestGlobalsTarget[]) {
  return [
    'import { installRequestGlobals as __weappViteInstallRequestGlobals } from \'weapp-vite/runtime/requestGlobals\'',
    `__weappViteInstallRequestGlobals({ targets: ${JSON.stringify(targets)} })`,
    '',
  ].join('\n')
}
