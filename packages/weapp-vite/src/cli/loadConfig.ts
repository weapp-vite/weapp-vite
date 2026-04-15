import process from 'node:process'
import { defu } from '@weapp-core/shared'
import path from 'pathe'
import { createCjsConfigLoadError, loadViteConfigFile, resolveWeappConfigFile } from '../utils'

export async function loadConfig(configFile?: string) {
  const cwd = process.cwd()
  let resolvedConfigFile = configFile
  if (resolvedConfigFile && !path.isAbsolute(resolvedConfigFile)) {
    resolvedConfigFile = path.resolve(cwd, resolvedConfigFile)
  }

  const configEnv = {
    command: 'serve' as const,
    mode: 'development',
  }

  let loaded: Awaited<ReturnType<typeof loadViteConfigFile>> | undefined
  try {
    loaded = await loadViteConfigFile(configEnv, resolvedConfigFile, cwd, undefined, undefined, 'runner')
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
  const weappConfigFilePath = await resolveWeappConfigFile({
    root: cwd,
    specified: resolvedConfigFile,
  })

  let weappLoaded: Awaited<ReturnType<typeof loadViteConfigFile>> | undefined
  if (weappConfigFilePath) {
    const normalizedWeappPath = path.resolve(weappConfigFilePath)
    const normalizedLoadedPath = loaded?.path ? path.resolve(loaded.path) : undefined
    if (normalizedLoadedPath && normalizedLoadedPath === normalizedWeappPath) {
      weappLoaded = loaded
    }
    else {
      try {
        weappLoaded = await loadViteConfigFile(configEnv, weappConfigFilePath, cwd, undefined, undefined, 'runner')
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

  if (!loaded && !weappLoaded) {
    return undefined
  }

  const config = weappLoaded?.config
    ? defu(weappLoaded.config, loaded?.config ?? {})
    : loaded?.config ?? {}

  const dependencySet = new Set<string>()
  for (const dependency of loaded?.dependencies ?? []) {
    dependencySet.add(dependency)
  }
  for (const dependency of weappLoaded?.dependencies ?? []) {
    dependencySet.add(dependency)
  }

  return {
    config,
    path: weappLoaded?.path ?? loaded?.path ?? resolvedConfigFile,
    dependencies: Array.from(dependencySet),
  }
}
