import type { RolldownPluginOption } from 'rolldown'
import type { InlineConfig, PluginOption } from 'vite'
import type { AliasOptions } from '../../../types'
import type { LoadConfigOptions, LoadConfigResult } from '../types'
import { defu } from '@weapp-core/shared'
import path from 'pathe'
import tsconfigPaths from 'vite-tsconfig-paths'
import { getOutputExtensions, getWeappViteConfig } from '../../../defaults'
import { getAliasEntries } from '../../../utils'
import { hasLibEntry, resolveWeappLibConfig } from '../../lib'
import { hasDeprecatedEnhanceUsage, migrateEnhanceOptions } from '../enhance'
import { resolveWeappWebConfig } from '../web'
import { configureBuildAndPlugins, resolveCliPlatformRuntime } from './loadConfig/build'
import { loadProjectConfig, validateProjectConfigSources } from './loadConfig/projectConfig'
import { loadPackageJson } from './loadConfig/shared'
import { resolveConfigSource } from './loadConfig/source'
import { inspectTsconfigPathsUsage } from './tsconfigPaths'

export { resolveConfigFilePath, shouldReuseLoadedWeappConfig } from './loadConfig/source'

export interface LoadConfigFactoryOptions {
  injectBuiltinAliases: (config: InlineConfig) => void
  oxcRolldownPlugin: RolldownPluginOption<any> | undefined
  oxcVitePlugin: PluginOption | undefined
}

function injectDefaultSrcAlias(config: InlineConfig, cwd: string, srcRoot: string) {
  if (!srcRoot) {
    return
  }

  const resolve = config.resolve ?? (config.resolve = {})
  const currentAlias = resolve.alias
  const aliasArray = Array.isArray(currentAlias)
    ? currentAlias.filter((entry): entry is { find: string | RegExp, replacement: string } => {
        return Boolean(entry && typeof entry === 'object' && 'find' in entry && 'replacement' in entry)
      })
    : currentAlias
      ? Object.entries(currentAlias as Record<string, string>).map(([find, replacement]) => ({ find, replacement }))
      : []

  const hasAtAlias = aliasArray.some((entry) => {
    return typeof entry.find === 'string' && entry.find === '@'
  })
  if (hasAtAlias) {
    resolve.alias = aliasArray
    return
  }

  aliasArray.unshift({
    find: '@',
    replacement: path.resolve(cwd, srcRoot),
  })
  resolve.alias = aliasArray
}

function injectResolvedAliases(
  config: InlineConfig,
  aliases: Array<{ find: string, replacement: string }>,
) {
  if (aliases.length === 0) {
    return
  }

  const resolve = config.resolve ?? (config.resolve = {})
  const currentAlias = resolve.alias
  const aliasArray = Array.isArray(currentAlias)
    ? currentAlias.filter((entry): entry is { find: string | RegExp, replacement: string } => {
        return Boolean(entry && typeof entry === 'object' && 'find' in entry && 'replacement' in entry)
      })
    : currentAlias
      ? Object.entries(currentAlias as Record<string, string>).map(([find, replacement]) => ({ find, replacement }))
      : []

  for (const entry of aliases) {
    if (aliasArray.some(existing => typeof existing.find === 'string' && existing.find === entry.find)) {
      continue
    }
    aliasArray.unshift(entry)
  }

  resolve.alias = aliasArray
}

function mergeJsonAliasEntries(userAlias: AliasOptions | false | undefined) {
  if (userAlias === false) {
    return []
  }

  return getAliasEntries(userAlias)
}

function normalizeManagedPathAliasKey(key: string) {
  if (!key || (key.includes('*') && !key.endsWith('/*'))) {
    return undefined
  }
  return key.endsWith('/*') ? key.slice(0, -2) : key
}

function normalizeManagedPathAliasTarget(target: string) {
  if (!target || (target.includes('*') && !target.endsWith('/*'))) {
    return undefined
  }
  return target.endsWith('/*') ? target.slice(0, -2) : target
}

