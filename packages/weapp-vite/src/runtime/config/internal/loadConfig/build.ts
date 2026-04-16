import type { RolldownPluginOption } from 'rolldown'
import type { InlineConfig, PluginOption } from 'vite'
import type { LoadConfigResult } from '../../types'
import logger from '../../../../logger'
import { supportsMultiPlatformTarget } from '../../../../multiPlatform'
import { DEFAULT_MP_PLATFORM, normalizeMiniPlatform } from '../../../../platform'
import { createLibEntryFileNameResolver } from '../../../lib'
import { createLegacyEs5Plugin } from '../../legacyEs5'
import { getDefaultBuildTarget, isNonConcreteBuildTarget, sanitizeBuildTarget } from '../../targets'
import { formatProjectConfigPath, pluginMatchesName, resolveMultiPlatformConfig } from './shared'

export function resolveCliPlatformRuntime(cliPlatform?: string) {
  const normalizedCliPlatform = normalizeMiniPlatform(cliPlatform)
  const isWebRuntime = normalizedCliPlatform === 'h5' || normalizedCliPlatform === 'web'

  return {
    normalizedCliPlatform,
    isWebRuntime,
  }
}

export function resolveMultiPlatformProjectConfigHint(
  platform: string,
  projectConfigRoot = 'config',
) {
  return `${projectConfigRoot}/${platform}/project.config.json`
}

export function configureBuildAndPlugins(options: {
  config: InlineConfig
  pluginOnly: boolean
  oxcRolldownPlugin: RolldownPluginOption<any> | undefined
  oxcVitePlugin: PluginOption | undefined
  injectBuiltinAliases: (config: InlineConfig) => void
  resolvedLibConfig: LoadConfigResult['weappLib']
  cliPlatform?: string
  projectConfigPath?: string
  cwd: string
}) {
  const {
    config,
    pluginOnly,
    oxcRolldownPlugin,
    oxcVitePlugin,
    injectBuiltinAliases,
    resolvedLibConfig,
    cliPlatform,
    projectConfigPath,
    cwd,
  } = options

  const buildConfig = config.build ?? (config.build = {})
  const jsFormat = config.weapp?.jsFormat ?? 'cjs'
  const enableLegacyEs5 = config.weapp?.es5 === true
  if (enableLegacyEs5) {
    logger.warn('`weapp.es5` / `@swc/core` 降级方案已废弃，建议改为保持 `build.target >= es2020`，并在开发者工具中开启“将 JS 编译成 ES5”功能。')
  }

  if (resolvedLibConfig?.enabled && resolvedLibConfig.outDir) {
    buildConfig.outDir = resolvedLibConfig.outDir
  }

  if ('rollupOptions' in buildConfig) {
    delete (buildConfig as { rollupOptions?: unknown }).rollupOptions
  }

  if (enableLegacyEs5 && jsFormat !== 'cjs') {
    throw new Error('`weapp.es5` 仅支持在 `weapp.jsFormat` 为 "cjs" 时使用，请切换到 CommonJS 或关闭该选项。')
  }

  const originalTarget = buildConfig.target
  const targetInfo = sanitizeBuildTarget(originalTarget, { allowEs5: enableLegacyEs5 })
  if (enableLegacyEs5) {
    buildConfig.target = 'es2015'
  }
  else if (targetInfo.hasTarget && targetInfo.sanitized !== undefined) {
    const defaultTarget = getDefaultBuildTarget(config.weapp?.platform)
    const shouldUseDefaultForNonConcrete = Boolean(defaultTarget && isNonConcreteBuildTarget(originalTarget))
    buildConfig.target = shouldUseDefaultForNonConcrete ? defaultTarget : targetInfo.sanitized
  }
  else if (!targetInfo.hasTarget) {
    const defaultTarget = getDefaultBuildTarget(config.weapp?.platform)
    if (defaultTarget) {
      buildConfig.target = defaultTarget
    }
  }

  const rdOptions = buildConfig.rolldownOptions ?? (buildConfig.rolldownOptions = {})
  if (pluginOnly) {
    rdOptions.preserveEntrySignatures = 'exports-only'
  }
  if (Array.isArray(rdOptions.output)) {
    rdOptions.output = rdOptions.output.map(output => ({ ...output, format: jsFormat }))
  }
  else {
    const output = rdOptions.output ?? (rdOptions.output = {})
    output.format = jsFormat
  }

  if (resolvedLibConfig?.enabled) {
    const entryFileNames = createLibEntryFileNameResolver(resolvedLibConfig)
    if (entryFileNames) {
      if (Array.isArray(rdOptions.output)) {
        rdOptions.output = rdOptions.output.map(output => ({ ...output, entryFileNames }))
      }
      else {
        const output = rdOptions.output ?? (rdOptions.output = {})
        output.entryFileNames = entryFileNames
      }
    }
  }

  const rawPlugins = rdOptions.plugins
  const pluginArray: RolldownPluginOption<any>[] = rawPlugins == null
    ? []
    : Array.isArray(rawPlugins)
      ? [...rawPlugins]
      : [rawPlugins]

  if (enableLegacyEs5) {
    const swcPluginName = 'weapp-runtime:swc-es5-transform'
    const hasSwcPlugin = pluginArray.some(plugin => pluginMatchesName(plugin, swcPluginName))
    if (!hasSwcPlugin) {
      pluginArray.push(createLegacyEs5Plugin())
    }
  }

  if (pluginArray.length > 0) {
    rdOptions.plugins = pluginArray
  }

  if (oxcRolldownPlugin) {
    const rd = buildConfig.rolldownOptions ?? (buildConfig.rolldownOptions = {})
    const raw = rd.plugins
    const arr: RolldownPluginOption<any>[] = raw == null ? [] : Array.isArray(raw) ? [...raw] : [raw]
    rd.plugins = arr.includes(oxcRolldownPlugin) ? arr : [oxcRolldownPlugin, ...arr]
  }

  injectBuiltinAliases(config)
  if (oxcVitePlugin) {
    config.plugins ??= []
    config.plugins.unshift(oxcVitePlugin)
  }

  const platform = config.weapp?.platform ?? DEFAULT_MP_PLATFORM
  const multiPlatform = resolveMultiPlatformConfig(config.weapp?.multiPlatform)
  const {
    normalizedCliPlatform,
    isWebRuntime,
  } = resolveCliPlatformRuntime(cliPlatform)
  if (multiPlatform.enabled && !isWebRuntime && !normalizedCliPlatform) {
    throw new Error('已开启 weapp.multiPlatform，请通过 --platform 指定目标小程序平台，例如：weapp-vite dev -p weapp')
  }
  if (multiPlatform.enabled && !isWebRuntime && !supportsMultiPlatformTarget(multiPlatform, platform)) {
    throw new Error(`当前平台 "${platform}" 不在 weapp.multiPlatform.targets 配置中，可选平台：${multiPlatform.targets.join(', ')}`)
  }
  if (multiPlatform.enabled && !isWebRuntime && projectConfigPath) {
    const expectedPath = resolveMultiPlatformProjectConfigHint(
      platform,
      multiPlatform.projectConfigRoot,
    )
    throw new Error(`已开启 weapp.multiPlatform，--project-config 不再支持，请使用 ${formatProjectConfigPath(cwd, expectedPath)}`)
  }

  return {
    buildConfig,
    platform,
    multiPlatform,
    normalizedCliPlatform,
    isWebRuntime,
  }
}
