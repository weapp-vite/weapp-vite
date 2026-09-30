import type { InlineConfig } from 'vite'
import type { LoadConfigOptions } from '../../types'
import { defu } from '@weapp-core/shared'
import path from 'pathe'
import logger from '../../../../logger'
import {
  createCjsConfigLoadError,
  loadViteConfigFile,
  resolveWeappConfigFile,
  TYPELESS_PACKAGE_JSON_WARNING_CODE,
} from '../../../../utils'

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

/** 选择配置来源；宿主提供配置时绝不再次发现或执行配置文件。 */
export async function resolveConfigSource(opts: LoadConfigOptions) {
  const { cwd, isDev, mode, configFile, configLoader = 'runner' } = opts
  if (opts.hostConfig) {
    const { config, path: hostPath, dependencies } = opts.hostConfig
    return {
      loadedConfig: config,
      weappConfig: undefined,
      mergedLoadedConfig: config,
      configFilePath: hostPath && resolveConfigFilePath(cwd, hostPath),
      configFileDependencies: collectConfigFileDependencies(cwd, { path: hostPath, dependencies }),
      configMergeInfo: { merged: false, viteConfigPath: hostPath },
    }
  }
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
  const reuseLoadedWeappConfig = shouldReuseLoadedWeappConfig(weappConfigFilePath, loaded?.path)
  if (weappConfigFilePath) {
    if (reuseLoadedWeappConfig) {
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
    ? reuseLoadedWeappConfig
      ? loadedConfig
      : defu(weappLoaded.config, loadedConfig)
    : loadedConfig

  return {
    loadedConfig,
    weappConfig: weappLoaded?.config,
    mergedLoadedConfig: mergedLoadedConfig as InlineConfig,
    configFilePath: weappLoaded?.path ?? loaded?.path ?? resolvedConfigFile,
    configFileDependencies: collectConfigFileDependencies(cwd, loaded, weappLoaded, resolvedConfigFile),
    configMergeInfo: {
      merged: Boolean(loaded?.path && weappLoaded?.path && !reuseLoadedWeappConfig),
      viteConfigPath: loaded?.path,
      weappConfigPath: reuseLoadedWeappConfig ? undefined : weappLoaded?.path,
    },
  }
}