function collectManagedTsconfigAliases(config: InlineConfig, cwd: string) {
  const weappTypeScript = config.weapp?.typescript
  const pathSources = [
    weappTypeScript?.shared?.compilerOptions?.paths,
    weappTypeScript?.app?.compilerOptions?.paths,
  ]
  const aliasMap = new Map<string, string>()

  for (const pathsConfig of pathSources) {
    if (!pathsConfig || typeof pathsConfig !== 'object') {
      continue
    }

    for (const [key, value] of Object.entries(pathsConfig)) {
      const find = normalizeManagedPathAliasKey(key)
      const target = Array.isArray(value) ? value.find(item => typeof item === 'string') : undefined
      const normalizedTarget = typeof target === 'string' ? normalizeManagedPathAliasTarget(target) : undefined
      if (!find || !normalizedTarget) {
        continue
      }
      aliasMap.set(find, path.resolve(cwd, normalizedTarget))
    }
  }

  return Array.from(aliasMap, ([find, replacement]) => ({
    find,
    replacement,
  }))
}

export function createLoadConfig(options: LoadConfigFactoryOptions) {
  const { injectBuiltinAliases, oxcRolldownPlugin, oxcVitePlugin } = options

  return async function loadConfig(opts: LoadConfigOptions): Promise<LoadConfigResult> {
    const { cwd, isDev, mode, outputRoot, pluginOnly = false, inlineConfig, cliPlatform, projectConfigPath } = opts

    const { packageJson, packageJsonPath } = await loadPackageJson(cwd)

    const {
      loadedConfig,
      weappConfig,
      mergedLoadedConfig,
      configFilePath,
      configFileDependencies,
      configMergeInfo,
    } = await resolveConfigSource(opts)
    validateProjectConfigSources(inlineConfig, loadedConfig, weappConfig)

    const config = defu<InlineConfig, (InlineConfig | undefined)[]>(
      inlineConfig,
      {
        mode,
        configFile: false,
      },
      mergedLoadedConfig,
      {
        build: {
          rolldownOptions: {
            output: {
              entryFileNames: (chunkInfo) => {
                return `${chunkInfo.name}.js`
              },
              hashCharacters: 'base36',
            },
          },
          assetsDir: '.',
        },
        logLevel: 'warn',
        weapp: getWeappViteConfig(),
      },
    )

    const chunksConfigured = Boolean(
      inlineConfig?.weapp?.chunks
      || loadedConfig.weapp?.chunks
      || weappConfig?.weapp?.chunks,
    )

    const shouldWarnEnhance = [
      inlineConfig?.weapp?.enhance,
      loadedConfig.weapp?.enhance,
      weappConfig?.weapp?.enhance,
    ].some(hasDeprecatedEnhanceUsage)

    const userConfiguredTopLevel = {
      wxml: [
        inlineConfig?.weapp?.wxml,
        loadedConfig.weapp?.wxml,
        weappConfig?.weapp?.wxml,
      ].some(value => value !== undefined),
      wxs: [
        inlineConfig?.weapp?.wxs,
        loadedConfig.weapp?.wxs,
        weappConfig?.weapp?.wxs,
      ].some(value => value !== undefined),
      autoImportComponents: [
        inlineConfig?.weapp?.autoImportComponents,
        loadedConfig.weapp?.autoImportComponents,
        weappConfig?.weapp?.autoImportComponents,
      ].some(value => value !== undefined),
    }

    migrateEnhanceOptions(config.weapp, {
      warn: shouldWarnEnhance,
      userConfigured: userConfiguredTopLevel,
    })

    const rawLibConfig = config.weapp?.lib
    const libEntryConfigured = hasLibEntry(rawLibConfig?.entry)
    if (rawLibConfig && !libEntryConfigured) {
      throw new Error('已配置 weapp.lib，但未提供有效的 entry。')
    }
    if (libEntryConfigured && rawLibConfig?.root) {
      config.weapp = {
        ...config.weapp,
        srcRoot: rawLibConfig.root,
      }
    }

    const srcRoot = config.weapp?.srcRoot ?? ''
    const managedTsconfigAliases = collectManagedTsconfigAliases(config, cwd)
    injectResolvedAliases(config, managedTsconfigAliases)
    const tsconfigPathsOptions = config.weapp?.tsconfigPaths
    const tsconfigPathsUsage = await inspectTsconfigPathsUsage(cwd)
    const tsconfigUsageAliases = tsconfigPathsUsage.aliases ?? []
    const tsconfigReferenceAliases = tsconfigPathsUsage.referenceAliases ?? []
    const tsconfigAliases = tsconfigUsageAliases.length > 0
      ? tsconfigUsageAliases
      : tsconfigReferenceAliases
    const shouldDelegateToNativeTsconfigPaths = tsconfigPathsOptions === true
    if (!tsconfigPathsUsage.enabled) {
      injectDefaultSrcAlias(config, cwd, srcRoot)
    }
    else if (!shouldDelegateToNativeTsconfigPaths) {
      injectResolvedAliases(config, tsconfigAliases)
      injectDefaultSrcAlias(config, cwd, srcRoot)
    }
    const resolvedLibConfig = libEntryConfigured
      ? resolveWeappLibConfig({ cwd, srcRoot, config: rawLibConfig })
      : undefined
    const resolvedWebConfig = resolveWeappWebConfig({
      cwd,
      srcRoot,
      config: config.weapp?.web,
      enableByCli: resolveCliPlatformRuntime(cliPlatform).isWebRuntime,
    })

    const {
      platform,
      multiPlatform,
      isWebRuntime,
    } = configureBuildAndPlugins({
      config,
      pluginOnly,
      oxcRolldownPlugin,
      oxcVitePlugin,
      injectBuiltinAliases,
      resolvedLibConfig,
      cliPlatform,
      explicitPlatform: Boolean(inlineConfig?.weapp?.platform ?? mergedLoadedConfig.weapp?.platform),
      projectConfigPath,
      cwd,
    })
    const {
      projectConfig,
      projectPrivateConfig,
      projectConfigPath: projectConfigPathResolved,
      projectPrivateConfigPath: projectPrivateConfigPathResolved,
      mpDistRoot,
    } = await loadProjectConfig({
      config,
      cwd,
      platform,
      multiPlatform,
      projectConfigPath,
      outputRoot,
      pluginOnly,
      isWebRuntime,
      resolvedLibConfig,
    })
    const aliasEntries = mergeJsonAliasEntries(config.weapp?.jsonAlias)

    config.plugins ??= []
    if (tsconfigPathsOptions !== false) {
      const usesAdvancedTsconfigPathsOptions = typeof tsconfigPathsOptions === 'object' && tsconfigPathsOptions !== null
      if (usesAdvancedTsconfigPathsOptions) {
        config.plugins.push(tsconfigPaths(tsconfigPathsOptions))
      }
      else if (shouldDelegateToNativeTsconfigPaths) {
        config.resolve ??= {}
        config.resolve.tsconfigPaths ??= true
      }
    }

    const outputExtensions = getOutputExtensions(platform)

    const relativeSrcRoot = (p: string) => {
      if (srcRoot) {
        return path.relative(srcRoot, p)
      }
      return p
    }

    return {
      config,
      sourceConfig: mergedLoadedConfig,
      loadOptions: opts,
      aliasEntries,
      outputExtensions,
      packageJson,
      relativeSrcRoot,
      cwd,
      isDev,
      mode,
      emitDefaultAutoImportOutputs: opts.emitDefaultAutoImportOutputs ?? true,
      chunksConfigured,
      projectConfig,
      projectPrivateConfig,
      projectConfigPath: projectConfigPathResolved,
      projectPrivateConfigPath: projectPrivateConfigPathResolved,
      mpDistRoot,
      multiPlatform,
      packageJsonPath,
      platform,
      srcRoot,
      pluginOnly,
      configFilePath,
      configFileDependencies,
      currentSubPackageRoot: undefined,
      weappWeb: resolvedWebConfig,
      weappLib: resolvedLibConfig,
      configMergeInfo,
    }
  }
}
