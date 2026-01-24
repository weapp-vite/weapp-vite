import type { PackageJson } from 'pkg-types'
import type { RolldownPluginOption } from 'rolldown'
import type { InlineConfig, PluginOption } from 'vite'
import type { MpPlatform } from '../../../types'
import type { LoadConfigOptions, LoadConfigResult } from '../types'
import { defu } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'
import { loadConfigFromFile } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { getOutputExtensions, getWeappViteConfig } from '../../../defaults'
import { DEFAULT_MP_PLATFORM, normalizeMiniPlatform } from '../../../platform'
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
import { toPosixPath } from '../../../utils/path'
import { hasDeprecatedEnhanceUsage, migrateEnhanceOptions } from '../enhance'
import { createLegacyEs5Plugin } from '../legacyEs5'
import { sanitizeBuildTarget } from '../targets'
import { resolveWeappWebConfig } from '../web'
import { shouldEnableTsconfigPathsPlugin } from './tsconfigPaths'

export interface LoadConfigFactoryOptions {
  injectBuiltinAliases: (config: InlineConfig) => void
  oxcRolldownPlugin: RolldownPluginOption<any> | undefined
  oxcVitePlugin: PluginOption | undefined
}

function pluginMatchesName(plugin: RolldownPluginOption<any>, targetName: string): boolean {
  if (Array.isArray(plugin)) {
    return plugin.some(entry => pluginMatchesName(entry, targetName))
  }

  if (plugin && typeof plugin === 'object' && 'name' in plugin) {
    const pluginName = (plugin as { name?: unknown }).name
    return typeof pluginName === 'string' && pluginName === targetName
  }

  return false
}

interface ResolvedMultiPlatformConfig {
  enabled: boolean
  projectConfigRoot: string
}

function resolveMultiPlatformConfig(value: unknown): ResolvedMultiPlatformConfig {
  if (!value) {
    return {
      enabled: false,
      projectConfigRoot: 'config',
    }
  }
  if (value === true) {
    return {
      enabled: true,
      projectConfigRoot: 'config',
    }
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as { enabled?: boolean, projectConfigRoot?: string }
    const root = record.projectConfigRoot?.trim()
    return {
      enabled: record.enabled !== false,
      projectConfigRoot: root || 'config',
    }
  }
  return {
    enabled: false,
    projectConfigRoot: 'config',
  }
}

function resolveProjectConfigPaths(options: {
  platform: MpPlatform
  multiPlatform: ResolvedMultiPlatformConfig
  projectConfigPath?: string
  isWebRuntime: boolean
}) {
  if (options.isWebRuntime) {
    return {}
  }
  const projectConfigFileName = getProjectConfigFileName(options.platform)
  const projectPrivateConfigFileName = getProjectPrivateConfigFileName(options.platform)
  if (options.projectConfigPath) {
    const basePath = options.projectConfigPath
    const privatePath = path.join(path.dirname(basePath), `project.private.config.${options.platform}.json`)
    return {
      basePath,
      privatePath,
    }
  }
  if (!options.multiPlatform.enabled) {
    return {
      basePath: projectConfigFileName,
      privatePath: projectPrivateConfigFileName,
    }
  }
  const rootDir = options.multiPlatform.projectConfigRoot || 'config'
  return {
    basePath: path.join(rootDir, options.platform, projectConfigFileName),
    privatePath: path.join(rootDir, options.platform, projectPrivateConfigFileName),
  }
}

function formatProjectConfigPath(cwd: string, target?: string) {
  if (!target) {
    return 'project.config.json'
  }
  const resolved = path.resolve(cwd, target)
  const relative = path.relative(cwd, resolved)
  return relative && !relative.startsWith('..') ? relative : resolved
}

function normalizeRelativeDistRoot(value: string) {
  const normalized = toPosixPath(value).replace(/\/+$/, '')
  return normalized.startsWith('./') ? normalized.slice(2) : normalized
}

