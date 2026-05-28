import type { RolldownPluginOption } from 'rolldown'
import type { InlineConfig, PluginOption } from 'vite'
import type { AliasOptions } from '../../../types'
import type { LoadConfigOptions, LoadConfigResult } from '../types'
import { defu } from '@weapp-core/shared'
import path from 'pathe'
import tsconfigPaths from 'vite-tsconfig-paths'
import { getOutputExtensions, getWeappViteConfig } from '../../../defaults'
import logger from '../../../logger'
import {
  createCjsConfigLoadError,
  getAliasEntries,
  getProjectConfig,
  getProjectConfigFileName,
  getProjectConfigRootKeys,
  getProjectPrivateConfigFileName,
  loadViteConfigFile,
  resolveProjectConfigRoot,
  resolveWeappConfigFile,
  TYPELESS_PACKAGE_JSON_WARNING_CODE,
} from '../../../utils'
import { hasLibEntry, resolveWeappLibConfig } from '../../lib'
import { hasDeprecatedEnhanceUsage, migrateEnhanceOptions } from '../enhance'
import { resolveWeappWebConfig } from '../web'
import { configureBuildAndPlugins } from './loadConfig/build'
import { formatProjectConfigPath, loadPackageJson, normalizeRelativeDistRoot, resolveProjectConfigPaths } from './loadConfig/shared'
import { inspectTsconfigPathsUsage } from './tsconfigPaths'

export interface LoadConfigFactoryOptions {
  injectBuiltinAliases: (config: InlineConfig) => void
  oxcRolldownPlugin: RolldownPluginOption<any> | undefined
  oxcVitePlugin: PluginOption | undefined
}

export function resolveConfigFilePath(cwd: string, configFile?: string) {
  if (!configFile) {
    return configFile
  }
  return path.isAbsolute(configFile) ? configFile : path.resolve(cwd, configFile)
}

export function shouldReuseLoadedWeappConfig(
  weappConfigFilePath?: string,
  loadedPath?: string,
) {
  if (!weappConfigFilePath || !loadedPath) {
    return false
  }

  return path.resolve(loadedPath) === path.resolve(weappConfigFilePath)
}

