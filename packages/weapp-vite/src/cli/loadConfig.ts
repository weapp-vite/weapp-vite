import process from 'node:process'
import { defu } from '@weapp-core/shared'
import path from 'pathe'
import { loadConfigFromFile } from 'vite'
import { resolveWeappConfigFile } from '../utils'

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

  const loaded = await loadConfigFromFile(configEnv, resolvedConfigFile, cwd, undefined, undefined, 'runner')
  const weappConfigFilePath = await resolveWeappConfigFile({
    root: cwd,
    specified: resolvedConfigFile,
  })

  let weappLoaded: Awaited<ReturnType<typeof loadConfigFromFile>> | undefined
  if (weappConfigFilePath) {
    const normalizedWeappPath = path.resolve(weappConfigFilePath)
    const normalizedLoadedPath = loaded?.path ? path.resolve(loaded.path) : undefined
    if (normalizedLoadedPath && normalizedLoadedPath === normalizedWeappPath) {
      weappLoaded = loaded
    }
    else {
      weappLoaded = await loadConfigFromFile(configEnv, weappConfigFilePath, cwd, undefined, undefined, 'runner')
    }
  }

  if (!loaded && !weappLoaded) {
    return undefined
  }

  const config = loaded?.config ?? (weappLoaded?.config ?? {})
  if (weappLoaded?.config?.weapp) {
    config.weapp = defu(
      weappLoaded.config.weapp,
      config.weapp ?? {},
    )
  }

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
