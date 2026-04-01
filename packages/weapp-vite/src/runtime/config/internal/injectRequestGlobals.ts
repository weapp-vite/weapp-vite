import type { PackageJson } from 'pkg-types'
import type { WeappInjectRequestGlobalsConfig, WeappInjectRequestGlobalsTarget } from '../../../types'
import { parse as parseSfc } from 'vue/compiler-sfc'

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
const REQUEST_GLOBAL_FREE_BINDING_TARGETS = new Set([
  ...FULL_REQUEST_GLOBAL_TARGETS,
  'URL',
  'URLSearchParams',
  'Blob',
  'FormData',
])

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
  return 'weapp-vite/requestGlobals'
}

function resolveRequestGlobalsBindingTargets(targets: WeappInjectRequestGlobalsTarget[]) {
  const bindingTargets = [...targets]
  const needsUrlGlobals = targets.some(target => (
    target === 'fetch'
    || target === 'Request'
    || target === 'Response'
    || target === 'XMLHttpRequest'
  ))

  if (needsUrlGlobals) {
    bindingTargets.push('URL', 'URLSearchParams', 'Blob', 'FormData')
  }

  return [...new Set(bindingTargets)].filter(target => REQUEST_GLOBAL_FREE_BINDING_TARGETS.has(target))
}

/**
 * @description 生成入口文件用的请求全局对象注入代码。
 */
export function createInjectRequestGlobalsCode(
  targets: WeappInjectRequestGlobalsTarget[],
  options?: {
    localBindings?: boolean
  },
) {
  const runtimeModuleId = resolveRequestGlobalsRuntimeModuleId()
  const lines = [
    `import { installRequestGlobals as __weappViteInstallRequestGlobals } from ${JSON.stringify(runtimeModuleId)}`,
  ]

  if (options?.localBindings) {
    const bindingTargets = resolveRequestGlobalsBindingTargets(targets)
    lines.push(
      `const __weappViteRequestGlobalsHost__ = __weappViteInstallRequestGlobals({ targets: ${JSON.stringify(targets)} }) || globalThis`,
      ...bindingTargets.map(target => `var ${target} = __weappViteRequestGlobalsHost__.${target}`),
    )
  }
  else {
    lines.push(`__weappViteInstallRequestGlobals({ targets: ${JSON.stringify(targets)} })`)
  }

  lines.push('')
  return lines.join('\n')
}

/**
 * @description 为 Vue SFC 入口生成合法的请求全局注入脚本块。
 */
export function createInjectRequestGlobalsSfcCode(
  targets: WeappInjectRequestGlobalsTarget[],
  options?: {
    localBindings?: boolean
    setup?: boolean
  },
) {
  const scriptAttrs = options?.setup ? ' setup lang="ts"' : ' lang="ts"'
  return `<script${scriptAttrs}>\n${createInjectRequestGlobalsCode(targets, options)}</script>\n`
}

function injectCodeIntoSfcBlock(source: string, startOffset: number, injection: string) {
  return `${source.slice(0, startOffset)}${injection}${source.slice(startOffset)}`
}

/**
 * @description 将请求全局对象注入到现有 SFC 脚本块，避免生成额外的重复 `<script>`。
 */
export function injectRequestGlobalsIntoSfc(
  source: string,
  targets: WeappInjectRequestGlobalsTarget[],
  options?: {
    localBindings?: boolean
  },
) {
  if (targets.length === 0) {
    return source
  }

  const injection = createInjectRequestGlobalsCode(targets, options)
  const { descriptor, errors } = parseSfc(source, {
    filename: 'request-globals.vue',
    ignoreEmpty: false,
  })

  if (errors.length > 0) {
    return `${createInjectRequestGlobalsSfcCode(targets, options)}${source}`
  }

  const inlineScript = descriptor.script && !descriptor.script.src
    ? descriptor.script
    : undefined
  if (inlineScript) {
    return injectCodeIntoSfcBlock(source, inlineScript.loc.start.offset, injection)
  }

  const inlineScriptSetup = descriptor.scriptSetup && !descriptor.scriptSetup.src
    ? descriptor.scriptSetup
    : undefined
  if (inlineScriptSetup) {
    return injectCodeIntoSfcBlock(source, inlineScriptSetup.loc.start.offset, injection)
  }

  if (!descriptor.script) {
    return `${createInjectRequestGlobalsSfcCode(targets, options)}${source}`
  }

  if (!descriptor.scriptSetup) {
    return `${createInjectRequestGlobalsSfcCode(targets, {
      ...options,
      setup: true,
    })}${source}`
  }

  return source
}
