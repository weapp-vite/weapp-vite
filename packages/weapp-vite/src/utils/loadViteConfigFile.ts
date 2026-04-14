import type { ConfigEnv, UserConfigExport } from 'vite'
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

const DEFAULT_VITE_CONFIG_FILE_SET = new Set<string>(DEFAULT_VITE_CONFIG_FILES)

export function isDefaultViteConfigBasename(filePath: string) {
  return DEFAULT_VITE_CONFIG_FILE_SET.has(path.basename(filePath))
}

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
  configLoader?: 'bundle' | 'runner' | 'native',
) {
  void configFileDependencies
  void configFileExport
  const resolvedConfigFile = configFile ?? await resolveImplicitConfigFile(configRoot)
  const resolvedConfigLoader = configLoader ?? 'bundle'
  return loadConfigFromFile(
    configEnv,
    resolvedConfigFile,
    configRoot,
    undefined,
    undefined,
    resolvedConfigLoader,
  )
}

export { DEFAULT_VITE_CONFIG_FILES }