function collectConfigFileDependencies(
  cwd: string,
  ...entries: Array<{
    path?: string
    dependencies?: string[]
  } | string | null | undefined>
) {
  const dependencySet = new Set<string>()

  const add = (filePath: string | undefined) => {
    if (!filePath) {
      return
    }
    dependencySet.add(path.isAbsolute(filePath) ? path.normalize(filePath) : path.resolve(cwd, filePath))
  }

  for (const entry of entries) {
    if (!entry) {
      continue
    }
    if (typeof entry === 'string') {
      add(entry)
      continue
    }
    add(entry.path)
    for (const dependency of entry.dependencies ?? []) {
      add(dependency)
    }
  }

  return Array.from(dependencySet)
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

async function loadConfigFileWithFallback(
  configEnv: { command: 'serve' | 'build', mode: string },
  configFile: string | undefined,
  cwd: string,
  configLoader: 'bundle' | 'runner' | 'native',
) {
  const suppressedWarningCodes = configLoader === 'native'
    ? [TYPELESS_PACKAGE_JSON_WARNING_CODE]
    : undefined

  try {
    return await loadViteConfigFile(
      configEnv,
      configFile,
      cwd,
      undefined,
      undefined,
      configLoader,
      suppressedWarningCodes,
      configLoader === 'native' ? 'silent' : undefined,
    )
  }
  catch (error) {
    if (configLoader !== 'native') {
      throw error
    }

    const message = error instanceof Error ? error.message : String(error)
    logger.warn(`[prepare] 原生配置加载失败，已回退到 runner：${message}`)

    return loadConfigFileWithFallback(configEnv, configFile, cwd, 'runner')
  }
}

export function createLoadConfig(options: LoadConfigFactoryOptions) {
  const { injectBuiltinAliases, oxcRolldownPlugin, oxcVitePlugin } = options

  return async function loadConfig(opts: LoadConfigOptions): Promise<LoadConfigResult> {
    const { cwd, isDev, mode, pluginOnly = false, inlineConfig, configFile, configLoader = 'runner', cliPlatform, projectConfigPath } = opts

    const { packageJson, packageJsonPath } = await loadPackageJson(cwd)

    const resolvedConfigFile = resolveConfigFilePath(cwd, configFile)

    const weappConfigFilePath = await resolveWeappConfigFile({
      root: cwd,
      specified: resolvedConfigFile,
    })

    let loaded: Awaited<ReturnType<typeof loadViteConfigFile>> | undefined
    try {
      loaded = await loadConfigFileWithFallback({
        command: isDev ? 'serve' : 'build',
        mode,
      }, resolvedConfigFile, cwd, configLoader)
    }
    catch (error) {
      const cjsError = createCjsConfigLoadError({
        error,
        configPath: resolvedConfigFile,
        cwd,
      })
      if (cjsError) {
        throw cjsError
      }
      throw error
    }

    const loadedConfig = loaded?.config ?? {}

    let weappLoaded: Awaited<ReturnType<typeof loadViteConfigFile>> | undefined
    if (weappConfigFilePath) {
      if (shouldReuseLoadedWeappConfig(weappConfigFilePath, loaded?.path)) {
        weappLoaded = loaded
      }
      else {
        try {
          weappLoaded = await loadConfigFileWithFallback({
            command: isDev ? 'serve' : 'build',
            mode,
          }, weappConfigFilePath, cwd, configLoader)
        }
        catch (error) {
          const cjsError = createCjsConfigLoadError({
            error,
            configPath: weappConfigFilePath,
            cwd,
          })
          if (cjsError) {
            throw cjsError
          }
          throw error
        }
      }
    }

    const mergedLoadedConfig = weappLoaded?.config
      ? defu(weappLoaded.config, loadedConfig)
      : loadedConfig

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
      || weappLoaded?.config?.weapp?.chunks,
    )

    const shouldWarnEnhance = [
      inlineConfig?.weapp?.enhance,
      loadedConfig.weapp?.enhance,
      weappLoaded?.config?.weapp?.enhance,
    ].some(hasDeprecatedEnhanceUsage)

    const userConfiguredTopLevel = {
      wxml: [
        inlineConfig?.weapp?.wxml,
        loadedConfig.weapp?.wxml,
        weappLoaded?.config?.weapp?.wxml,
      ].some(value => value !== undefined),
      wxs: [
        inlineConfig?.weapp?.wxs,
        loadedConfig.weapp?.wxs,
        weappLoaded?.config?.weapp?.wxs,
      ].some(value => value !== undefined),
      autoImportComponents: [
        inlineConfig?.weapp?.autoImportComponents,
        loadedConfig.weapp?.autoImportComponents,
        weappLoaded?.config?.weapp?.autoImportComponents,
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
    const tsconfigPathsUsage = await inspectTsconfigPathsUsage(cwd)
    const tsconfigUsageAliases = tsconfigPathsUsage.aliases ?? []
    const tsconfigReferenceAliases = tsconfigPathsUsage.referenceAliases ?? []
    const tsconfigAliases = tsconfigUsageAliases.length > 0
      ? tsconfigUsageAliases
      : tsconfigReferenceAliases
    if (!tsconfigPathsUsage.enabled) {
      injectDefaultSrcAlias(config, cwd, srcRoot)
    }
    else if (tsconfigPathsUsage.references && !tsconfigPathsUsage.root) {
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
    })

    const {
      buildConfig,
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
      projectConfigPath,
      cwd,
    })
    let projectConfig: Record<string, any> = {}
    let projectConfigPathResolved: string | undefined
    let projectPrivateConfigPathResolved: string | undefined
    let mpDistRoot = ''
    const isLibMode = Boolean(resolvedLibConfig?.enabled)
    if (!isWebRuntime && !isLibMode) {
      const { basePath, privatePath } = resolveProjectConfigPaths({
        platform,
        multiPlatform,
        projectConfigPath,
        isWebRuntime,
      })
      projectConfig = await getProjectConfig(cwd, {
        basePath,
        privatePath,
      })
      mpDistRoot = resolveProjectConfigRoot(projectConfig, platform) ?? ''
      if (!mpDistRoot) {
        const displayPath = formatProjectConfigPath(cwd, basePath ?? getProjectConfigFileName(platform))
        const rootKeys = getProjectConfigRootKeys(platform)
        const hint = rootKeys.join(' 或 ')
        throw new Error(`请在 ${displayPath} 里设置 ${hint}, 比如可以设置为 dist/`)
      }
      if (multiPlatform.enabled && !path.isAbsolute(mpDistRoot)) {
        const normalizedDistRoot = normalizeRelativeDistRoot(mpDistRoot)
        if (normalizedDistRoot === 'dist') {
          mpDistRoot = path.join('dist', platform, normalizedDistRoot)
        }
      }
      buildConfig.outDir ??= mpDistRoot
      projectConfigPathResolved = path.resolve(cwd, basePath ?? getProjectConfigFileName(platform))
      projectPrivateConfigPathResolved = path.resolve(cwd, privatePath ?? getProjectPrivateConfigFileName(platform))
    }
    else if (isLibMode) {
      const libOutDir = buildConfig.outDir ?? resolvedLibConfig?.outDir ?? 'dist'
      buildConfig.outDir ??= libOutDir
      mpDistRoot = libOutDir
    }
    if (pluginOnly && buildConfig.outDir) {
      mpDistRoot = buildConfig.outDir
    }
    const aliasEntries = mergeJsonAliasEntries(config.weapp?.jsonAlias)

    config.plugins ??= []
    const tsconfigPathsOptions = config.weapp?.tsconfigPaths
    if (tsconfigPathsOptions !== false) {
      const usesAdvancedTsconfigPathsOptions = typeof tsconfigPathsOptions === 'object' && tsconfigPathsOptions !== null
      if (usesAdvancedTsconfigPathsOptions) {
        config.plugins.push(tsconfigPaths(tsconfigPathsOptions))
      }
      else if (tsconfigPathsOptions === true || tsconfigPathsUsage.enabled) {
        config.resolve ??= {}
        config.resolve.tsconfigPaths ??= true
      }
    }

    const configFilePath = weappLoaded?.path ?? loaded?.path ?? resolvedConfigFile
    const configFileDependencies = collectConfigFileDependencies(
      cwd,
      loaded,
      weappLoaded,
      resolvedConfigFile,
    )
    const configMergeInfo = loaded?.path && weappLoaded?.path && !shouldReuseLoadedWeappConfig(weappLoaded.path, loaded.path)
      ? {
          merged: true,
          viteConfigPath: loaded.path,
          weappConfigPath: weappLoaded.path,
        }
      : {
          merged: false,
          viteConfigPath: loaded?.path,
          weappConfigPath: shouldReuseLoadedWeappConfig(weappLoaded?.path, loaded?.path)
            ? undefined
            : weappLoaded?.path,
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
