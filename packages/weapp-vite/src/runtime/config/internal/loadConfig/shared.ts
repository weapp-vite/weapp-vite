import type { PackageJson } from 'pkg-types'
import type { RolldownPluginOption } from 'rolldown'
import type { ResolvedMultiPlatformConfig } from '../../../../multiPlatform'
import type { MpPlatform } from '../../../../types'
import fs from 'node:fs/promises'
import path from 'pathe'
import {
  DEFAULT_MULTI_PLATFORM_PROJECT_CONFIG_ROOT,
  resolveMultiPlatformProjectConfigDir,
} from '../../../../multiPlatform'
import { getProjectConfigFileName, getProjectPrivateConfigFileName } from '../../../../utils'
import { toPosixPath } from '../../../../utils/path'

const TRAILING_SLASH_RE = /\/+$/

export function pluginMatchesName(plugin: RolldownPluginOption<any>, targetName: string): boolean {
  if (Array.isArray(plugin)) {
    return plugin.some(entry => pluginMatchesName(entry, targetName))
  }

  if (plugin && typeof plugin === 'object' && 'name' in plugin) {
    const pluginName = (plugin as { name?: unknown }).name
    return typeof pluginName === 'string' && pluginName === targetName
  }

  return false
}

export { resolveMultiPlatformConfig } from '../../../../multiPlatform'

export function resolveProjectConfigPaths(options: {
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
  const rootDir = resolveMultiPlatformProjectConfigDir(options.multiPlatform, options.platform)
  return {
    basePath: path.join(rootDir, projectConfigFileName),
    privatePath: path.join(rootDir, projectPrivateConfigFileName),
  }
}

export function formatProjectConfigPath(cwd: string, target?: string) {
  if (!target) {
    return 'project.config.json'
  }
  const resolved = path.resolve(cwd, target)
  const relative = path.relative(cwd, resolved)
  return relative && !relative.startsWith('..') ? relative : resolved
}

export function normalizeRelativeDistRoot(value: string) {
  const normalized = toPosixPath(value).replace(TRAILING_SLASH_RE, '')
  return normalized.startsWith('./') ? normalized.slice(2) : normalized
}

export { DEFAULT_MULTI_PLATFORM_PROJECT_CONFIG_ROOT }

export async function loadPackageJson(cwd: string) {
  const packageJsonPath = path.resolve(cwd, 'package.json')
  let packageJson: PackageJson = {}
  try {
    const content = await fs.readFile(packageJsonPath, 'utf8')
    packageJson = JSON.parse(content) as PackageJson
  }
  catch {
    packageJson = {}
  }

  return {
    packageJson,
    packageJsonPath,
  }
}
