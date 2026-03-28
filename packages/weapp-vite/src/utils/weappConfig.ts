/* eslint-disable e18e/ban-dependencies -- fs-extra is still the project-standard file helper in this module. */
import fs from 'fs-extra'
import path from 'pathe'

const WEAPP_VITE_CONFIG_CANDIDATES = [
  'weapp-vite.config.ts',
  'weapp-vite.config.mts',
  'weapp-vite.config.cts',
  'weapp-vite.config.js',
  'weapp-vite.config.mjs',
  'weapp-vite.config.cjs',
  'weapp-vite.config.json',
] as const

const WEAPP_VITE_CONFIG_SET = new Set<string>(WEAPP_VITE_CONFIG_CANDIDATES)

export interface ResolveWeappConfigFileOptions {
  root: string
  specified?: string
}

export function resolveSpecifiedWeappConfigPath(root: string, specified: string) {
  return path.isAbsolute(specified)
    ? specified
    : path.resolve(root, specified)
}

export function isWeappConfigBasename(filePath: string) {
  return WEAPP_VITE_CONFIG_SET.has(path.basename(filePath))
}

async function findWeappConfigInDirectory(directory: string): Promise<string | undefined> {
  for (const filename of WEAPP_VITE_CONFIG_CANDIDATES) {
    const candidatePath = path.resolve(directory, filename)
    if (await fs.pathExists(candidatePath)) {
      return candidatePath
    }
  }

  return undefined
}

export async function resolveWeappConfigFile(options: ResolveWeappConfigFileOptions): Promise<string | undefined> {
  const { root, specified } = options
  if (specified) {
    const resolvedSpecified = resolveSpecifiedWeappConfigPath(root, specified)

    if (isWeappConfigBasename(resolvedSpecified)) {
      if (await fs.pathExists(resolvedSpecified)) {
        return resolvedSpecified
      }
      return undefined
    }

    const fromSpecifiedDirectory = await findWeappConfigInDirectory(path.dirname(resolvedSpecified))
    if (fromSpecifiedDirectory) {
      return fromSpecifiedDirectory
    }
  }

  return findWeappConfigInDirectory(root)
}

export { WEAPP_VITE_CONFIG_CANDIDATES }
