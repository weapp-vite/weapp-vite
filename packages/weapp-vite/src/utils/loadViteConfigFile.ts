import type { ConfigEnv, ConfigLoader, ConfigRunner, UserConfigExport } from 'vite'
import fs from 'node:fs/promises'
import path from 'pathe'
import { loadConfigFromFile } from 'vite'

const DEFAULT_VITE_CONFIG_FILES = [
  'vite.config.ts',
  'vite.config.mts',
  'vite.config.cts',
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.cjs',
]

async function resolveImplicitConfigFile(configRoot: string) {
  for (const fileName of DEFAULT_VITE_CONFIG_FILES) {
    const filePath = path.resolve(configRoot, fileName)
    try {
      await fs.access(filePath)
      return filePath
    }
    catch {
      continue
    }
  }
  return undefined
}

export async function loadViteConfigFile(
  configEnv: ConfigEnv,
  configFile: string | undefined,
  configRoot: string,
  configFileDependencies?: string[],
  configFileExport?: UserConfigExport,
  configLoader?: ConfigLoader,
  runner?: ConfigRunner,
) {
  const resolvedConfigFile = configFile ?? await resolveImplicitConfigFile(configRoot)
  return loadConfigFromFile(
    configEnv,
    resolvedConfigFile,
    configRoot,
    configFileDependencies,
    configFileExport,
    configLoader,
    runner,
  )
}
