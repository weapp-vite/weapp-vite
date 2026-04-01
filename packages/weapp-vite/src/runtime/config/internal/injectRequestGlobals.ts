import type { PackageJson } from 'pkg-types'
import type { WeappInjectRequestGlobalsConfig, WeappInjectRequestGlobalsTarget } from '../../../types'
import fs from 'node:fs'
import path from 'pathe'
import { PACKAGE_ROOT } from '../../../packagePaths'

const FULL_REQUEST_GLOBAL_TARGETS: WeappInjectRequestGlobalsTarget[] = [
  'fetch',
  'Headers',
  'Request',
  'Response',
  'AbortController',
  'AbortSignal',
  'XMLHttpRequest',
]

const ABORT_REQUEST_GLOBAL_TARGETS: WeappInjectRequestGlobalsTarget[] = [
  'AbortController',
  'AbortSignal',
]

const DEFAULT_REQUEST_GLOBAL_DEPENDENCIES = ['axios', 'graphql-request']
const DEFAULT_ABORT_GLOBAL_DEPENDENCIES = ['@tanstack/query-core', '@tanstack/vue-query']

export interface InjectRequestGlobalsAutoRule {
  dependencyPatterns: (string | RegExp)[]
  targets: WeappInjectRequestGlobalsTarget[]
}

export interface ResolvedInjectRequestGlobalsOptions {
  mode: 'auto' | 'explicit'
  targets: WeappInjectRequestGlobalsTarget[]
  dependencyPatterns?: (string | RegExp)[]
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

  return [...FULL_REQUEST_GLOBAL_TARGETS]
}

function resolveDependencyPatterns(config?: boolean | WeappInjectRequestGlobalsConfig) {
  if (config && typeof config === 'object' && Array.isArray(config.dependencies) && config.dependencies.length > 0) {
    return config.dependencies
  }

  return DEFAULT_REQUEST_GLOBAL_DEPENDENCIES
}

function hasCustomAutoRuleConfig(config?: boolean | WeappInjectRequestGlobalsConfig) {
  if (!config || typeof config !== 'object') {
    return false
  }

  return Boolean(
    (Array.isArray(config.dependencies) && config.dependencies.length > 0)
    || (Array.isArray(config.targets) && config.targets.length > 0),
  )
}

function resolveAutoRules(config?: boolean | WeappInjectRequestGlobalsConfig): InjectRequestGlobalsAutoRule[] {
  if (hasCustomAutoRuleConfig(config)) {
    return [{
      dependencyPatterns: resolveDependencyPatterns(config),
      targets: resolveTargets(config),
    }]
  }

  return [
    {
      dependencyPatterns: DEFAULT_REQUEST_GLOBAL_DEPENDENCIES,
      targets: [...FULL_REQUEST_GLOBAL_TARGETS],
    },
    {
      dependencyPatterns: DEFAULT_ABORT_GLOBAL_DEPENDENCIES,
      targets: [...ABORT_REQUEST_GLOBAL_TARGETS],
    },
  ]
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

  const autoRules = resolveAutoRules(config)
  const matchedTargets = new Set<WeappInjectRequestGlobalsTarget>()
  for (const rule of autoRules) {
    if (!hasMatchedDependency(packageJson, rule.dependencyPatterns)) {
      continue
    }
    for (const target of rule.targets) {
      matchedTargets.add(target)
    }
  }

  if (matchedTargets.size === 0) {
    return null
  }

  return {
    mode: 'auto',
    targets: [...matchedTargets],
  }
}

function resolveRequestGlobalsRuntimeModuleId() {
  const candidates = [
    path.resolve(PACKAGE_ROOT, 'dist/requestGlobals.mjs'),
    path.resolve(PACKAGE_ROOT, 'src/requestGlobals.ts'),
    path.resolve(PACKAGE_ROOT, 'src/runtime/requestGlobals/index.ts'),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  throw new Error('无法定位 request globals runtime 模块，请先构建 weapp-vite 包。')
}

/**
 * @description 生成入口文件用的请求全局对象注入代码。
 */
export function createInjectRequestGlobalsCode(targets: WeappInjectRequestGlobalsTarget[]) {
  const runtimeModuleId = resolveRequestGlobalsRuntimeModuleId()
  return [
    `import { installRequestGlobals as __weappViteInstallRequestGlobals } from ${JSON.stringify(runtimeModuleId)}`,
    `__weappViteInstallRequestGlobals({ targets: ${JSON.stringify(targets)} })`,
    '',
  ].join('\n')
}