export function createLoadConfig(options: LoadConfigFactoryOptions) {
  const { injectBuiltinAliases, oxcRolldownPlugin, oxcVitePlugin } = options

  return async function loadConfig(opts: LoadConfigOptions): Promise<LoadConfigResult> {
    const { cwd, isDev, mode, inlineConfig, configFile, cliPlatform, projectConfigPath } = opts

    const packageJsonPath = path.resolve(cwd, 'package.json')
    let packageJson: PackageJson = {}
    if (await fs.pathExists(packageJsonPath)) {
      const content: PackageJson = await fs.readJson(packageJsonPath, {
        throws: false,
      }) || {}
      packageJson = content
    }

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

    const srcRoot = config.weapp?.srcRoot ?? ''
    const resolvedWebConfig = resolveWeappWebConfig({
      cwd,
      srcRoot,
      config: config.weapp?.web,
    })

    const buildConfig = config.build ?? (config.build = {})
    const jsFormat = config.weapp?.jsFormat ?? 'cjs'
    const enableLegacyEs5 = config.weapp?.es5 === true

    if (enableLegacyEs5 && jsFormat !== 'cjs') {
      throw new Error('`weapp.es5` 仅支持在 `weapp.jsFormat` 为 "cjs" 时使用，请切换到 CommonJS 或关闭该选项。')
    }

    const targetInfo = sanitizeBuildTarget(buildConfig.target, { allowEs5: enableLegacyEs5 })
    if (enableLegacyEs5) {
      buildConfig.target = 'es2015'
    }
    else if (targetInfo.hasTarget && targetInfo.sanitized !== undefined) {
      buildConfig.target = targetInfo.sanitized
    }

    const rdOptions = buildConfig.rolldownOptions ?? (buildConfig.rolldownOptions = {})
    if (Array.isArray(rdOptions.output)) {
      rdOptions.output = rdOptions.output.map((output) => {
        return {
          ...output,
          format: jsFormat,
        }
      })
    }
    else {
      const output = rdOptions.output ?? (rdOptions.output = {})
      output.format = jsFormat
    }

    const rollupOptions = buildConfig.rollupOptions ?? (buildConfig.rollupOptions = {})
    if (Array.isArray(rollupOptions.output)) {
      rollupOptions.output = rollupOptions.output.map((output) => {
        return {
          ...output,
          format: jsFormat,
        }
      })
    }
    else {
      const output = rollupOptions.output ?? (rollupOptions.output = {})
      // 说明：Rollup 类型允许数组/对象；这里统一归一化为对象
      if (Array.isArray(output)) {
        rollupOptions.output = output.map((out: any) => ({
          ...out,
          format: jsFormat,
        }))
      }
      else {
        (output as any).format = jsFormat
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
      const build = config.build ?? (config.build = {})
      const rd = build.rolldownOptions ?? (build.rolldownOptions = {})
      const raw = rd.plugins
      const arr: RolldownPluginOption<any>[] = raw == null
        ? []
        : Array.isArray(raw)
          ? [...raw]
          : [raw]

      const exists = arr.includes(oxcRolldownPlugin)
      rd.plugins = exists ? arr : [oxcRolldownPlugin, ...arr]
    }

    injectBuiltinAliases(config)
    if (oxcVitePlugin) {
      config.plugins ??= []
      config.plugins.unshift(oxcVitePlugin)
    }

    const platform = config.weapp?.platform ?? DEFAULT_MP_PLATFORM
    const multiPlatform = resolveMultiPlatformConfig(config.weapp?.multiPlatform)
    const normalizedCliPlatform = normalizeMiniPlatform(cliPlatform)
    const isWebRuntime = normalizedCliPlatform === 'h5' || normalizedCliPlatform === 'web'
    if (multiPlatform.enabled && !isWebRuntime && !normalizedCliPlatform) {
      throw new Error('已开启 weapp.multiPlatform，请通过 --platform 指定目标小程序平台，例如：weapp-vite dev -p weapp')
    }
    if (multiPlatform.enabled && !isWebRuntime && projectConfigPath) {
      const rootDir = multiPlatform.projectConfigRoot || 'config'
      const expectedPath = path.join(rootDir, platform, getProjectConfigFileName(platform))
      throw new Error(`已开启 weapp.multiPlatform，--project-config 不再支持，请使用 ${formatProjectConfigPath(cwd, expectedPath)}`)
    }
    let projectConfig: Record<string, any> = {}
    let projectConfigPathResolved: string | undefined
    let projectPrivateConfigPathResolved: string | undefined
    let mpDistRoot = ''
    if (!isWebRuntime) {
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
      if (buildConfig.outDir == null) {
        buildConfig.outDir = mpDistRoot
      }
      projectConfigPathResolved = path.resolve(cwd, basePath ?? getProjectConfigFileName(platform))
      projectPrivateConfigPathResolved = path.resolve(cwd, privatePath ?? getProjectPrivateConfigFileName(platform))
    }
    const aliasEntries = getAliasEntries(config.weapp?.jsonAlias)

    config.plugins ??= []
    const tsconfigPathsOptions = config.weapp?.tsconfigPaths
    if (tsconfigPathsOptions !== false) {
      const shouldEnable = tsconfigPathsOptions
        ? true
        : await shouldEnableTsconfigPathsPlugin(cwd)
      if (shouldEnable) {
        config.plugins.push(tsconfigPaths(tsconfigPathsOptions || undefined))
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
      projectConfig,
      projectConfigPath: projectConfigPathResolved,
      projectPrivateConfigPath: projectPrivateConfigPathResolved,
      mpDistRoot,
      packageJsonPath,
      platform,
      srcRoot,
      configFilePath,
      currentSubPackageRoot: undefined,
      weappWeb: resolvedWebConfig,
    }
  }
}
