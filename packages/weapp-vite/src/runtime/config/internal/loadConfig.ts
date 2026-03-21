import type { RolldownPluginOption } from 'rolldown'
import type { InlineConfig, PluginOption } from 'vite'
import type { LoadConfigOptions, LoadConfigResult } from '../types'
import { defu } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'
import { loadConfigFromFile } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { getOutputExtensions, getWeappViteConfig } from '../../../defaults'
import {
  createCjsConfigLoadError,
  getAliasEntries,
  getProjectConfig,
  getProjectConfigFileName,
  getProjectConfigRootKeys,
  getProjectPrivateConfigFileName,
  resolveProjectConfigRoot,
  resolveWeappConfigFile,
} from '../../../utils'
import { hasLibEntry, resolveWeappLibConfig } from '../../lib'
import { hasDeprecatedEnhanceUsage, migrateEnhanceOptions } from '../enhance'
import { resolveWeappWebConfig } from '../web'
import { configureBuildAndPlugins } from './loadConfig/build'
import { formatProjectConfigPath, loadPackageJson, normalizeRelativeDistRoot, resolveProjectConfigPaths } from './loadConfig/shared'

export interface LoadConfigFactoryOptions {
  injectBuiltinAliases: (config: InlineConfig) => void
  oxcRolldownPlugin: RolldownPluginOption<any> | undefined
  oxcVitePlugin: PluginOption | undefined
}

export function createLoadConfig(options: LoadConfigFactoryOptions) {
  const { injectBuiltinAliases, oxcRolldownPlugin, oxcVitePlugin } = options

  return async function loadConfig(opts: LoadConfigOptions): Promise<LoadConfigResult> {
    const { cwd, isDev, mode, pluginOnly = false, inlineConfig, configFile, cliPlatform, projectConfigPath } = opts

    const { packageJson, packageJsonPath } = await loadPackageJson(fs, cwd)

    let resolvedConfigFile = configFile
    if (resolvedConfigFile && !path.isAbsolute(resolvedConfigFile)) {
      resolvedConfigFile = path.resolve(cwd, resolvedConfigFile)
    }

    const weappConfigFilePath = await resolveWeappConfigFile({
      root: cwd,
      specified: resolvedConfigFile,
    })

    let loaded: Awaited<ReturnType<typeof loadConfigFromFile>> | undefined
    try {
      loaded = await loadConfigFromFile({
        command: isDev ? 'serve' : 'build',
        mode,
      }, resolvedConfigFile, cwd, undefined, undefined, 'runner')
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

    let weappLoaded: Awaited<ReturnType<typeof loadConfigFromFile>> | undefined
    if (weappConfigFilePath) {
      const normalizedWeappPath = path.resolve(weappConfigFilePath)
      const normalizedLoadedPath = loaded?.path ? path.resolve(loaded.path) : undefined
      if (normalizedLoadedPath && normalizedLoadedPath === normalizedWeappPath) {
        weappLoaded = loaded
      }
      else {
        try {
          weappLoaded = await loadConfigFromFile({
            command: isDev ? 'serve' : 'build',
            mode,
          }, weappConfigFilePath, cwd, undefined, undefined, 'runner')
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

    const config = defu<InlineConfig, (InlineConfig | undefined)[]>(
      inlineConfig,
      {
        mode,
        configFile: false,
      },
      loadedConfig,
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

    if (weappLoaded?.config?.weapp) {
      config.weapp = defu(
        weappLoaded.config.weapp,
        config.weapp ?? {},
      )
    }

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
    const aliasEntries = getAliasEntries(config.weapp?.jsonAlias)

    config.plugins ??= []
    const tsconfigPathsOptions = config.weapp?.tsconfigPaths
    if (tsconfigPathsOptions !== false) {
      const usesAdvancedTsconfigPathsOptions = typeof tsconfigPathsOptions === 'object' && tsconfigPathsOptions !== null
      if (usesAdvancedTsconfigPathsOptions) {
        config.plugins.push(tsconfigPaths(tsconfigPathsOptions))
      }
      else {
        config.resolve ??= {}
        config.resolve.tsconfigPaths ??= true
      }
    }

    const configFilePath = weappLoaded?.path ?? loaded?.path ?? resolvedConfigFile
    const outputExtensions = getOutputExtensions(platform)

    const relativeSrcRoot = (p: string) => {
      if (srcRoot) {
        return path.relative(srcRoot, p)
      }
      return p
    }

    return {
      config,
      aliasEntries,
      outputExtensions,
      packageJson,
      relativeSrcRoot,
      cwd,
      isDev,
      mode,
      chunksConfigured,
      projectConfig,
      projectConfigPath: projectConfigPathResolved,
      projectPrivateConfigPath: projectPrivateConfigPathResolved,
      mpDistRoot,
      packageJsonPath,
      platform,
      srcRoot,
      pluginOnly,
      configFilePath,
      currentSubPackageRoot: undefined,
      weappWeb: resolvedWebConfig,
      weappLib: resolvedLibConfig,
    }
  }
}
